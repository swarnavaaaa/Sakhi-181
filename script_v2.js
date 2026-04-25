// Supabase Configuration
// USER: Replace these with your actual Supabase project credentials
const SUPABASE_URL = 'https://ifasovihhhxznuvdgoxn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmYXNvdmloaGh4em51dmRnb3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNDIzMDgsImV4cCI6MjA5MTcxODMwOH0.iu5satWImQmodqy4FTXxWL6RZEUSVs22Y8Hnfh6753E';

let supabaseClient = null;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Supabase if library is loaded
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("Supabase client initialized successfully.");
    } else {
        console.error("Supabase library not found. Ensure the CDN script is loading correctly.");
    }

    // Populate Categories Dropdown
    if (supabaseClient) {
        populateCategories();
    }
    // Translation Control Logic
    const translateControl = document.querySelector('.translate-control');
    if (translateControl) {
        translateControl.addEventListener('click', () => {
            const googleTranslateLink = translateControl.querySelector('.goog-te-gadget-simple');
            if (googleTranslateLink) {
                googleTranslateLink.click();
            }
        });
    }

    // Quick Exit Functionality
    const quickExitBtn = document.getElementById('quickExit');
    if (quickExitBtn) {
        quickExitBtn.addEventListener('click', () => {
            window.location.replace('https://www.google.com/search?q=weather+today');
        });
    }

    // Scroll Reveal Animation
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.reveal').forEach(el => {
        observer.observe(el);
    });

    // Search Form Submission
    const searchForm = document.querySelector('.hero-card form');
    if (searchForm) {
        searchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const pinInput = document.getElementById('pinInput');
            const categorySelect = document.getElementById('categorySelect');
            if (!pinInput) return;
            
            const pinVal = pinInput.value.trim();
            const categoryVal = categorySelect ? categorySelect.value : "";
            
            if (!supabaseClient) {
                showSimpleToast("Connecting to database... Please try again in 2 seconds.", "info");
                return;
            }

            if (pinVal.length === 6 && /^\d+$/.test(pinVal)) {
                // NEW: Try to geocode the PIN first to find the "Closest" center
                const btn = searchForm.querySelector('button[type="submit"]');
                const originalHtml = btn.innerHTML;
                btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Locating...';
                btn.disabled = true;

                try {
                    const geocoded = await geocodePin(pinVal);
                    if (geocoded) {
                        console.log(`Geocoded PIN ${pinVal} to:`, geocoded);
                        // Using a large radius (500km) to ensure we find the closest centers in the state
                        await searchNearbyCenters(geocoded.lat, geocoded.lon, 500, categoryVal, `PIN ${pinVal}`);
                    } else {
                        // Fallback to enhanced PIN search (including Address matching)
                        console.warn(`Geocoding failed for PIN ${pinVal}, falling back to enhanced PIN search.`);
                        await searchCentersByPin(pinVal, null, categoryVal);
                    }
                } catch (err) {
                    console.error("Search error:", err);
                    showSimpleToast("Error during search. Falling back to PIN match.", "error");
                    await searchCentersByPin(pinVal, null, categoryVal);
                } finally {
                    btn.innerHTML = originalHtml;
                    btn.disabled = false;
                }
            } else {
                showSimpleToast("Please enter a valid 6-digit numeric PIN code.", "error");
            }
        });
    }

    // Mobile Menu Toggle
    const menuToggle = document.getElementById('menuToggle');
    const navLinks = document.querySelector('.nav-links');
    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            const icon = menuToggle.querySelector('i');
            if (icon) {
                icon.classList.toggle('ri-menu-line');
                icon.classList.toggle('ri-close-line');
            }
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!menuToggle.contains(e.target) && !navLinks.contains(e.target) && navLinks.classList.contains('active')) {
                navLinks.classList.remove('active');
                const icon = menuToggle.querySelector('i');
                if (icon) {
                    icon.classList.add('ri-menu-line');
                    icon.classList.remove('ri-close-line');
                }
            }
        });
    }

    // Location detection is now triggered manually via the "Use Current Location" button
    // initLocationDetection();

    // Use Current Location Button
    const locationBtn = document.getElementById('useCurrentLocation');
    if (locationBtn) {
        locationBtn.addEventListener('click', () => {
            if (!supabaseClient) {
                showSimpleToast("Search service is still initializing. Please wait a moment.", "error");
                return;
            }
            
            const originalHtml = locationBtn.innerHTML;
            locationBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Detecting...';
            locationBtn.disabled = true;
            
            initLocationDetection(true)
                .catch(err => {
                    console.error("Location detection error:", err);
                    showSimpleToast(err.message || "Could not detect location. Please enter PIN manually.", "error");
                })
                .finally(() => {
                    locationBtn.innerHTML = originalHtml;
                    locationBtn.disabled = false;
                });
        });
    }

    // Resource Search Functionality
    const resourceSearchInput = document.getElementById('resourceSearch');
    const searchStatus = document.getElementById('searchStatus');
    const topicCards = document.querySelectorAll('.topic-card');

    if (resourceSearchInput) {
        resourceSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            let visibleCount = 0;

            if (searchStatus) {
                searchStatus.textContent = searchTerm ? `Showing results for: "${searchTerm}"` : '';
            }

            topicCards.forEach(card => {
                const title = card.querySelector('h3').textContent.toLowerCase();
                const description = card.querySelector('p').textContent.toLowerCase();

                if (title.includes(searchTerm) || description.includes(searchTerm)) {
                    card.style.display = 'block';
                    visibleCount++;
                    setTimeout(() => card.classList.add('active'), 10);
                } else {
                    card.style.display = 'none';
                    card.classList.remove('active');
                }
            });

            if (searchStatus && searchTerm) {
                requestAnimationFrame(() => {
                    searchStatus.textContent = `Found ${visibleCount} results for: "${searchTerm}"`;
                });
            }
        });
    }
});

