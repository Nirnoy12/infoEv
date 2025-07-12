const socket = io();

let map = L.map('map').setView([0, 0], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let userMarker = null;
let evMarkers = [];
let routeControl = null;
let prevLatLng = null;
let prevTimestamp = null;

// Draw route to selected station
function drawRouteToStation(fromLatLng, toLatLng) {
    if (routeControl) {
        map.removeControl(routeControl);
    }

    routeControl = L.Routing.control({
        waypoints: [fromLatLng, toLatLng],
        routeWhileDragging: false,
        draggableWaypoints: false,
        addWaypoints: false,
        createMarker: () => null,
        lineOptions: {
            styles: [{ color: '#00aaff', opacity: 0.8, weight: 5 }]
        }
    }).addTo(map);

    routeControl.on('routingerror', function(e) {
        console.error("Routing failed:", e);
    });
}

function updateMap(lat, lon) {
    if (!userMarker) {
        userMarker = L.marker([lat, lon], {
            icon: L.icon({
                iconUrl: 'https://cdn-icons-png.flaticon.com/512/149/149059.png',
                iconSize: [30, 30]
            })
        }).addTo(map).bindPopup("🚗 You are here").openPopup();
    } else {
        userMarker.setLatLng([lat, lon]);
    }

    map.setView([lat, lon], 14);
    socket.emit('location_update', { lat, lon });
}

// Marker creation and dynamic popup
socket.on('ev_stations', (data) => {
    evMarkers.forEach(marker => map.removeLayer(marker));
    evMarkers = [];

    data.stations.forEach((s, index) => {
        const marker = L.marker([s.lat, s.lon]);

        const popupContent = `
            <div id="station-${index}">
                <b>${s.name}</b><br>
                📍 ${s.distance.toFixed(2)} km<br>
                💬 ${s.comment}<br><br>
                <button onclick="selectStation(${s.lat}, ${s.lon})">🚗 Route to here</button><br><br>
                <button onclick="optimizeStation('${s.name}', ${s.lat}, ${s.lon}, ${index})">🤖 Smart Optimize</button>
                <div id="optimize-result-${index}" style="margin-top: 8px;"></div>
            </div>
        `;

        marker.bindPopup(popupContent);
        evMarkers.push(marker);
        marker.addTo(map);
    });

    // Auto route to nearest station
    if (data.stations.length > 0 && userMarker) {
        const userLatLng = userMarker.getLatLng();
        const nearest = data.stations[0];
        drawRouteToStation(userLatLng, L.latLng(nearest.lat, nearest.lon));
    }
});

// Called when "Route to here" is clicked
function selectStation(lat, lon) {
    if (userMarker) {
        const userLatLng = userMarker.getLatLng();
        drawRouteToStation(userLatLng, L.latLng(lat, lon));
    }
}

// Called when "Smart Optimize" is clicked
function optimizeStation(name, lat, lon, index) {
    const outputDiv = document.getElementById(`optimize-result-${index}`);
    outputDiv.innerHTML = "🔄 Optimizing...";

    fetch('/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, lat, lon })
    }).then(res => res.json())
      .then(data => {
          outputDiv.innerHTML = `
              <hr>
              📊 <b>AI Insights</b><br>
              ⏱ Optimal Slot: <b>${data.slot}</b><br>
              🚗 ETA: <b>${data.eta} mins</b><br>
              🔄 Battery Swaps: <b>${data.swaps_available}</b>
          `;
      })
      .catch(err => {
          console.error("AI Error:", err);
          outputDiv.innerHTML = "❌ Optimization failed.";
      });
}

