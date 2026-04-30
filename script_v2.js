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

    // Populate Dropdowns
    if (supabaseClient) {
        populateCategories();
        populateDistricts();
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
            const districtSelect = document.getElementById('districtSelect');
            if (!pinInput) return;
            
            const pinVal = pinInput.value.trim();
            const categoryVal = categorySelect ? categorySelect.value : "";
            const districtVal = districtSelect ? districtSelect.value : "";
            
            if (!supabaseClient) {
                showSimpleToast("Connecting to database... Please try again in 2 seconds.", "info");
                return;
            }

            if (pinVal.length === 6 && /^\d+$/.test(pinVal)) {
                performUnifiedSearch({ pin: pinVal, category: categoryVal, district: districtVal, source: 'manual-pin' });
            } else if (pinVal === "" && (categoryVal !== "" || districtVal !== "")) {
                // Allow searching by category/district only if PIN is empty
                performUnifiedSearch({ category: categoryVal, district: districtVal, source: 'filter-only' });
            } else {
                showSimpleToast("Please enter a valid 6-digit numeric PIN code or select a filter.", "error");
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

    // Handle same-page category triggers (Resources page)
    document.querySelectorAll('.category-trigger').forEach(trigger => {
        trigger.addEventListener('click', () => {
            const category = trigger.getAttribute('data-category');
            if (category) {
                // If we have stored location, use it. Otherwise just search by category globally.
                const storedLocation = sessionStorage.getItem('userLocation');
                let searchParams = { category, source: 'resource-card' };
                
                if (storedLocation) {
                    const loc = JSON.parse(storedLocation);
                    searchParams.lat = loc.lat;
                    searchParams.lon = loc.lon;
                    searchParams.pin = loc.zip;
                }
                
                performUnifiedSearch(searchParams);
            }
        });
    });

    // Handle URL parameters for category search
    const urlParams = new URLSearchParams(window.location.search);
    const urlCategory = urlParams.get('category');
    const categorySelect = document.getElementById('categorySelect');
    
    // Check if we are on resources.html to handle automatic trigger
    if (urlCategory && window.location.pathname.includes('resources.html')) {
        setTimeout(() => {
            const storedLocation = sessionStorage.getItem('userLocation');
            let searchParams = { category: urlCategory, source: 'url-param' };
            if (storedLocation) {
                const loc = JSON.parse(storedLocation);
                searchParams.lat = loc.lat;
                searchParams.lon = loc.lon;
                searchParams.pin = loc.zip;
            }
            performUnifiedSearch(searchParams);
        }, 1000);
    }
    
    if (urlCategory && categorySelect && !window.location.pathname.includes('resources.html')) {
        console.log(`URL category detected: ${urlCategory}. Waiting for dropdown population...`);
        // We need to wait for categories to be populated via populateCategories()
        let attempts = 0;
        const checkInterval = setInterval(() => {
            attempts++;
            if (categorySelect.options.length > 1 || attempts > 20) {
                clearInterval(checkInterval);
                
                // Try to find a partial or exact match in the dropdown options
                let targetValue = urlCategory;
                const options = Array.from(categorySelect.options);
                const match = options.find(opt => 
                    opt.value.toLowerCase() === urlCategory.toLowerCase() || 
                    opt.value.toLowerCase().includes(urlCategory.toLowerCase())
                );
                
                if (match) {
                    targetValue = match.value;
                    categorySelect.value = targetValue;
                    console.log(`Pre-selected category: ${targetValue}`);
                    
                    // If we have stored location, search immediately
                    const storedLocation = sessionStorage.getItem('userLocation');
                    if (storedLocation) {
                        const loc = JSON.parse(storedLocation);
                        performUnifiedSearch({ lat: loc.lat, lon: loc.lon, pin: loc.zip, category: targetValue, source: 'url-param' });
                    } else {
                        // Prompt for location if not stored
                        showSimpleToast(`Searching for ${targetValue}. Please enter your PIN or use Current Location.`, "info");
                        const searchSection = document.getElementById('searchResultsContainer');
                        if (searchSection) searchSection.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            }
        }, 300);
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
 * Fetches unique districts from the database and populates the dropdown
 */
async function populateDistricts() {
    const districtSelect = document.getElementById('districtSelect');
    if (!districtSelect || !supabaseClient) return;

    try {
        console.log("Fetching unique districts...");
        const { data, error } = await supabaseClient
            .from('centers')
            .select('District');

        if (error) throw error;

        if (data) {
            const districts = [...new Set(data.map(item => item.District))]
                .filter(dist => dist && dist.trim() !== "")
                .sort();

            const fragment = document.createDocumentFragment();
            districts.forEach(dist => {
                const option = document.createElement('option');
                option.value = dist;
                option.textContent = dist;
                fragment.appendChild(option);
            });
            
            requestAnimationFrame(() => {
                districtSelect.appendChild(fragment);
            });
        }
    } catch (err) {
        console.error("Error populating districts:", err);
    }
}

/**
 * Unified search function that handles Proximity, PIN matching, and District fallbacks
 */
/**
 * Helper to get property from object regardless of case
 */
function getProp(obj, key) {
    if (!obj) return undefined;
    if (obj[key] !== undefined) return obj[key];
    const lowerKey = key.toLowerCase();
    for (let k in obj) {
        if (k.toLowerCase() === lowerKey) return obj[k];
    }
    return undefined;
}

/**
 * Unified search function that handles Proximity, PIN matching, and District fallbacks
 */
async function performUnifiedSearch({ lat = null, lon = null, pin = null, category = "", district = "", source = 'auto', listId = 'centersResultsList', containerId = 'searchResultsContainer' }) {
    if (!supabaseClient) {
        showSimpleToast("Database service not ready.", "error");
        return;
    }

    const resultsContainer = document.getElementById(containerId);
    const resultsList = document.getElementById(listId);
    
    if (!resultsContainer || !resultsList) {
        if (window.location.pathname.includes('resources.html')) {
            return performUnifiedSearch({ lat, lon, pin, category, source, listId: 'resourceResultsList', containerId: 'resourceResultsContainer' });
        }
        return;
    }

    // UI Feedback
    let statusText = "Searching for Sakhi Centers...";
    if (category && district) statusText = `Finding <strong>${category}</strong> centers in <strong>${district}</strong>...`;
    else if (category) statusText = `Finding <strong>${category}</strong> centers...`;
    else if (district) statusText = `Finding centers in <strong>${district}</strong>...`;
    else if (pin) statusText = `Searching for centers matching PIN <strong>${pin}</strong>...`;

    resultsList.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
        <i class="ri-loader-4-line ri-spin" style="font-size: 2.5rem; display: block; margin-bottom: 1rem; color: var(--primary);"></i>
        ${statusText}
    </div>`;
    resultsContainer.style.display = 'block';
    
    setTimeout(() => {
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    try {
        // 1. Fetch all centers
        console.log("Fetching centers from Supabase...");
        const { data: allCenters, error } = await supabaseClient.from('centers').select('*');
        
        if (error) {
            console.error("Supabase error:", error);
            throw new Error(`Database connection failed: ${error.message}`);
        }
        
        if (!allCenters || allCenters.length === 0) {
            console.warn("No data found in 'centers' table.");
            resultsList.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
                <i class="ri-database-2-line" style="font-size: 3rem; display: block; margin-bottom: 1.5rem; color: var(--text-light);"></i>
                <h3>Database is empty</h3>
                <p style="margin-top: 1rem;">No center data has been found in the database. Please ensure your Supabase table is populated.</p>
            </div>`;
            return;
        }

        console.log(`Successfully fetched ${allCenters.length} centers.`);

        let results = [];
        let searchCoords = { lat, lon };
        let detectedDistrict = null;

        // 2. Determine search coordinates and district from PIN if needed
        if (pin) {
            // Try geocoding the PIN
            const geocoded = await geocodePin(pin);
            if (geocoded) {
                if (!searchCoords.lat) {
                    searchCoords.lat = geocoded.lat;
                    searchCoords.lon = geocoded.lon;
                }
                if (geocoded.display_name && geocoded.display_name.includes(',')) {
                    detectedDistrict = geocoded.display_name.split(',')[0].trim();
                }
            }
            
            // Try finding the district from the PIN API regardless of geocoding success (as extra fallback)
            try {
                const postApiUrl = `https://api.postalpincode.in/pincode/${pin}`;
                const postRes = await fetch(postApiUrl);
                const postData = await postRes.json();
                if (postData && postData[0] && postData[0].Status === "Success") {
                    const firstMatch = postData[0].PostOffice[0];
                    detectedDistrict = firstMatch.District;
                    console.log(`District detected from PIN: ${detectedDistrict}`);
                }
            } catch (e) { console.warn("PIN API district lookup failed", e); }
        }

        // 1. Process search term
        const cleanPinSearch = pin ? pin.toString().replace(/\D/g, '') : "";

        // 2. District Coordinate Fallback (Telangana Centroids)
        const DISTRICT_COORDS = {
            "hyderabad": { lat: 17.3850, lon: 78.4867 },
            "rangareddy": { lat: 17.3850, lon: 78.4867 }, // Overlaps with Hyderabad
            "medchal": { lat: 17.5500, lon: 78.4500 },
            "medchal-malkajgiri": { lat: 17.5500, lon: 78.4500 },
            "vikarabad": { lat: 17.3300, lon: 77.9000 },
            "sangareddy": { lat: 17.6100, lon: 78.0800 },
            "medak": { lat: 18.0400, lon: 78.2600 },
            "siddipet": { lat: 18.1000, lon: 78.8500 },
            "yadadri": { lat: 17.5100, lon: 78.9400 },
            "nalaonda": { lat: 17.0500, lon: 79.2700 },
            "mahabubnagar": { lat: 16.7300, lon: 77.9800 }
        };

        // 2. Build a local coordinate map from centers that HAVE data
        const pinCoordMap = {};
        allCenters.forEach(c => {
            const lat = parseFloat(getProp(c, "latitude"));
            const lon = parseFloat(getProp(c, "longitude"));
            const pinCode = (getProp(c, "Pincode") || "").toString().replace(/\D/g, '');
            if (!isNaN(lat) && !isNaN(lon) && pinCode) {
                if (!pinCoordMap[pinCode]) pinCoordMap[pinCode] = { lat, lon };
            }
        });

        console.log(`Starting search. Total centers: ${allCenters.length}. PIN Map: ${Object.keys(pinCoordMap).length}`);
        
        allCenters.forEach(center => {
            // A. Coordinate access (with double fallback: PIN map -> District Centroid)
            const latVal = getProp(center, "latitude");
            const lonVal = getProp(center, "longitude");
            const pinCode = (getProp(center, "Pincode") || "").toString().replace(/\D/g, '');
            const distName = (getProp(center, "District") || "").toLowerCase().trim();
            
            let cLat = latVal ? parseFloat(latVal) : NaN;
            let cLon = lonVal ? parseFloat(lonVal) : NaN;
            
            // Fallback 1: PIN Match
            if (isNaN(cLat) && pinCode && pinCoordMap[pinCode]) {
                cLat = pinCoordMap[pinCode].lat;
                cLon = pinCoordMap[pinCode].lon;
            }
            
            // Fallback 2: District Centroid Match
            if (isNaN(cLat) && distName && DISTRICT_COORDS[distName]) {
                cLat = DISTRICT_COORDS[distName].lat;
                cLon = DISTRICT_COORDS[distName].lon;
            } else if (isNaN(cLat) && distName) {
                // Fuzzy match for district names
                for (let d in DISTRICT_COORDS) {
                    if (distName.includes(d) || d.includes(distName)) {
                        cLat = DISTRICT_COORDS[d].lat;
                        cLon = DISTRICT_COORDS[d].lon;
                        break;
                    }
                }
            }
            
            if (searchCoords.lat && searchCoords.lon && !isNaN(cLat) && !isNaN(cLon)) {
                center.distance = calculateDistance(searchCoords.lat, searchCoords.lon, cLat, cLon);
            } else {
                center.distance = undefined;
            }

            // B. Category match
            const cCat = getProp(center, "Category") || "";
            const categoryMatch = !category || (cCat && (
                cCat.toLowerCase() === category.toLowerCase() || 
                cCat.toLowerCase().includes(category.toLowerCase())
            ));

            // B2. District match (explicit filter)
            const districtMatch = !district || (distName && (
                distName.toLowerCase() === district.toLowerCase() || 
                distName.toLowerCase().includes(district.toLowerCase())
            ));

            // C. In-Range Check (Strict 100km)
            const isWithin100km = center.distance !== undefined && center.distance <= 100;

            // D. Matches (PIN, District, Universal)
            const cleanCenterPin = (getProp(center, "Pincode") || "").toString().replace(/\D/g, '');
            const matchesPinSearch = cleanPinSearch && cleanCenterPin && (cleanCenterPin.includes(cleanPinSearch) || cleanPinSearch.includes(cleanCenterPin));
            
            const matchesDetectedDistrict = detectedDistrict && distName && (distName.includes(detectedDistrict.toLowerCase()) || detectedDistrict.toLowerCase().includes(distName));

            const centerJson = JSON.stringify(center).replace(/\D/g, '');
            const matchesUniversal = cleanPinSearch && centerJson.includes(cleanPinSearch);

            // E. Final Inclusion Logic
            if (categoryMatch && districtMatch) {
                // We include the center if:
                // 1. It's within 100km of the search point (Proximity)
                // 2. It matches the PIN code searched
                // 3. It matches a district detected from the PIN
                // 4. It matches a universal text search
                // 5. OR if the user specifically selected a District/Category filter (since they matched above)
                // 6. OR if no search criteria were provided at all (Show all)
                if (isWithin100km || matchesPinSearch || matchesDetectedDistrict || matchesUniversal || 
                    district !== "" || category !== "" || (!pin && !searchCoords.lat)) {
                    center.matchScore = 0;
                    if (matchesPinSearch) center.matchScore += 1000;
                    if (isWithin100km) center.matchScore += 500;
                    if (district !== "" && districtMatch) center.matchScore += 400;
                    if (matchesDetectedDistrict) center.matchScore += 300;
                    results.push(center);
                }
            }
        });

        // 4. Deduplicate
        const seen = new Set();
        let finalResults = results.filter(el => {
            const id = el.id || getProp(el, "Name") || JSON.stringify(el);
            const duplicate = seen.has(id);
            seen.add(id);
            return !duplicate;
        });

        // 5. Final Sort (Distance first, then Score, then Name)
        finalResults.sort((a, b) => {
            const distA = a.distance !== undefined ? a.distance : 1000000;
            const distB = b.distance !== undefined ? b.distance : 1000000;
            
            // Primary Sort: Physical Distance (Closer is better)
            if (distA !== distB) return distA - distB;
            
            // Secondary Sort: Relevance Score (PIN match, District match, etc.)
            if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
            
            // Tertiary Sort: Alphabetical Name
            const nameA = getProp(a, "Name") || "";
            const nameB = getProp(b, "Name") || "";
            return nameA.localeCompare(nameB);
        });

        // 6. UI Render
        if (finalResults.length > 0) {
            renderCenters(finalResults, listId);
            const label = category || (pin ? `near ${pin}` : "your area");
            showLocationToast({ city: label }, finalResults.length);
        } else {
            console.log("No matching centers found after filtering.");
            resultsList.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
                <i class="ri-map-pin-user-line" style="font-size: 3.5rem; display: block; margin-bottom: 1.5rem; color: var(--text-light); opacity: 0.6;"></i>
                <h3 style="color: var(--text-main);">No centers found</h3>
                <p style="margin-top: 1rem; max-width: 400px; margin-left: auto; margin-right: auto;">We couldn't find any <strong>${category || 'centers'}</strong> matching your criteria in this area.</p>
                <div style="margin-top: 2rem; display: flex; flex-direction: column; gap: 0.5rem; align-items: center;">
                    <p style="font-size: 0.85rem; font-weight: 600;">Why did this happen?</p>
                    <ul style="font-size: 0.85rem; list-style: none; padding: 0; text-align: left; opacity: 0.8;">
                        <li>• Database columns might have changed</li>
                        <li>• Location geocoding is temporarily unavailable</li>
                        <li>• No centers exist in the database for this PIN code</li>
                    </ul>
                    <button onclick="location.reload()" style="margin-top: 1.5rem; background: var(--primary); color: white; border: none; padding: 0.5rem 1.5rem; border-radius: 50px; font-weight: 600; cursor: pointer;">Refresh Page</button>
                </div>
            </div>`;
        }
    } catch (err) {
        console.error("Search error:", err);
        resultsList.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 3rem;">
            <i class="ri-error-warning-line" style="font-size: 3rem; display: block; margin-bottom: 1rem;"></i>
            <strong>Search Service Unavailable</strong>
            <p style="margin-top: 0.5rem;">${err.message || "An unexpected error occurred. Please check your internet connection and try again."}</p>
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

function renderCenters(centers, listId = 'centersResultsList') {
    const fragment = document.createDocumentFragment();

    centers.forEach((center, index) => {
        const hasDistance = center.distance !== undefined && !isNaN(center.distance);
        const distanceText = hasDistance ? `${Math.round(center.distance * 10) / 10} km away` : (getProp(center, "District") || 'Support Center');
        
        // Mark the first item as the best/closest match
        const isTopMatch = index === 0;
        const badgeLabel = hasDistance ? "Closest to your location" : "Best match for your search";
        
        const centerHtml = `
            <div class="center-item ${isTopMatch ? 'closest-highlight' : ''}">
                ${isTopMatch ? `<div class="closest-badge"><i class="ri-flashlight-fill"></i> ${badgeLabel}</div>` : ''}
                <div class="center-header">
                    <h4>${getProp(center, "Name")}</h4>
                    <span class="center-type-badge ${hasDistance ? 'distance-badge' : ''}">
                        <i class="${hasDistance ? 'ri-map-pin-range-line' : 'ri-map-pin-2-line'}"></i> ${distanceText}
                    </span>
                </div>
                <p style="font-size: 0.8rem; color: var(--primary); font-weight: 600; margin-bottom: 1rem;">${getProp(center, "Category") || 'Sakhi One Stop Centre'}</p>
                
                <div class="center-details">
                    <div class="center-info-row">
                        <i class="ri-map-pin-2-line"></i>
                        <span><strong class="info-label">Address:</strong> ${center["Address"]}</span>
                    </div>
                    ${center["Location"] ? `
                        <div class="center-info-row">
                            <i class="ri-navigation-line"></i>
                            <span><strong class="info-label">Location:</strong> 
                                <a href="${(center["Location"] && center["Location"].startsWith('http')) ? center["Location"] : (center["Google link"] || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(center['Location'])}`)}" 
                                   target="_blank" class="contact-link">${center["Location"] && center["Location"].startsWith('http') ? 'View on Map' : center["Location"]}</a>
                            </span>
                        </div>
                    ` : ''}
                    <div class="center-info-row">
                        <i class="ri-hashtag"></i>
                        <span><strong class="info-label">Pincode:</strong> ${center["Pincode"] || 'N/A'} ${center["District"] ? '(' + center["District"] + ')' : ''}</span>
                    </div>
                    ${center["Phone Number"] ? `
                        <div class="center-info-row">
                            <i class="ri-phone-line"></i>
                            <span><strong class="info-label">Phone:</strong> <a href="tel:${center["Phone Number"]}" class="contact-link">${center["Phone Number"]}</a></span>
                        </div>
                    ` : ''}
                    ${center["Point of Contact"] ? `
                        <div class="center-info-row">
                            <i class="ri-user-voice-line"></i>
                            <span><strong class="info-label">Contact Person:</strong> ${center["Point of Contact"]}</span>
                        </div>
                    ` : ''}
                    ${center["Email"] ? `
                        <div class="center-info-row">
                            <i class="ri-mail-line"></i>
                            <span><strong class="info-label">Email:</strong> <a href="mailto:${center["Email"]}" class="contact-link">${center["Email"]}</a></span>
                        </div>
                    ` : ''}
                    ${center["Last verified date"] ? `
                        <div class="center-info-row" style="opacity: 0.8; font-size: 0.8rem; margin-top: 0.5rem; border-top: 1px dashed #e2e8f0; padding-top: 0.5rem;">
                            <i class="ri-calendar-check-line" style="color: #059669;"></i>
                            <span><strong class="info-label">Last Verified:</strong> ${center["Last verified date"]}</span>
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
    
    const resultsList = document.getElementById(listId);
    if (resultsList) {
        resultsList.innerHTML = '';
        resultsList.appendChild(fragment);
    }
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
