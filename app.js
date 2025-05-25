// Express API backend untuk Vue frontend
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const cors = require('cors');
require('dotenv').config();

const app = express();
const path = require('path');

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', 
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: '2LsM~>w=-&24*+x',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false,
    httpOnly: true,
    sameSite: 'lax'
  }
}));
app.use(flash());

// Init table account
const accountPool = require(path.join(__dirname, 'config', 'AccountDB'));
accountPool.query(`
  CREATE TABLE IF NOT EXISTS account (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    password TEXT NOT NULL
  )
`).then(() => console.log('Tabel account siap.'))
  .catch(err => console.error('Gagal membuat tabel account:', err));

// Init table input
const inputPool = require(path.join(__dirname, 'config', 'inputDB'));
inputPool.query(`
  CREATE TABLE IF NOT EXISTS File_Input (
    id SERIAL PRIMARY KEY,
    alarm_description TEXT,
    "Alarm ID" TEXT,
    "Alarm Source" TEXT,
    "Location Info" TEXT,
    "Other Information" TEXT,
    "Last Occurred (ST)" TEXT,
    "Acknowledged On (ST)" TEXT,
    "Fiber/Cable Name" TEXT,
    "Cleared By" TEXT,
    "Acknowledged By" TEXT,
    "Clearance Status" TEXT,
    "Acknowledgement Status" TEXT,
    "Alarm Serial Number" TEXT
  )
`).then(() => console.log('Tabel File_Input siap.'))
  .catch(err => console.error('Gagal membuat tabel File_Input:', err));

// Init table encoded output
const encodingPool = require(path.join(__dirname, 'config', 'EncodingDB'));
encodingPool.query(`
  CREATE TABLE IF NOT EXISTS Hasil_Encoding (
    id SERIAL PRIMARY KEY,
    alarm_description TEXT,
    "Alarm ID" TEXT,
    "Alarm Source" TEXT,
    "Location Info" TEXT,
    "Other Information" TEXT,
    "Last Occurred (ST)" TEXT,
    "Acknowledged On (ST)" TEXT,
    "Fiber/Cable Name" TEXT,
    "Cleared By" TEXT,
    "Acknowledged By" TEXT,
    "Clearance Status" TEXT,
    "Acknowledgement Status" TEXT,
    "Alarm Serial Number" TEXT
  )
`).then(() => console.log('Tabel Hasil_Encoding siap.'))
  .catch(err => console.error('Gagal membuat tabel Hasil_Encoding:', err));

// API Routes
const accountRoutes = require(path.join(__dirname, 'routes', 'account'));
const predictRoutes = require(path.join(__dirname, 'routes', 'predict'));
const suhuRoutes = require(path.join(__dirname, 'routes', 'sitetemperature'));
const  dashboardRoutes = require(path.join(__dirname,'routes','dashboard'));
const historyRoutes = require(path.join(__dirname, 'routes', 'history'));



app.use('/api', accountRoutes);
app.use('/api', predictRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', suhuRoutes);
app.use('/api', historyRoutes);

// Health check
app.get('/', (req, res) => res.json({ success: true, message: 'API is running.' }));

// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`API Server running at http://localhost:${PORT}`);
});