/**
 * Fetches unique categories from the database and populates the dropdown
 */
async function populateCategories() {
    const categorySelect = document.getElementById('categorySelect');
    if (!categorySelect || !supabaseClient) return;

    try {
        console.log("Fetching unique categories...");
        // Use a select query to get all categories
        const { data, error } = await supabaseClient
            .from('centers')
            .select('Category');

        if (error) throw error;

        if (data) {
            const categories = [...new Set(data.map(item => item.Category))]
                .filter(cat => cat && cat.trim() !== "")
                .sort();

            const fragment = document.createDocumentFragment();
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                fragment.appendChild(option);
            });
            
            requestAnimationFrame(() => {
                categorySelect.appendChild(fragment);
            });
        }
    } catch (err) {
        console.error("Error populating categories:", err);
    }
}

async function searchCentersByPin(pin, autoLocation = null, category = "") {
    if (!supabaseClient) {
        showSimpleToast("Database service not ready.", "error");
        return;
    }

    const cleanPin = pin.toString().trim();
    const resultsContainer = document.getElementById('searchResultsContainer');
    const resultsList = document.getElementById('centersResultsList');
    
    if (resultsContainer && resultsList) {
        resultsList.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
            <i class="ri-loader-4-line ri-spin" style="font-size: 2.5rem; display: block; margin-bottom: 1rem; color: var(--primary);"></i>
            Searching for Sakhi Centers matching PIN <strong>${cleanPin}</strong>...
        </div>`;
        resultsContainer.style.display = 'block';
        
        // Defer scroll to prevent layout thrashing
        setTimeout(() => {
            resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);

        try {
            console.log(`Querying centers for PIN: ${cleanPin}${category ? ' in Category: ' + category : ''}`);
            
            // Search both the Pincode column AND the Address column (since some records might have empty Pincode but have it in Address)
            let query = supabaseClient
                .from('centers')
                .select('*')
                .or(`Pincode.eq.${cleanPin},Address.ilike.%${cleanPin}%`);

            if (category) {
                query = query.eq('Category', category);
            }

            const { data, error } = await query;

            if (error) throw error;

            if (data && data.length > 0) {
                console.log(`Found ${data.length} centers matching PIN ${cleanPin}`);
                renderCenters(data);
                if (autoLocation) {
                    showLocationToast(autoLocation, data.length);
                }
            } else {
                // If direct PIN search fails, try searching by District (if we can find the district for this PIN)
                console.log(`No direct match for PIN ${cleanPin}. Attempting District-based search...`);
                
                try {
                    const postApiUrl = `https://api.postalpincode.in/pincode/${cleanPin}`;
                    const postResponse = await fetch(postApiUrl);
                    const postData = await postResponse.json();

                    if (postData && postData[0] && postData[0].Status === "Success") {
                        const district = postData[0].PostOffice[0].District;
                        console.log(`Found district for ${cleanPin}: ${district}. Searching by district...`);
                        
                        let distQuery = supabaseClient.from('centers').select('*').eq('District', district);
                        if (category) distQuery = distQuery.eq('Category', category);
                        
                        const { data: distData, error: distError } = await distQuery;
                        
                        if (!distError && distData && distData.length > 0) {
                            renderCenters(distData);
                            showSimpleToast(`Found ${distData.length} centers in ${district} district.`, "info");
                            return;
                        }
                    }
                } catch (e) {
                    console.error("District fallback search failed:", e);
                }

                console.log(`No centers found for PIN ${cleanPin} even with fallbacks.`);
                resultsList.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
                    <i class="ri-map-pin-user-line" style="font-size: 3rem; display: block; margin-bottom: 1.5rem; color: var(--text-light);"></i>
                    <h3>No centers found in this area</h3>
                    <p style="margin-top: 1rem;">We couldn't find any Sakhi Centers matching PIN <strong>${cleanPin}</strong>.</p>
                    <p style="font-size: 0.85rem; margin-top: 0.5rem;">Try searching for your District name or use "Current Location" detection.</p>
                </div>`;
            }
        } catch (err) {
            console.error("Error fetching centers:", err);
            resultsList.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 3rem;">
                <i class="ri-error-warning-line" style="font-size: 2.5rem; display: block; margin-bottom: 1rem;"></i>
                <strong>Unexpected Error</strong>
                <p style="margin-top: 0.5rem;">${err.message || 'Failed to connect to database'}</p>
            </div>`;
        }
    }
}

