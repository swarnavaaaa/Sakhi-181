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
                performUnifiedSearch({ pin: pinVal, category: categoryVal, source: 'manual-pin' });
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

/**
 * Unified search function that handles Proximity, PIN matching, and District fallbacks
 */
async function performUnifiedSearch({ lat = null, lon = null, pin = null, category = "", source = 'auto' }) {
    if (!supabaseClient) {
        showSimpleToast("Database service not ready.", "error");
        return;
    }

    const resultsContainer = document.getElementById('searchResultsContainer');
    const resultsList = document.getElementById('centersResultsList');
    const searchBtn = document.querySelector('.hero-card form button[type="submit"]');
    
    if (!resultsContainer || !resultsList) return;

    // UI Feedback
    let statusText = "Searching for Sakhi Centers...";
    if (pin) statusText = `Searching for centers matching PIN <strong>${pin}</strong>...`;
    else if (lat && lon) statusText = "Finding Sakhi Centers near you...";

    resultsList.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
        <i class="ri-loader-4-line ri-spin" style="font-size: 2.5rem; display: block; margin-bottom: 1rem; color: var(--primary);"></i>
        ${statusText}
    </div>`;
    resultsContainer.style.display = 'block';
    
    setTimeout(() => {
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);

    try {
        // 1. Fetch All Centers (Manageable size for state-level data)
        const { data: allCenters, error } = await supabaseClient.from('centers').select('*');
        if (error) throw error;
        if (!allCenters || allCenters.length === 0) {
            resultsList.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">No center data found in database.</div>';
            return;
        }

        let results = [];
        let searchCoords = { lat, lon };

        // 2. If we have a PIN but no coordinates, try to geocode it
        if (pin && !searchCoords.lat) {
            const geocoded = await geocodePin(pin);
            if (geocoded) {
                searchCoords.lat = geocoded.lat;
                searchCoords.lon = geocoded.lon;
            }
        }

        // 3. Proximity Search (if we have coordinates)
        if (searchCoords.lat && searchCoords.lon) {
            allCenters.forEach(center => {
                const cLat = center.latitude || center.Latitude;
                const cLon = center.longitude || center.Longitude;
                if (cLat && cLon) {
                    center.distance = calculateDistance(searchCoords.lat, searchCoords.lon, parseFloat(cLat), parseFloat(cLon));
                }
            });
            // Add those within 500km
            const proximityResults = allCenters.filter(c => c.distance !== undefined && c.distance <= 500);
            results.push(...proximityResults);
        }

        // 4. PIN/Address/District matching (Crucial for records with missing coordinates)
        if (pin) {
            console.log(`Performing keyword and district matching for PIN: ${pin}`);
            
            // a) Direct PIN/Address match
            const keywordResults = allCenters.filter(c => 
                (c.Pincode && c.Pincode.toString().includes(pin)) || 
                (c.Address && c.Address.toString().includes(pin))
            );
            results.push(...keywordResults);

            // b) PIN Prefix match (First 4 digits) - Very effective for neighboring Indian areas
            const pinPrefix = pin.substring(0, 4);
            if (pinPrefix.length === 4) {
                console.log(`Searching for neighbors with PIN prefix: ${pinPrefix}`);
                const prefixResults = allCenters.filter(c => 
                    (c.Pincode && c.Pincode.toString().startsWith(pinPrefix)) ||
                    (c.Address && c.Address.toString().includes(pinPrefix))
                );
                results.push(...prefixResults);
            }

            // c) District match
            try {
                const postApiUrl = `https://api.postalpincode.in/pincode/${pin}`;
                const postResponse = await fetch(postApiUrl);
                const postData = await postResponse.json();

                if (postData && postData[0] && postData[0].Status === "Success") {
                    const district = postData[0].PostOffice[0].District;
                    console.log(`Including results for district: ${district}`);
                    const districtResults = allCenters.filter(c => 
                        c.District && c.District.toLowerCase() === district.toLowerCase()
                    );
                    results.push(...districtResults);
                }
            } catch (e) {
                console.error("District lookup failed:", e);
            }
        }

        // 5. Deduplicate results by ID
        const resultsMap = new Map();
        results.forEach(c => {
            if (!resultsMap.has(c.id)) {
                resultsMap.set(c.id, JSON.parse(JSON.stringify(c))); // Clone to avoid side effects
            }
        });
        
        let finalResults = Array.from(resultsMap.values());

        // 6. "Virtual Geocoding" for results missing coordinates
        // If we have search coordinates, we try to geocode the PIN of the matching centers 
        // to get an estimated distance for sorting.
        if (searchCoords.lat && searchCoords.lon && finalResults.length > 0) {
            const missingCoords = finalResults.filter(c => !c.latitude && !c.Latitude);
            if (missingCoords.length > 0) {
                console.log(`Estimating locations for ${missingCoords.length} centers...`);
                // Limit to 10 to avoid rate limits
                for (const c of missingCoords.slice(0, 10)) {
                    const cPin = c.Pincode || extractPinFromAddress(c.Address);
                    if (cPin) {
                        const coords = await geocodePin(cPin);
                        if (coords) {
                            c.tempLat = coords.lat;
                            c.tempLon = coords.lon;
                            c.distance = calculateDistance(searchCoords.lat, searchCoords.lon, coords.lat, coords.lon);
                        }
                    }
                }
            }
        }

        // 7. Final Sort (Closest First)
        finalResults.sort((a, b) => {
            const distA = a.distance !== undefined ? a.distance : 999999;
            const distB = b.distance !== undefined ? b.distance : 999999;
            if (distA !== distB) return distA - distB;
            return a.Name.localeCompare(b.Name);
        });

        // 8. Final Category Filtering
        if (category) {
            finalResults = finalResults.filter(c => c.Category === category);
        }

        if (finalResults.length > 0) {
            renderCenters(finalResults);
            const label = pin ? `near PIN ${pin}` : "your area";
            showLocationToast({ city: label }, finalResults.length);
        } else {
            resultsList.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
                <i class="ri-map-pin-user-line" style="font-size: 3rem; display: block; margin-bottom: 1.5rem; color: var(--text-light);"></i>
                <h3>No centers found in this area</h3>
                <p style="margin-top: 1rem;">We couldn't find any Sakhi Centers matching your search criteria.</p>
                <p style="font-size: 0.85rem; margin-top: 0.5rem;">Try searching for your District name or a nearby PIN code.</p>
            </div>`;
        }
    } catch (err) {
        console.error("Unified search error:", err);
        resultsList.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 3rem;">
            <i class="ri-error-warning-line" style="font-size: 2.5rem; display: block; margin-bottom: 1rem;"></i>
            <strong>Search Error</strong>
            <p style="margin-top: 0.5rem;">${err.message || 'Failed to complete search'}</p>
        </div>`;
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
                        <span><strong>Address:</strong> ${center["Address"]}<br><strong>Pincode:</strong> ${center["Pincode"] || 'N/A'} ${center["District"] ? '(' + center["District"] + ')' : ''}</span>
                    </div>
                    ${center["Phone Number"] ? `
                        <div class="center-info-row">
                            <i class="ri-phone-line"></i>
                            <span><strong>Phone:</strong> <a href="tel:${center["Phone Number"]}" class="contact-link">${center["Phone Number"]}</a></span>
                        </div>
                    ` : ''}
                    ${center["Point of Contact"] ? `
                        <div class="center-info-row">
                            <i class="ri-user-voice-line"></i>
                            <span><strong>Contact Person:</strong> ${center["Point of Contact"]}</span>
                        </div>
                    ` : ''}
                    ${center["Email"] ? `
                        <div class="center-info-row">
                            <i class="ri-mail-line"></i>
                            <span><strong>Email:</strong> <a href="mailto:${center["Email"]}" class="contact-link">${center["Email"]}</a></span>
                        </div>
                    ` : ''}
                </div>

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
                            await performUnifiedSearch({ lat: latitude, lon: longitude, category: categoryVal, source: 'manual-location' });
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
                await performUnifiedSearch({ lat: data.latitude, lon: data.longitude, pin: data.postal, category: categoryVal, source: 'manual-location' });
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
        performUnifiedSearch({ lat: location.lat, lon: location.lon, pin: cleanPin, category: categoryVal, source: 'auto' });
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

function extractPinFromAddress(address) {
    if (!address) return null;
    const match = address.match(/\b\d{6}\b/);
    return match ? match[0] : null;
}
