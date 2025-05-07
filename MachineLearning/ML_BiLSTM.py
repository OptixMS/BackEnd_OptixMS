from flask import Flask, request, jsonify
import numpy as np
from datetime import datetime
from tensorflow.keras.models import load_model

app = Flask(__name__)

# Load model BiLSTM
model = load_model("bilstm_model.h5")

@app.route('/')
def home():
    return "BiLSTM Model API is running!"

@app.route('/predict', methods=['GET'])
def predict():
    try:
        # Ambil tanggal
        tanggal_str = request.args.get('tanggal')
        if not tanggal_str:
            return jsonify({"error": "Parameter 'tanggal' wajib ada"}), 400

        tanggal = datetime.strptime(tanggal_str, "%Y-%m-%d")
        day_of_week = tanggal.weekday()  # 0-6

        # Ambil fitur lainnya
        f1 = float(request.args.get('f1', 0))
        f2 = float(request.args.get('f2', 0))
        f3 = float(request.args.get('f3', 0))

        # Susun input ke bentuk (1, time_steps, features)
        # Contoh: time_steps = 1 (karena hanya 1 data waktu)
        features = np.array([[[f1, f2, f3, day_of_week]]])

        # Prediksi
        pred = model.predict(features)
        return jsonify({
            "input": {
                "tanggal": tanggal_str,
                "day_of_week": day_of_week,
                "f1": f1,
                "f2": f2,
                "f3": f3
            },
            "prediction": pred.tolist()
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ✅ Jalankan di port 5002
if __name__ == '__main__':
    app.run(debug=True, port=5002)
