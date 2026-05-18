const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

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
  console.log("Fetching centers...");
  
  const { data: centers, error } = await supabase
    .from('centers')
    .select('*')
    .is('latitude', null);

  if (error) {
    console.error("Error fetching centers:", error);
    return;
  }

  let sqlFileContent = "-- Auto-generated SQL script to backfill latitude and longitude\n\n";

  for (const center of centers) {
    let lat = null;
    let lon = null;

    const googleLinkCoords = extractCoords(center['Google link']);
    const locationCoords = extractCoords(center['Location']);

    if (googleLinkCoords) {
      lat = googleLinkCoords.lat;
      lon = googleLinkCoords.lon;
    } else if (locationCoords) {
      lat = locationCoords.lat;
      lon = locationCoords.lon;
    } else {
      const addressToGeocode = center['Address'] || center['Location'];
      if (addressToGeocode && !addressToGeocode.startsWith('http')) {
        const query = addressToGeocode.includes('Telangana') ? addressToGeocode : `${addressToGeocode}, Telangana, India`;
        
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
            headers: { 'User-Agent': 'Sakhi-181-Backend-Geocoding-Service/1.0' }
          });
          const data = await res.json();
          if (data && data.length > 0) {
            lat = parseFloat(data[0].lat);
            lon = parseFloat(data[0].lon);
          } else {
             if (center['District']) {
                 const districtQuery = `${center['District']}, Telangana, India`;
                 const fallbackRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(districtQuery)}&limit=1`, {
                    headers: { 'User-Agent': 'Sakhi-181-Backend-Geocoding-Service/1.0' }
                 });
                 const fallbackData = await fallbackRes.json();
                 if (fallbackData && fallbackData.length > 0) {
                     lat = parseFloat(fallbackData[0].lat);
                     lon = parseFloat(fallbackData[0].lon);
                 }
             }
          }
        } catch (e) {
          console.error(`- Geocoding error for ${center.id}`);
        }
        await sleep(1100);
      }
    }

    if (lat !== null && lon !== null) {
      sqlFileContent += `UPDATE centers SET latitude = ${lat}, longitude = ${lon} WHERE id = ${center.id};\n`;
      console.log(`Geocoded center ${center.id}: ${lat}, ${lon}`);
    }
  }

  fs.writeFileSync('update_centers.sql', sqlFileContent);
  console.log("Created update_centers.sql");
}

run();
