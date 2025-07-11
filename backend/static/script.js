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

// 🛣️ Draw route from user to any station
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

// 📍 Called on GPS update
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

// 📡 Handle station data from server
socket.on('ev_stations', (data) => {
    evMarkers.forEach(marker => map.removeLayer(marker));
    evMarkers = [];

    data.stations.forEach(s => {
        const marker = L.marker([s.lat, s.lon])
            .bindPopup(`
                <b>${s.name}</b><br>
                ${s.distance.toFixed(2)} km<br>
                ${s.comment}<br>
                <button onclick="selectStation(${s.lat}, ${s.lon})">🚀 Route to here</button>
            `);
        evMarkers.push(marker);
        marker.addTo(map);
    });

    // Auto route to nearest station
    if (data.stations.length > 0 && userMarker && userMarker.getLatLng) {
        const nearest = data.stations[0];
        const userLatLng = userMarker.getLatLng();
        drawRouteToStation(userLatLng, L.latLng(nearest.lat, nearest.lon));
    }
});

// 🧭 Called when user clicks "Route to here"
function selectStation(lat, lon) {
    if (userMarker) {
        const userLatLng = userMarker.getLatLng();
        drawRouteToStation(userLatLng, L.latLng(lat, lon));
    }
}

// 📍 Live GPS tracking & speed calculation
if ("geolocation" in navigator) {
    navigator.geolocation.watchPosition(
        (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            const currentTimestamp = Date.now();

            // Speed Calculation
            if (prevLatLng && prevTimestamp) {
                const distance = map.distance(prevLatLng, L.latLng(lat, lon)); // meters
                const timeElapsed = (currentTimestamp - prevTimestamp) / 1000; // seconds
                const speedMps = distance / timeElapsed;
                const speedKmph = (speedMps * 3.6).toFixed(2);
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
