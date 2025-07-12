import os
from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import requests
from geopy.distance import geodesic

# Hugging Face Transformers
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch
import re

# -------------------- Setup --------------------
app = Flask(__name__)
socketio = SocketIO(app)
CORS(app)

# Load Hugging Face FLAN-T5 model
print("🚀 Loading Hugging Face model...")
tokenizer = AutoTokenizer.from_pretrained("google/flan-t5-small")
model = AutoModelForSeq2SeqLM.from_pretrained("google/flan-t5-small")
print("✅ Model loaded.")

# -------------------- Routes --------------------
@app.route('/')
def index():
    return render_template("index.html")

# 📡 Live location updates
@socketio.on('location_update')
def handle_location(data):
    try:
        lat = float(data['lat'])
        lon = float(data['lon'])
        print(f"📍 Location received: ({lat}, {lon})")

        # OpenChargeMap API
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

        ev_data = sorted(ev_data, key=lambda x: x['distance'])[:10]
        emit('ev_stations', {'stations': ev_data})
        print(f"✅ Sent {len(ev_data)} EV stations to frontend.")

    except Exception as e:
        print(f"❌ Error handling location update: {e}")
        emit('ev_stations', {'stations': []})

# 🤖 AI-Powered ETA Prediction Endpoint using Hugging Face
@app.route('/predict_time', methods=['POST'])
def predict_time():
    try:
        data = request.get_json()
        vehicle_type = data.get('vehicle_type', 'Car')
        distance = float(data.get('distance', 0))

        # Prompt for the FLAN-T5 model
        prompt = f"Estimate EV charging time for a {vehicle_type} traveling {round(distance, 2)} kilometers"
        print(f"🤖 Prompt: {prompt}")
        inputs = tokenizer(prompt, return_tensors="pt")
        outputs = model.generate(**inputs, max_new_tokens=10)
        prediction = tokenizer.decode(outputs[0], skip_special_tokens=True)
        print(f"📈 Raw Output: {prediction}")

        # Extract number from prediction
        match = re.search(r'\d+', prediction)
        predicted_time = int(match.group()) if match else None

        return jsonify({"predicted_time_min": predicted_time})
    except Exception as e:
        print(f"❌ Prediction error: {e}")
        return jsonify({"error": "Prediction failed"}), 500

# -------------------- Main --------------------
if __name__ == '__main__':
    socketio.run(app, debug=True)

@app.route('/ai_insight', methods=['POST'])
def ai_insight():
    try:
        data = request.get_json()
        stations = data.get('stations', [])
        if not stations:
            return jsonify({"insight": "No stations available nearby."})

        # Prepare prompt from top 3 station names & distances
        station_str = ", ".join([f"{s['name']} ({round(s['distance'], 1)} km)" for s in stations[:3]])
        prompt = f"Give useful insights about these EV charging stations: {station_str}"

        inputs = tokenizer(prompt, return_tensors="pt")
        outputs = model.generate(**inputs, max_new_tokens=50)
        insight = tokenizer.decode(outputs[0], skip_special_tokens=True)

        return jsonify({"insight": insight})

    except Exception as e:
        print("❌ AI Insight error:", e)
        return jsonify({"insight": "Could not generate AI insights."})
