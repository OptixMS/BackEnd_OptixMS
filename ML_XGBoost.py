from flask import Flask, request, jsonify
import pandas as pd
import numpy as np
import xgboost as xgb
from datetime import datetime

app = Flask(__name__)

@app.route('/')
def home():
    return "✅ API XGBoost retraining + prediction from tanggal (POST + file upload) is running!"

@app.route('/predict', methods=['POST'])
def predict():
    try:
        tanggal_str = request.form.get('tanggal')
        dummy_file = request.files.get('dummy_file')

        if not tanggal_str or not dummy_file:
            return jsonify({"error": "Parameter 'tanggal' dan 'dummy_file' wajib diisi."}), 400

        # Load CSV dummy dan data pelatihan
        df_dummy = pd.read_csv(dummy_file)
        df_train = pd.read_csv("Cleaned_Merged_data_alarm.csv")

        # Preprocessing waktu jadi UNIX timestamp
        for df in [df_train, df_dummy]:
            df["Last Occurred (ST)"] = pd.to_datetime(df["Last Occurred (ST)"], errors="coerce").astype(int) // 10**9
            df["Acknowledged On (ST)"] = pd.to_datetime(df["Acknowledged On (ST)"], errors="coerce").astype(int) // 10**9

        # Gabungkan data pelatihan dan dummy
        df_combined = pd.concat([df_train, df_dummy], ignore_index=True)

        # Validasi kolom Severity
        if "Severity" not in df_combined.columns:
            return jsonify({"error": "Kolom 'Severity' tidak ditemukan pada data gabungan."}), 400

        # Bersihkan data: hapus label invalid
        df_combined = df_combined[df_combined["Severity"].notna()]
        df_combined = df_combined[~df_combined["Severity"].isin(["", "nan", "NaN", np.nan, None])]

        # Konversi label ke float lalu ke int
        try:
            df_combined["Severity"] = df_combined["Severity"].astype(float)
        except:
            return jsonify({"error": "Gagal konversi Severity ke float. Pastikan semua nilai numerik."}), 400

        if df_combined["Severity"].isna().any() or np.isinf(df_combined["Severity"]).any() or (df_combined["Severity"] > 1e6).any():
            return jsonify({"error": "Label Severity mengandung nilai NaN, tak hingga, atau terlalu besar."}), 400

        df_combined["Severity"] = df_combined["Severity"].astype(int)

        X = df_combined.drop(columns=["Severity"], errors="ignore")
        y = df_combined["Severity"]

        # Latih ulang model XGBoost
        dtrain = xgb.DMatrix(X.values, label=y)
        param = {
            "objective": "multi:softprob",
            "num_class": len(set(y)),
            "eval_metric": "mlogloss"
        }
        model = xgb.train(param, dtrain, num_boost_round=50)

        # Siapkan baris input untuk tanggal target
        input_df = df_dummy.drop(columns=["Severity"], errors="ignore").copy()
        target_unix = int(pd.Timestamp(tanggal_str).timestamp())

        # Tambahkan waktu ke semua baris
        input_df["Last Occurred (ST)"] = target_unix
        input_df["Acknowledged On (ST)"] = target_unix + np.random.randint(60, 3600, size=len(input_df))

        dinput = xgb.DMatrix(input_df.values)
        probas_all = model.predict(dinput)

        # Tambahkan hasil prediksi ke dataframe
        input_df["Predicted Severity"] = [int(np.argmax(p)) for p in probas_all]
        input_df["Confidence Score"] = [float(np.max(p)) for p in probas_all]

        return jsonify({
            "tanggal_input": tanggal_str,
            "predicted_class": predicted_class,
            "confidence_score": round(confidence, 4),
            "raw_probabilities": probas.tolist(),
            "input_row": input_row.iloc[0].to_dict()
        })

    except Exception as e:
        return jsonify({
    "tanggal_input": tanggal_str,
    "results": input_df.to_dict(orient="records")
})

if __name__ == '__main__':
    app.run(debug=True, port=5002)