async function searchNearbyCenters(lat, lon, radiusKm = 500, category = "", locationLabel = "your location") {
    if (!supabaseClient) {
        showSimpleToast("Supabase client not initialized.", "error");
        return;
    }

    const resultsContainer = document.getElementById('searchResultsContainer');
    const resultsList = document.getElementById('centersResultsList');
    
    if (resultsContainer && resultsList) {
        resultsList.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
            <i class="ri-loader-4-line ri-spin" style="font-size: 2.5rem; display: block; margin-bottom: 1rem; color: var(--primary);"></i>
            Finding Sakhi Centers near ${locationLabel}...
        </div>`;
        resultsContainer.style.display = 'block';
        
        // Defer scroll to prevent layout thrashing
        setTimeout(() => {
            resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);

        try {
            const { data, error } = await supabaseClient.from('centers').select('*');
            if (error) throw error;

            if (!data || data.length === 0) {
                resultsList.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">No center data found in database.</div>';
                return;
            }

            const nearby = data.filter(center => {
                // Try both lowercase and PascalCase just in case
                const latVal = center.latitude || center.Latitude;
                const lonVal = center.longitude || center.Longitude;
                
                if (latVal != null && lonVal != null) {
                    const dist = calculateDistance(lat, lon, parseFloat(latVal), parseFloat(lonVal));
                    center.distance = dist;
                    
                    // Apply distance filter AND category filter
                    const matchesCategory = !category || center.Category === category;
                    return dist <= radiusKm && matchesCategory;
                }
                return false;
            }).sort((a, b) => a.distance - b.distance);

            if (nearby.length > 0) {
                renderCenters(nearby);
                showLocationToast({ city: locationLabel === 'your location' ? 'Current Location' : locationLabel }, nearby.length);
            } else {
                resultsList.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
                    <i class="ri-map-pin-range-line" style="font-size: 3rem; display: block; margin-bottom: 1.5rem; color: var(--text-light);"></i>
                    <h3>No centers found nearby</h3>
                    <p style="margin-top: 1rem;">We couldn't find any centers within <strong>${radiusKm}km</strong> of <strong>${locationLabel}</strong>.</p>
                    <p style="font-size: 0.85rem; margin-top: 0.5rem;">Try searching by a different PIN code or district.</p>
                </div>`;
            }
        } catch (err) {
            console.error("Error fetching nearby centers:", err);
            resultsList.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 2rem;">Failed to fetch nearby centers. Error: ' + err.message + '</div>';
        }
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function renderCenters(centers) {
    const fragment = document.createDocumentFragment();

    centers.forEach((center, index) => {
        const services = center["Services provided"] ? center["Services provided"].split(',').map(s => `<span class="service-tag">${s.trim()}</span>`).join('') : '';
        const distanceText = center.distance ? `${Math.round(center.distance * 10) / 10} km away` : (center["District"] || 'OSC');
        
        // Check if this is the closest center (first in sorted list)
        const isClosest = index === 0 && center.distance !== undefined;
        
        const centerHtml = `
            <div class="center-item ${isClosest ? 'closest-highlight' : ''}">
                ${isClosest ? '<div class="closest-badge"><i class="ri-flashlight-fill"></i> Closest to you</div>' : ''}
                <div class="center-header">
                    <h4>${center["Name"]}</h4>
                    <span class="center-type-badge">${distanceText}</span>
                </div>
                <p style="font-size: 0.8rem; color: var(--primary); font-weight: 600; margin-bottom: 1rem;">${center["Category"] || 'Sakhi One Stop Centre'}</p>
                
                <div class="center-details">
                    <div class="center-info-row">
                        <i class="ri-map-pin-2-line"></i>
                        <span>${center["Address"]}<br><strong>${center["Pincode"] ? 'PIN: ' + center["Pincode"] : ''} ${center["District"] ? '(' + center["District"] + ')' : ''}</strong></span>
                    </div>
                    ${center["Phone Number"] ? `
                        <div class="center-info-row">
                            <i class="ri-phone-line"></i>
                            <a href="tel:${center["Phone Number"]}" class="contact-link">${center["Phone Number"]}</a>
                        </div>
                    ` : ''}
                    ${center["Point of Contact"] ? `
                        <div class="center-info-row">
                            <i class="ri-user-voice-line"></i>
                            <span>PoC: ${center["Point of Contact"]}</span>
                        </div>
                    ` : ''}
                    ${center["Email"] ? `
                        <div class="center-info-row">
                            <i class="ri-mail-line"></i>
                            <a href="mailto:${center["Email"]}" class="contact-link">${center["Email"]}</a>
                        </div>
                    ` : ''}
                </div>

                ${services ? `
                    <div class="center-services">
                        <p style="font-size: 0.7rem; font-weight: 700; margin-bottom: 0.6rem; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em;">Integrated Services</p>
                        <div class="services-wrapper">${services}</div>
                    </div>
                ` : ''}

                ${center["Google link"] ? `
                    <a href="${center["Google link"]}" target="_blank" class="btn-maps">
                        <i class="ri-map-pin-line"></i> View on Google Maps
                    </a>
                ` : ''}
            </div>
        `;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = centerHtml.trim();
        fragment.appendChild(tempDiv.firstChild);
    });
    
    requestAnimationFrame(() => {
        const resultsList = document.getElementById('centersResultsList');
        if (resultsList) {
            resultsList.innerHTML = '';
            resultsList.appendChild(fragment);
        }
    });
}

