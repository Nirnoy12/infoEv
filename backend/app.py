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

from flask import request, jsonify
import numpy as np
import pandas as pd
from flask_cors import CORS
from tensorflow.keras.models import load_model

# Enable cross-origin requests (for JS fetch)
CORS(app)

# 🔁 Load the Keras model
model = load_model("model_ev.h5", compile=False)

@app.route('/predict_time', methods=['POST'])
def predict_time():
    try:
        data = request.get_json()
        vehicle_type = data.get('vehicle_type')
        distance = float(data.get('distance'))

        if vehicle_type not in ['Car', 'Bike', 'Scooter']:
            return jsonify({'error': 'Invalid vehicle type'}), 400

        # Encode vehicle_type to integer (same as training)
        type_map = {'Scooter': 0, 'Bike': 1, 'Car': 2}
        vehicle_encoded = type_map[vehicle_type]

        # 🔢 Model expects shape (1, 1, 2): [ [ [vehicle_type, distance] ] ]
        input_array = np.array([[vehicle_encoded, distance]], dtype=float).reshape(1, 1, 2)
        prediction = model.predict(input_array)[0][0]

        return jsonify({'predicted_time_min': round(float(prediction), 2)})

    except Exception as e:
        return jsonify({'error':str(e)}),500
