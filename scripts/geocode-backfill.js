const { createClient } = require('@supabase/supabase-js');

// User's project credentials
const SUPABASE_URL = 'https://ifasovihhhxznuvdgoxn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmYXNvdmloaGh4em51dmRnb3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNDIzMDgsImV4cCI6MjA5MTcxODMwOH0.iu5satWImQmodqy4FTXxWL6RZEUSVs22Y8Hnfh6753E';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const extractCoords = (url) => {
  if (!url) return null;
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lon: parseFloat(atMatch[2]) };
  }
  const qMatch = url.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) {
    return { lat: parseFloat(qMatch[1]), lon: parseFloat(qMatch[2]) };
  }
  return null;
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log("Fetching centers missing latitude/longitude...");
  
  // Fetch all centers where latitude is null
  const { data: centers, error } = await supabase
    .from('centers')
    .select('*')
    .is('latitude', null);

  if (error) {
    console.error("Error fetching centers:", error);
    return;
  }

  console.log(`Found ${centers.length} centers to process.`);

  let successCount = 0;

  for (const center of centers) {
    console.log(`\nProcessing Center ID ${center.id}: ${center.Name}`);
    let lat = null;
    let lon = null;

    const googleLinkCoords = extractCoords(center['Google link']);
    const locationCoords = extractCoords(center['Location']);

    if (googleLinkCoords) {
      lat = googleLinkCoords.lat;
      lon = googleLinkCoords.lon;
      console.log(`- Found coords in Google Link: ${lat}, ${lon}`);
    } else if (locationCoords) {
      lat = locationCoords.lat;
      lon = locationCoords.lon;
      console.log(`- Found coords in Location Link: ${lat}, ${lon}`);
    } else {
      // Fallback to Nominatim
      const addressToGeocode = center['Address'] || center['Location'];
      if (addressToGeocode && !addressToGeocode.startsWith('http')) {
        const query = addressToGeocode.includes('Telangana') ? addressToGeocode : `${addressToGeocode}, Telangana, India`;
        console.log(`- Querying Nominatim for: ${query}`);
        
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
            headers: { 'User-Agent': 'Sakhi-181-Backend-Geocoding-Service/1.0' }
          });
          const data = await res.json();
          if (data && data.length > 0) {
            lat = parseFloat(data[0].lat);
            lon = parseFloat(data[0].lon);
            console.log(`- Nominatim result: ${lat}, ${lon}`);
          } else {
             if (center['District']) {
                 const districtQuery = `${center['District']}, Telangana, India`;
                 console.log(`- Full address failed. Querying district: ${districtQuery}`);
                 const fallbackRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(districtQuery)}&limit=1`, {
                    headers: { 'User-Agent': 'Sakhi-181-Backend-Geocoding-Service/1.0' }
                 });
                 const fallbackData = await fallbackRes.json();
                 if (fallbackData && fallbackData.length > 0) {
                     lat = parseFloat(fallbackData[0].lat);
                     lon = parseFloat(fallbackData[0].lon);
                     console.log(`- District result: ${lat}, ${lon}`);
                 }
             }
          }
        } catch (e) {
          console.error(`- Geocoding error: ${e.message}`);
        }
        
        // Sleep to respect Nominatim API rate limits (1 request per second max)
        await sleep(1100);
      }
    }

    if (lat !== null && lon !== null) {
      console.log(`- Updating database for Center ${center.id}...`);
      const { error: updateError } = await supabase
        .from('centers')
        .update({ latitude: lat, longitude: lon })
        .eq('id', center.id);

      if (updateError) {
        console.error(`- Error updating Center ${center.id}:`, updateError);
      } else {
        console.log(`- Successfully updated!`);
        successCount++;
      }
    } else {
      console.log(`- Could not determine coordinates.`);
    }
  }

  console.log(`\nBackfill complete. Successfully updated ${successCount} out of ${centers.length} centers.`);
}

run();
