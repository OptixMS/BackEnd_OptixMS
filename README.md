# 🧠 OptiMS - Backend API

OptixMS adalah sistem backend untuk manajemen monitoring alarm dan prediksi severity berbasis machine learning. Backend ini dikembangkan menggunakan **Express.js** dan terhubung ke **PostgreSQL** serta sistem **Flask ML** untuk prediksi.

## 🚀 Fitur Utama

- 🔐 Autentikasi berbasis JWT (login, register, logout, token blacklist)
- 🔄 Forgot Password + Reset Password (via email)
- 🧠 Prediksi severity dari file CSV melalui model ML (Flask)
- 📥 Upload data CSV ke database
- 📤 Export hasil encoding
- 📊 History prediksi per user
- 🧾 Middleware otorisasi per akun
- ✅ Postman collection disediakan untuk uji API

---

## 📦 Teknologi

- **Node.js + Express**
- **PostgreSQL**
- **JWT**
- **Bcrypt**
- **Multer** (upload CSV)
- **XLSX** (decode hasil ML)
- **Flask** (external prediction engine)
- **Nodemailer** (reset password)

---

## ⚙️ Instalasi

```bash
git clone https://github.com/OptixMS/BackEnd_OptixMS.git
cd BackEnd_OptixMS
npm install
