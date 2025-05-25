from flask import Flask, request, jsonify
import pandas as pd
import numpy as np
import xgboost as xgb
from datetime import datetime
import os

app = Flask(__name__)

@app.route('/')
def home():
    return "✅ API XGBoost is running!"

@app.route('/predict', methods=['POST'])
def predict():
    try:
        tanggal_str = request.form.get('tanggal')
        dummy_file = request.files.get('csv_file')

        if not tanggal_str or not dummy_file:
            return jsonify({"error": "Parameter 'tanggal' dan 'csv_file' wajib diisi."}), 400

        df_dummy = pd.read_csv(dummy_file)
        # Pastikan 'Cleaned_Merged_data_alarm.csv' ada di direktori yang sama
        df_train = pd.read_csv("Cleaned_Merged_data_alarm.csv")

        for df in [df_train, df_dummy]:
            # Konversi kolom tanggal ke Unix timestamp (detik)
            df["Last Occurred (ST)"] = pd.to_datetime(df["Last Occurred (ST)"], errors="coerce").astype(int) // 10**9
            df["Acknowledged On (ST)"] = pd.to_datetime(df["Acknowledged On (ST)"], errors="coerce").astype(int) // 10**9

        base_unix = int(pd.Timestamp(tanggal_str).timestamp())

        # Tambahkan fitur waktu dan noise sebelum pemisahan train/test
        for df in [df_train, df_dummy]:
            df["Tanggal Input (UNIX)"] = base_unix
            # Pastikan 'Last Occurred (ST)' adalah integer (Unix timestamp) sebelum digunakan
            # untuk dt.hour dan dt.weekday
            df["Hour"] = pd.to_datetime(df["Last Occurred (ST)"], unit='s').dt.hour
            df["Weekday"] = pd.to_datetime(df["Last Occurred (ST)"], unit='s').dt.weekday

        df_train["Synthetic Noise"] = 0
        df_dummy["Synthetic Noise"] = np.random.normal(0, 1, size=len(df_dummy))
        # Pastikan Tanggal Input (UNIX) unik untuk setiap baris dummy agar tidak ada duplikasi
        df_dummy["Tanggal Input (UNIX)"] = [base_unix + i * 60 for i in range(len(df_dummy))]

        # Memisahkan fitur (X) dan target (y)
        X_train = df_train.drop(columns=["Severity"], errors="ignore")
        y_train = df_train["Severity"]

        print("🧪 Fitur yang dipakai model:", X_train.columns.tolist())

        # Membuat DMatrix untuk XGBoost
        dtrain = xgb.DMatrix(X_train.values, label=y_train)
        param = {
            "objective": "multi:softprob", # Untuk klasifikasi multi-kelas dengan probabilitas
            "num_class": len(set(y_train)), # Jumlah kelas severity yang unik
            "eval_metric": "mlogloss" # Metrik evaluasi
        }
        model = xgb.train(param, dtrain, num_boost_round=50) # Melatih model

        # Mempersiapkan data input untuk prediksi
        input_df = df_dummy.drop(columns=["Severity"], errors="ignore").copy()
        dinput = xgb.DMatrix(input_df.values)
        probas_all = model.predict(dinput) # Mendapatkan probabilitas untuk setiap kelas

        # Menentukan kelas prediksi berdasarkan probabilitas tertinggi
        input_df["Predicted Severity"] = [int(np.argmax(p)) for p in probas_all]

        # --- Bagian Perbaikan untuk Menampilkan Setiap Severity ---
        # Asumsi mapping severity: 0=Minor, 1=Warning, 2=Major, 3=Critical
        severity_levels = {
            0: "Minor",
            1: "Warning",
            2: "Major",
            3: "Critical"
        }

        selected_results = []
        found_severities = set()

        # Iterasi melalui hasil prediksi untuk memilih satu contoh dari setiap severity
        # Prioritaskan severity yang lebih tinggi jika ada duplikasi dalam data input
        # atau ambil yang pertama ditemukan untuk setiap severity
        for severity_value in sorted(severity_levels.keys(), reverse=True): # Mulai dari Critical (3) ke Minor (0)
            # Filter baris yang memiliki 'Predicted Severity' ini dan belum ditambahkan
            # Menggunakan .copy() untuk menghindari SettingWithCopyWarning
            filtered_rows = input_df[input_df["Predicted Severity"] == severity_value].copy()

            if not filtered_rows.empty:
                # Ambil satu baris pertama dari severity ini
                # Jika Anda ingin memilih baris tertentu (misal: yang paling relevan),
                # Anda bisa menambahkan logika pengurutan di sini.
                selected_row = filtered_rows.iloc[0]
                selected_results.append(selected_row.to_dict())
                found_severities.add(severity_value)

        # Jika tidak ada hasil yang ditemukan untuk severity tertentu, dan Anda ingin
        # memastikan ada 1 dari setiap severity, Anda perlu membuat data dummy untuk itu.
        # Namun, berdasarkan permintaan "menampilkan masing masing dari setiap severity",
        # ini menyiratkan bahwa data tersebut harus berasal dari prediksi.
        # Jadi, kita hanya akan menampilkan yang ditemukan.

        return jsonify({
            "tanggal_input": tanggal_str,
            "results": selected_results # Mengembalikan hasil yang sudah difilter
        })

    except Exception as e:
        print(f"❌ Error di Flask /predict: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5002)
