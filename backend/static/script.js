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

            if (prevLatLng && prevTimestamp) {
                const distance = map.distance(prevLatLng, L.latLng(lat, lon)); // meters
                const timeElapsed = (currentTimestamp - prevTimestamp) / 1000; // seconds
                const speedKmph = ((distance / timeElapsed) * 3.6).toFixed(2);
                document.getElementById("speed-display").innerText = `Speed: ${speedKmph} km/h`;
            }

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