function initLocationDetection(isManual = false) {
    console.log("Initializing location detection...");
    
    // Safety check for Secure Context (Required for Geolocation)
    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
        console.warn("Geolocation requires a secure context (HTTPS). Falling back to IP detection.");
        if (isManual) {
            showSimpleToast("HTTPS required for precise location. Trying IP fallback...", "info");
        }
        return fallbackToIpDetection(isManual);
    }

    return new Promise((resolve, reject) => {
        // Safety timeout in case the browser hangs or blocks the prompt without calling the error callback
        const safetyTimeout = setTimeout(() => {
            console.warn("Geolocation prompt or response timed out (Safety Timeout).");
            if (isManual) {
                showSimpleToast("Location prompt timed out. Trying IP fallback...", "info");
            }
            fallbackToIpDetection(isManual).then(resolve).catch(reject);
        }, 12000); // 12 seconds safety margin

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    clearTimeout(safetyTimeout);
                    const { latitude, longitude } = position.coords;
                    console.log(`Coordinates detected: ${latitude}, ${longitude}`);
                    
                    if (isManual) {
                        try {
                            const categoryVal = document.getElementById('categorySelect')?.value || "";
                            await searchNearbyCenters(latitude, longitude, 100, categoryVal);
                            resolve();
                        } catch (err) {
                            reject(err);
                        }
                        return;
                    }
                    
                    // Try reverse geocoding to get PIN code for auto-fill
                    const geoData = await reverseGeocode(latitude, longitude);
                    
                    handleLocationData({ 
                        lat: latitude, 
                        lon: longitude, 
                        zip: geoData.postcode,
                        city: geoData.city || geoData.town || geoData.village,
                        method: 'browser' 
                    });
                    resolve();
                },
                (error) => {
                    clearTimeout(safetyTimeout);
                    console.warn(`Geolocation failed: ${error.message}. Falling back to IP detection.`);
                    let errorMsg = "Location access denied.";
                    if (error.code === error.TIMEOUT) errorMsg = "Location detection timed out.";
                    if (error.code === error.POSITION_UNAVAILABLE) errorMsg = "Location information is unavailable.";
                    
                   if (isManual) {
                       showSimpleToast(`${errorMsg} Trying IP detection...`, "info");
                   }
                   
                   fallbackToIpDetection(isManual).then(resolve).catch(reject);
                },
                { timeout: 10000, enableHighAccuracy: false } // Set to false for faster response on more devices
            );
        } else {
            clearTimeout(safetyTimeout);
            console.warn("Geolocation API not supported. Falling back to IP detection.");
            fallbackToIpDetection(isManual).then(resolve).catch(reject);
        }
    });
}