// Track speed and location
if ("geolocation" in navigator) {
    navigator.geolocation.watchPosition(
        (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            const currentTimestamp = Date.now();



            prevLatLng = L.latLng(lat, lon);
            prevTimestamp = currentTimestamp;

            updateMap(lat, lon);
        },
        (err) => alert("GPS access denied."),
        { enableHighAccuracy: true, maximumAge: 1000 }
    );
} else {
    alert("Geolocation not supported.");
}

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    // Theme toggle
    const lightBtn = document.querySelector('button[title="Light Mode"]');
    const darkBtn = document.querySelector('button[title="Dark Mode"]');

    lightBtn.addEventListener('click', () => {
        document.documentElement.style.setProperty('--bg', '#f8f9fa');
        document.documentElement.style.setProperty('--text', '#222');
        document.documentElement.style.setProperty('--muted', '#555');
        document.documentElement.style.setProperty('--primary', '#5b6fff');
        document.documentElement.style.setProperty('--accent', '#7c5fd4');
        document.documentElement.style.setProperty('--card-bg', '#fff');
        document.documentElement.style.setProperty('--stat-bg', '#f1f3f5');
        document.documentElement.style.setProperty('--stat-border', '#ced4da');
        document.documentElement.style.setProperty('--button-bg', '#4f46e5');
        document.documentElement.style.setProperty('--button-text', '#fff');
        document.documentElement.style.setProperty('--hero-desc', '#555');
    });

    darkBtn.addEventListener('click', () => {
        document.documentElement.style.setProperty('--bg', '#101322');
        document.documentElement.style.setProperty('--text', '#e6e6f0');
        document.documentElement.style.setProperty('--card-bg', '#181c2f');
        document.documentElement.style.setProperty('--stat-bg', '#181c2f');
        document.documentElement.style.setProperty('--stat-border', '#23263a');
        document.documentElement.style.setProperty('--button-bg', '#2563eb');
        document.documentElement.style.setProperty('--button-text', '#fff');
        document.documentElement.style.setProperty('--hero-desc', '#cfcfff');
    });

    // Vehicle popup
    document.querySelector('.vehicle-btn').addEventListener('click', () => {
        const popup = document.getElementById("vehicle-popup");
        popup.style.display = 'block';
    });

    // Nav buttons behavior
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');

            if (btn.textContent.includes('Route Optimizer')) {
                alert("🗺️ Route Optimizer coming soon! For now, click 'Route to here' in station cards.");
            } else if (btn.textContent.includes('AI Predictions')) {
                alert("🤖 AI Predictions Dashboard coming soon. Stay tuned!");
            } else if (btn.textContent.includes('Station Map')) {
                alert("📍 Showing nearby EV stations on map.");
            }
        });
    });

    // Full Screen Map toggle
    const fullscreenBtn = document.getElementById('fullscreen-map-btn');
    const mapDiv = document.getElementById('map');
    let isFullscreen = false;
    const mapSection = mapDiv.parentElement;
    const header = document.querySelector('.header');
    const sectionTitleCard = document.querySelector('.section-title-card');
    const fullscreenOverlay = document.getElementById('fullscreen-overlay');
    const originalMapParent = mapDiv.parentElement;
    let floatingExitBtn = null;
    fullscreenBtn.addEventListener('click', () => {
        isFullscreen = !isFullscreen;
        if (isFullscreen) {
            fullscreenOverlay.appendChild(mapDiv);
            fullscreenOverlay.style.display = 'flex';
            fullscreenOverlay.style.position = 'fixed';
            fullscreenOverlay.style.top = '0';
            fullscreenOverlay.style.left = '0';
            fullscreenOverlay.style.width = '100vw';
            fullscreenOverlay.style.height = '100vh';
            fullscreenOverlay.style.zIndex = '3000';
            fullscreenOverlay.style.background = 'var(--bg)';
            mapDiv.style.width = '100vw';
            mapDiv.style.height = '100vh';
            mapDiv.style.margin = '0';
            mapDiv.style.borderRadius = '0';
            if (header) header.classList.add('hidden');
            // Do not hide sectionTitleCard
            document.documentElement.classList.add('fullscreen-root');
            document.body.classList.add('fullscreen-root');
            // Create floating exit button
            floatingExitBtn = document.createElement('button');
            floatingExitBtn.className = 'fullscreen-exit-btn';
            floatingExitBtn.textContent = 'Exit Full Screen';
            floatingExitBtn.onclick = () => fullscreenBtn.click();
            fullscreenOverlay.appendChild(floatingExitBtn);
        } else {
            originalMapParent.appendChild(mapDiv);
            fullscreenOverlay.style.display = 'none';
            mapDiv.style.width = '';
            mapDiv.style.height = '';
            mapDiv.style.margin = '';
            mapDiv.style.borderRadius = '';
            if (header) header.classList.remove('hidden');
            // Do not show sectionTitleCard
            document.documentElement.classList.remove('fullscreen-root');
            document.body.classList.remove('fullscreen-root');
            // Remove floating exit button
            if (floatingExitBtn) {
                floatingExitBtn.remove();
                floatingExitBtn = null;
            }
        }
        setTimeout(() => { map.invalidateSize(); }, 300);
    });
});
