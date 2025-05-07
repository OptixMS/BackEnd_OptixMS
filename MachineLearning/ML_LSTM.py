from flask import Flask, request, jsonify
import numpy as np
from datetime import datetime
from tensorflow.keras.models import load_model

app = Flask(__name__)

# Load LSTM model
model = load_model("lstm_model.h5")

@app.route('/')
def home():
    return "LSTM Model API is running!"

@app.route('/predict', methods=['GET'])
def predict():
    try:
        # Ambil parameter tanggal
        tanggal_str = request.args.get('tanggal')
        if not tanggal_str:
            return jsonify({"error": "Parameter 'tanggal' wajib ada"}), 400

        tanggal = datetime.strptime(tanggal_str, "%Y-%m-%d")
        day_of_week = tanggal.weekday()  # Senin = 0, Minggu = 6

        # Ambil fitur lainnya
        f1 = float(request.args.get('f1', 0))
        f2 = float(request.args.get('f2', 0))
        f3 = float(request.args.get('f3', 0))

        # Bentuk array: (1, 1, 4)
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

if __name__ == '__main__':
    app.run(debug=True, port=5003)