async function reverseGeocode(lat, lon) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`);
        const data = await response.json();
        console.log("Reverse geocode data:", data);
        return {
            postcode: data.address.postcode,
            city: data.address.city || data.address.town || data.address.village
        };
    } catch (error) {
        console.error("Reverse geocoding error:", error);
        return {};
    }
}

/**
 * Geocodes a 6-digit Indian PIN code to Latitude and Longitude
 * Uses Nominatim OpenStreetMap API
 */
async function geocodePin(pin) {
    try {
        console.log(`Geocoding PIN: ${pin}...`);
        
        // 1. Primary: Nominatim with 'q' parameter (very reliable for most PINs)
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${pin}+India&format=json&limit=1`;
        const nomResponse = await fetch(nominatimUrl);
        const nomData = await nomResponse.json();
        
        if (nomData && nomData.length > 0) {
            return {
                lat: parseFloat(nomData[0].lat),
                lon: parseFloat(nomData[0].lon),
                display_name: nomData[0].display_name,
                method: 'nominatim-direct'
            };
        }

        // 2. Secondary: Fallback to Indian Post API to get district, then geocode the district
        // This handles cases where Nominatim doesn't recognize the specific PIN but knows the district
        console.log(`Direct geocoding failed for ${pin}. Trying district fallback...`);
        const postApiUrl = `https://api.postalpincode.in/pincode/${pin}`;
        const postResponse = await fetch(postApiUrl);
        const postData = await postResponse.json();

        if (postData && postData[0] && postData[0].Status === "Success") {
            const district = postData[0].PostOffice[0].District;
            const state = postData[0].PostOffice[0].State;
            console.log(`Found district for ${pin}: ${district}, ${state}. Geocoding district...`);
            
            const distUrl = `https://nominatim.openstreetmap.org/search?q=${district}+${state}+India&format=json&limit=1`;
            const distRes = await fetch(distUrl);
            const distData = await distRes.json();
            
            if (distData && distData.length > 0) {
                return {
                    lat: parseFloat(distData[0].lat),
                    lon: parseFloat(distData[0].lon),
                    display_name: `${district}, ${state} (via PIN ${pin})`,
                    method: 'district-fallback'
                };
            }
        }
    } catch (error) {
        console.error("Geocoding error:", error);
    }
    return null;
}

async function fallbackToIpDetection(isManual = false) {
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        if (!data.error) {
            if (isManual) {
                const categoryVal = document.getElementById('categorySelect')?.value || "";
                await searchNearbyCenters(data.latitude, data.longitude, 100, categoryVal);
                return;
            }

            handleLocationData({ 
                lat: data.latitude, 
                lon: data.longitude, 
                city: data.city, 
                region: data.region, 
                zip: data.postal,
                method: 'ipapi.co' 
            });
        }
    } catch (error) {
        console.error("Error during IP detection fallback:", error);
    }
}

function handleLocationData(location) {
    console.log("Handling location data:", location);
    sessionStorage.setItem('userLocation', JSON.stringify(location));
    updateUIWithLocation(location);
}

function updateUIWithLocation(location) {
    const pinInput = document.getElementById('pinInput');
    
    if (pinInput && location.zip) {
        // Clean the PIN code
        const cleanPin = location.zip.split(';')[0].trim();
        pinInput.value = cleanPin;
        
        // Auto-search if PIN and coordinates are detected
        const categoryVal = document.getElementById('categorySelect')?.value || "";
        if (location.lat && location.lon) {
            console.log(`Auto-searching for centers near coordinates: ${location.lat}, ${location.lon}`);
            searchNearbyCenters(location.lat, location.lon, 500, categoryVal, location.city || "your area");
        } else {
            console.log(`Auto-searching for centers in PIN: ${cleanPin}`);
            searchCentersByPin(cleanPin, location, categoryVal); 
        }
    }
}

function showSimpleToast(message, type = "info") {
    const existingToast = document.querySelector('.location-toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `location-toast ${type}`;
    toast.innerHTML = `
        <i class="${type === 'error' ? 'ri-error-warning-fill' : 'ri-information-fill'}" style="color: ${type === 'error' ? '#ef4444' : 'var(--primary)'};"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, 5000);
}

function showLocationToast(location, count) {
    if (count <= 0) return;
    const cityName = location.city || "your area";
    const existingToast = document.querySelector('.location-toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = 'location-toast';
    toast.innerHTML = `
        <i class="ri-map-marker-fill" style="color: var(--primary);"></i>
        <span>Found <strong>${count}</strong> centers near <strong>${cityName}</strong></span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, 8000);
}
