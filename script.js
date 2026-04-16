// Supabase Configuration
// USER: Replace these with your actual Supabase project credentials
const SUPABASE_URL = 'https://ifasovihhhxznuvdgoxn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmYXNvdmloaGh4em51dmRnb3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNDIzMDgsImV4cCI6MjA5MTcxODMwOH0.iu5satWImQmodqy4FTXxWL6RZEUSVs22Y8Hnfh6753E';

let supabaseClient = null;

if (typeof supabase !== 'undefined') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

document.addEventListener('DOMContentLoaded', () => {
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
            const pinInput = searchForm.querySelector('input[placeholder="Enter 6-digit PIN"]');
            if (pinInput && pinInput.value.length === 6) {
                searchCentersByPin(pinInput.value);
            } else {
                alert("Please enter a valid 6-digit PIN code.");
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

    // Automatic Location Detection
    initLocationDetection();
});

async function searchCentersByPin(pin) {
    if (!supabaseClient) {
        console.error("Supabase client not initialized.");
        return;
    }

    const cleanPin = pin.toString().trim();
    if (cleanPin.length !== 6) {
        console.warn(`Invalid PIN length: ${cleanPin.length}. Expected 6.`);
        return;
    }

    const resultsContainer = document.getElementById('searchResultsContainer');
    const resultsList = document.getElementById('centersResultsList');
    
    if (resultsContainer && resultsList) {
        resultsList.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">Searching for centers in PIN ' + cleanPin + '...</div>';
        resultsContainer.style.display = 'block';
        resultsContainer.scrollIntoView({ behavior: 'smooth' });

        try {
            const { data, error } = await supabaseClient
                .from('centers')
                .select('*')
                .eq('Pin Code', cleanPin);

            if (error) throw error;

            if (data && data.length > 0) {
                renderCenters(data);
            } else {
                resultsList.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-muted);">
                    <i class="ri-error-warning-line" style="font-size: 2rem; display: block; margin-bottom: 1rem;"></i>
                    No centers found for PIN code <strong>${cleanPin}</strong>. Please try a nearby PIN or contact the helpline.
                </div>`;
            }
        } catch (err) {
            console.error("Error fetching centers:", err);
            resultsList.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 2rem;">Failed to fetch centers. Please check your connection.</div>';
        }
    }
}

function renderCenters(centers) {
    const resultsList = document.getElementById('centersResultsList');
    resultsList.innerHTML = '';

    centers.forEach(center => {
        const services = center["Services offered"] ? center["Services offered"].split(',').map(s => `<span class="service-tag">${s.trim()}</span>`).join('') : '';
        
        const centerHtml = `
            <div class="center-item">
                <h4>
                    ${center["Name"]}
                    <span class="center-type-badge">${center["District"] || 'OSC'}</span>
                </h4>
                <p style="font-size: 0.8rem; color: var(--primary); margin-bottom: 1rem;">${center["Category"] || 'Support Center'}</p>
                
                <div class="center-details">
                    <div class="center-info-row">
                        <i class="ri-map-pin-2-line"></i>
                        <span>${center["Address"]}<br><strong>${center["District"] || ''}</strong></span>
                    </div>
                    ${center["OSC Phone number"] ? `
                        <div class="center-info-row">
                            <i class="ri-phone-line"></i>
                            <a href="tel:${center["OSC Phone number"]}">${center["OSC Phone number"]}</a>
                        </div>
                    ` : ''}
                    ${center["Name of CA"] ? `
                        <div class="center-info-row">
                            <i class="ri-user-voice-line"></i>
                            <span>CA: ${center["Name of CA"]}</span>
                        </div>
                    ` : ''}
                    ${center["Email"] ? `
                        <div class="center-info-row">
                            <i class="ri-mail-line"></i>
                            <a href="mailto:${center["Email"]}">${center["Email"]}</a>
                        </div>
                    ` : ''}
                </div>

                ${services ? `
                    <div class="center-services">
                        <p style="font-size: 0.75rem; font-weight: 700; margin-bottom: 0.5rem; text-transform: uppercase; color: var(--text-muted);">Services Provided</p>
                        ${services}
                    </div>
                ` : ''}

                ${center["Google link"] ? `
                    <a href="${center["Google link"]}" target="_blank" class="btn-link" style="margin-top: 1.5rem; display: inline-flex; font-size: 0.8rem;">
                        View on Google Maps <i class="ri-map-pin-line"></i>
                    </a>
                ` : ''}
            </div>
        `;
        resultsList.insertAdjacentHTML('beforeend', centerHtml);
    });
}

function initLocationDetection() {
    console.log("Initializing location detection...");
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                console.log(`Coordinates detected: ${latitude}, ${longitude}`);
                
                // Try reverse geocoding to get PIN code
                const geoData = await reverseGeocode(latitude, longitude);
                
                handleLocationData({ 
                    lat: latitude, 
                    lon: longitude, 
                    zip: geoData.postcode,
                    city: geoData.city || geoData.town || geoData.village,
                    method: 'browser' 
                });
            },
            (error) => {
                console.warn(`Geolocation failed: ${error.message}. Falling back to IP detection.`);
                fallbackToIpDetection();
            },
            { timeout: 8000, enableHighAccuracy: true }
        );
    } else {
        console.warn("Geolocation API not supported. Falling back to IP detection.");
        fallbackToIpDetection();
    }
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

async function fallbackToIpDetection() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        if (!data.error) {
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
    const pinInput = document.querySelector('input[placeholder="Enter 6-digit PIN"]');
    
    if (pinInput && location.zip) {
        // Clean the PIN code (sometimes Nominatim returns things like "110054; 110055")
        const cleanPin = location.zip.split(';')[0].trim();
        pinInput.value = cleanPin;
        
        // Auto-search if PIN is detected
        console.log(`Auto-searching for centers in PIN: ${cleanPin}`);
        searchCentersByPin(cleanPin); 
    }

    const districtSelect = document.querySelector('.hero-card select');
    if (districtSelect && location.city) {
        Array.from(districtSelect.options).forEach(option => {
            if (option.text.toLowerCase().includes(location.city.toLowerCase())) {
                districtSelect.value = option.text;
            }
        });
    }

    showLocationToast(location);
}

function showLocationToast(location) {
    const cityName = location.city || "your area";
    // Check if toast already exists
    if (document.querySelector('.location-toast')) return;

    const toast = document.createElement('div');
    toast.className = 'location-toast';
    toast.innerHTML = `
        <i class="ri-map-marker-fill" style="color: #ef4444;"></i>
        <span>Found centers near <strong>${cityName}</strong> (${location.zip || 'Detected Location'})</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, 8000);
}
