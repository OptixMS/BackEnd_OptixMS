from flask import Flask, request, jsonify
import pandas as pd
import numpy as np
from tensorflow.keras.models import load_model
from datetime import datetime

app = Flask(__name__)

# Load LSTM model
model = load_model("lstm_model.h5")

@app.route('/')
def home():
    return "✅ API LSTM is running!"

@app.route('/predict', methods=['POST'])
def predict():
    try:
        tanggal_str = request.form.get('tanggal')
        dummy_file = request.files.get('csv_file')

        if not tanggal_str or not dummy_file:
            return jsonify({"error": "Parameter 'tanggal' dan 'csv_file' wajib diisi."}), 400

        df_dummy = pd.read_csv(dummy_file)

        # Konversi tanggal input ke UNIX timestamp dan hari keberapa (0=Senin)
        target_date = pd.to_datetime(tanggal_str)
        day_of_week = target_date.weekday()

        # Tambahkan fitur waktu
        df_dummy["day_of_week"] = day_of_week

        # Ambil hanya kolom fitur yang dibutuhkan
        expected_features = ["f1", "f2", "f3"]
        if not all(col in df_dummy.columns for col in expected_features):
            return jsonify({"error": f"Kolom yang dibutuhkan: {expected_features}"}), 400

        input_data = df_dummy[expected_features].copy()
        input_data["day_of_week"] = day_of_week
        features = input_data.values.reshape((-1, 1, 4))  # (batch, time_steps, features)

        # Prediksi
        pred = model.predict(features)
        pred_labels = [int(np.argmax(p)) for p in pred]

        df_dummy["Predicted"] = pred_labels

        return jsonify({
            "tanggal_input": tanggal_str,
            "results": df_dummy.to_dict(orient="records")
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5003)
