from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
import requests
from geopy.distance import geodesic

app = Flask(__name__)
socketio = SocketIO(app)

@app.route('/')
def index():
    return render_template("index.html")

# 📡 Handle live location updates from frontend
@socketio.on('location_update')
def handle_location(data):
    try:
        lat = float(data['lat'])
        lon = float(data['lon'])
        print(f"📍 Location received: ({lat}, {lon})")

        # OpenChargeMap API call
        url = "https://api.openchargemap.io/v3/poi/"
        params = {
            "output": "json",
            "countrycode": "IN",
            "latitude": lat,
            "longitude": lon,
            "distance": 5000,
            "distanceunit": "KM",
            "maxresults": 100,
            "compact": "true",
            "verbose": "false",
            "key": "ff003e31-9326-49d3-a209-f706371f1acc"
        }

        response = requests.get(url, params=params)
        stations = response.json()

        ev_data = []
        for s in stations:
            info = s.get('AddressInfo', {})
            station_lat = info.get('Latitude')
            station_lon = info.get('Longitude')

            if station_lat and station_lon:
                distance = geodesic((lat, lon), (station_lat, station_lon)).km
                ev_data.append({
                    'name': info.get('Title', 'Unknown Station'),
                    'lat': station_lat,
                    'lon': station_lon,
                    'comment': info.get('AccessComments', 'No comment available'),
                    'distance': distance
                })

        # Sort by closest and keep top 10
        ev_data = sorted(ev_data, key=lambda x: x['distance'])[:10]
        emit('ev_stations', {'stations': ev_data})
        print(f"✅ Sent {len(ev_data)} EV stations to frontend.")

    except Exception as e:
        print(f"❌ Error handling location update: {e}")
        emit('ev_stations', {'stations': []})

# 🤖 Future AI Optimization Endpoint (Mock for now)
@app.route('/optimize', methods=['POST'])
def optimize_station():
    try:
        data = request.json
        name = data.get('name')
        lat = data.get('lat')
        lon = data.get('lon')

        print(f"🔍 AI optimization requested for {name} ({lat}, {lon})")

        # TODO: Replace this logic with actual ML/AI model
        optimized_result = {
            "slot": "14:30 - 15:00",
            "eta": 12,  # minutes
            "swaps_available": 3
        }

        return jsonify(optimized_result)

    except Exception as e:
        print(f"❌ Optimization error: {e}")
        return jsonify({"error": "Failed to optimize station"}), 500

if __name__ == '__main__':
    socketio.run(app, debug=True)
