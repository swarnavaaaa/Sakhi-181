import { createClient } from '@supabase/supabase-js';

// Vercel Serverless Function to handle Supabase Webhooks
// It will geocode "Location", "Google link", or "Address" to lat/lon

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body;
    
    // Validate payload is from Supabase Database Webhook
    if (!payload || !payload.record) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const { type, record } = payload;
    
    // We only process INSERTs or UPDATEs where latitude/longitude is missing
    if (type !== 'INSERT' && type !== 'UPDATE') {
      return res.status(200).json({ message: 'Ignored non-insert/update event' });
    }

    if (record.latitude !== null && record.longitude !== null && record.latitude !== undefined) {
      return res.status(200).json({ message: 'Record already has coordinates' });
    }

    console.log(`Processing center ID: ${record.id} for geocoding...`);

    const supabaseUrl = process.env.SUPABASE_URL || 'https://ifasovihhhxznuvdgoxn.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmYXNvdmloaGh4em51dmRnb3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNDIzMDgsImV4cCI6MjA5MTcxODMwOH0.iu5satWImQmodqy4FTXxWL6RZEUSVs22Y8Hnfh6753E'; // Replace with env var in production

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try to extract coordinates from Google link or Location
    let lat = null;
    let lon = null;

    const extractCoords = (url) => {
      if (!url) return null;
      // Match @lat,lon
      const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (atMatch) {
        return { lat: parseFloat(atMatch[1]), lon: parseFloat(atMatch[2]) };
      }
      // Match ?q=lat,lon
      const qMatch = url.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (qMatch) {
        return { lat: parseFloat(qMatch[1]), lon: parseFloat(qMatch[2]) };
      }
      return null;
    };

    const googleLinkCoords = extractCoords(record['Google link']);
    const locationCoords = extractCoords(record['Location']);

    if (googleLinkCoords) {
      lat = googleLinkCoords.lat;
      lon = googleLinkCoords.lon;
      console.log(`Extracted from Google link: ${lat}, ${lon}`);
    } else if (locationCoords) {
      lat = locationCoords.lat;
      lon = locationCoords.lon;
      console.log(`Extracted from Location link: ${lat}, ${lon}`);
    } else {
      // Fallback to Nominatim geocoding based on Address
      const addressToGeocode = record['Address'] || record['Location'];
      
      if (addressToGeocode && !addressToGeocode.startsWith('http')) {
        console.log(`Geocoding address: ${addressToGeocode}`);
        // Add "Telangana, India" if not present to improve accuracy for this specific dataset
        const query = addressToGeocode.includes('Telangana') ? addressToGeocode : `${addressToGeocode}, Telangana, India`;
        
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
            headers: {
              'User-Agent': 'Sakhi-181-Backend-Geocoding-Service/1.0'
            }
          });
          
          const data = await response.json();
          if (data && data.length > 0) {
            lat = parseFloat(data[0].lat);
            lon = parseFloat(data[0].lon);
            console.log(`Nominatim result: ${lat}, ${lon}`);
          } else {
             // Fallback to searching with just District + "Telangana" if full address fails
             if (record['District']) {
                 const districtQuery = `${record['District']}, Telangana, India`;
                 const fallbackRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(districtQuery)}&limit=1`, {
                    headers: { 'User-Agent': 'Sakhi-181-Backend-Geocoding-Service/1.0' }
                 });
                 const fallbackData = await fallbackRes.json();
                 if (fallbackData && fallbackData.length > 0) {
                     lat = parseFloat(fallbackData[0].lat);
                     lon = parseFloat(fallbackData[0].lon);
                     console.log(`Fallback District result: ${lat}, ${lon}`);
                 }
             }
          }
        } catch (err) {
          console.error("Geocoding error:", err);
        }
      }
    }

    if (lat !== null && lon !== null) {
      // Update the record in Supabase
      const { error } = await supabase
        .from('centers')
        .update({ latitude: lat, longitude: lon })
        .eq('id', record.id);

      if (error) {
        console.error("Supabase update error:", error);
        return res.status(500).json({ error: 'Failed to update database', details: error.message });
      }

      console.log(`Successfully updated center ${record.id} with ${lat}, ${lon}`);
      return res.status(200).json({ message: 'Geocoding successful', lat, lon });
    } else {
      console.log(`Could not determine coordinates for center ${record.id}`);
      return res.status(200).json({ message: 'Could not determine coordinates' });
    }

  } catch (error) {
    console.error("Webhook handler error:", error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
