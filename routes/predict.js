const express = require('express');
const multer = require('multer');
const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');
const csv = require('csv-parser');
const path = require('path');
const XLSX = require('xlsx');
// Pastikan path ke konfigurasi DB sudah benar
const inputPool = require(path.join(__dirname, '..', 'config', 'inputDB'));
const encodingPool = require(path.join(__dirname, '..', 'config', 'EncodingDB'));
// Pastikan middleware authenticateToken diimpor jika digunakan
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

/**
 * Memuat data encoding dari file Excel.
 * Setiap sheet dalam Excel diharapkan memiliki dua kolom: satu untuk nilai encoded, satu untuk label.
 * @param {string} filePath - Path lengkap ke file Excel encoding.
 * @returns {Object} Objek yang berisi map encoding untuk setiap sheet.
 */
function loadEncodingExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const encodings = {};

  workbook.SheetNames.forEach((sheet) => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { defval: null });
    if (rows.length === 0) {
      console.warn(`[⚠️ Warning] Sheet kosong: ${sheet}`);
      return;
    }

    // Menemukan kolom kunci dan nilai secara lebih robust
    // Asumsi: Kolom encoded akan memiliki '_encoded' atau 'encoded' dalam namanya
    const columns = Object.keys(rows[0]);
    let keyColumn = columns.find(c => c.toLowerCase().includes('_encoded') || c.toLowerCase().includes('encoded'));
    let valueColumn = columns.find(c => !c.toLowerCase().includes('_encoded') && !c.toLowerCase().includes('encoded'));

    // Fallback jika tidak ditemukan nama standar, ambil dua kolom pertama
    if (!keyColumn && columns.length > 0) keyColumn = columns[0];
    if (!valueColumn && columns.length > 1) valueColumn = columns[1];

    if (!keyColumn || !valueColumn) {
      console.warn(`[⚠️ Warning] Tidak dapat menentukan kolom kunci/nilai untuk sheet: ${sheet}. Kolom ditemukan: ${columns.join(', ')}`);
      return;
    }

    encodings[sheet.toLowerCase()] = {}; // Kunci map adalah nama sheet di-lowercase
    rows.forEach(row => {
      const encodedValue = row[keyColumn];
      const labelValue = row[valueColumn];
      if (encodedValue != null && labelValue != null) {
        // Simpan map: encodedValue (string) -> labelValue (string)
        encodings[sheet.toLowerCase()][String(encodedValue).trim()] = labelValue?.toString().trim();
      }
    });
  });
  console.log('📊 Encoding map berhasil dimuat. Total sheets:', Object.keys(encodings).length);
  return encodings;
}

/**
 * Membersihkan nama kolom agar sesuai dengan format yang diharapkan untuk pencarian di encoding map.
 * Menghapus karakter non-alphanumeric (kecuali underscore), mengganti spasi dengan underscore, lalu lowercase dan trim.
 * Contoh: "Alarm ID" -> "alarm_id"
 * @param {string} columnName - Nama kolom asli.
 * @returns {string} Nama kolom yang sudah dibersihkan.
 */
function cleanColumnNameForMap(columnName) {
  return columnName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').toLowerCase().trim();
}

/**
 * Mengubah Unix timestamp (detik) menjadi string tanggal/waktu yang diformat untuk PostgreSQL.
 * @param {number|string|null} timestamp - Unix timestamp dalam detik.
 * @returns {string|null} Tanggal/waktu dalam format 'YYYY-MM-DD HH:MM:SS' atau null jika input tidak valid.
 */
function formatUnixTimestampToDbDateTime(timestamp) {
  if (timestamp == null || isNaN(Number(timestamp))) return null;
  const date = new Date(Number(timestamp) * 1000); // Ubah detik ke milidetik
  // Pastikan tanggal valid sebelum memformat
  if (isNaN(date.getTime())) return null;
  return date.toISOString().replace('T', ' ').slice(0, 19); // Format YYYY-MM-DD HH:MM:SS
}

/**
 * Mengubah tanggal dari format DD-MM-YYYY menjadi YYYY-MM-DD.
 * @param {string} dateString - Tanggal dalam format DD-MM-YYYY.
 * @returns {string|null} Tanggal dalam format YYYY-MM-DD atau null jika format tidak sesuai.
 */
function formatDdMmYyyyToYyyyMmDd(dateString) {
  if (!dateString) return null;
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return null;
}

/**
 * Meng-encode baris data menggunakan encoding map dari Excel.
 * Kolom yang ada di skipList akan dilewati dari proses encoding.
 * @param {Object} row - Objek baris data dari Flask/CSV.
 * @param {Object} encodingMap - Map encoding yang dimuat dari Excel.
 * @returns {Object} Objek baris data yang sudah di-encode.
 */
function encodeRow(row, encodingMap) {
  const encoded = {};
  for (const key in row) {
    // Gunakan fungsi cleanColumnNameForMap untuk mendapatkan nama sheet yang sesuai
    const sheetNameForMap = cleanColumnNameForMap(key);

    // Daftar kolom yang TIDAK PERLU di-encode (nilai sudah final atau numerik)
    // Kolom-kolom ini akan menggunakan nilai aslinya dari input Flask/CSV
    const skipListForEncoding = [
      "predicted_severity",     // Ini sudah hasil prediksi
      "tanggal_input_(unix)",   // Ini Unix timestamp, diformat terpisah
      "hour",                   // Numerik, tidak di-encode
      "weekday",                // Numerik, tidak di-encode
      "synthetic_noise",        // Numerik, tidak di-encode
      "last_occurred_(st)",     // Unix timestamp, diformat terpisah
      "acknowledged_on_(st)",   // Unix timestamp, diformat terpisah
      // Jika Anda ingin kolom-kolom di bawah ini di-decode, pastikan mereka TIDAK ada di skipList ini
      // dan Anda memiliki sheet encoding yang sesuai di Excel.
      // "alarm_serial_number",
      // "alarm_description",
      // "alarm_id",
      // "cleared_by",
      // "acknowledged_by",
      // "clearance_status",
      // "acknowledgement_status",
      // "fiber_cable_name",
      // "location_info",
      // "other_information",
      // "alarm_source"
    ];

    // JIKA KOLOM ADA DI `skipListForEncoding`, LANGSUNG GUNAKAN NILAI ASLI
    if (skipListForEncoding.includes(sheetNameForMap)) {
      encoded[key] = row[key]; // Pertahankan nilai asli
      continue;
    }

    // JIKA KOLOM TIDAK ADA DI `skipListForEncoding`, COBA DECODE MENGGUNAKAN MAP
    const map = encodingMap[sheetNameForMap];
    const rawValue = row[key];
    // Pastikan valueKey selalu string dan di-trim untuk pencocokan yang akurat
    const valueKey = rawValue != null ? String(rawValue).trim() : null;

    if (!map) {
      // Warning ini akan muncul jika sheet tidak ditemukan DAN kolom tidak ada di skipList
      console.warn(`[⚠️ Encoding Sheet Not Found]: Sheet for '${key}' (cleaned: '${sheetNameForMap}') not found in Excel. Keeping original value.`);
      encoded[key] = rawValue; // Jika map tidak ditemukan, biarkan nilai asli
    } else {
      // Jika nilai tidak ditemukan di map, biarkan nilai asli.
      const decodedValue = map?.[valueKey];
      if (decodedValue !== undefined && decodedValue !== null) {
        encoded[key] = decodedValue;
      } else {
        // console.warn(`[⚠️ Encoding Value Not Found]: Value '${rawValue}' for '${key}' (cleaned: '${sheetNameForMap}') not found in map. Keeping original.`);
        encoded[key] = rawValue; // Jika nilai tidak ditemukan di map, biarkan nilai asli
      }
    }
  }
  return encoded;
}

// Endpoint: Prediksi via Flask
router.post('/predict', authenticateToken, upload.single('csv_file'), async (req, res) => {
  const { tanggal } = req.body; // Contoh: "27-05-2025"
  const file = req.file;
  const username = req.user?.username; // Diambil dari middleware authenticateToken

  if (!tanggal || !file) {
    // FIX: Menggunakan template literal untuk pesan error
    return res.status(400).json({ success: false, message: `Parameter 'tanggal' dan 'csv_file' wajib diisi.` });
  }

  if (!username) {
    return res.status(401).json({ success: false, message: 'Username tidak ditemukan dari token. Pastikan Anda login.' });
  }

  console.log('🔒 Prediksi untuk user:', username);
  console.log('📁 File diterima:', file.originalname);
  console.log('🗓️ Tanggal prediksi (dari request):', tanggal);

  // Format tanggal untuk database (YYYY-MM-DD)
  const formattedTanggal = formatDdMmYyyyToYyyyMmDd(tanggal);
  if (!formattedTanggal) {
    console.error(`❌ Format tanggal '${tanggal}' tidak valid. Harusnya DD-MM-YYYY.`);
    return res.status(400).json({ success: false, message: 'Format tanggal tidak valid. Harusnya DD-MM-YYYY.' });
  }
  console.log('🗓️ Tanggal prediksi (diforamt untuk DB):', formattedTanggal);

  try {
    const formData = new FormData();
    formData.append('tanggal', tanggal); // Kirim tanggal asli ke Flask jika Flask membutuhkannya
    formData.append('csv_file', fs.createReadStream(file.path));

    console.log('📤 Mengirim permintaan ke Flask...');
    const response = await fetch('http://localhost:5002/predict', {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Flask server response error (${response.status}): ${errorText}`);
      return res.status(response.status).json({ success: false, message: `Gagal menghubungi server Flask: ${errorText}` });
    }

    const result = await response.json();
    console.log('✅ Respon dari Flask diterima. Data pertama:', JSON.stringify(result.results?.[0], null, 2));

    if (!result.results || !Array.isArray(result.results)) {
      console.error('❌ Data hasil tidak valid dari Flask:', result);
      return res.status(500).json({ success: false, message: 'Data hasil tidak valid dari Flask.' });
    }

    const encodingFile = path.join(__dirname, '..', 'Encoding__Documentation_Fix.xlsx');
    if (!fs.existsSync(encodingFile)) {
      console.error('❌ File Encoding__Documentation_Fix.xlsx tidak ditemukan di:', encodingFile);
      return res.status(500).json({ success: false, message: 'File encoding tidak ditemukan di server.' });
    }
    const encodingMap = loadEncodingExcel(encodingFile);

    // Proses decoding dilakukan di sini
    const decodedResults = result.results.map(row => encodeRow(row, encodingMap));
    console.log('✨ Data berhasil di-decode. Contoh data ter-decode pertama:', JSON.stringify(decodedResults[0], null, 2));

    for (let i = 0; i < decodedResults.length; i++) {
      const row = decodedResults[i]; // Gunakan decodedResults di sini
      try {
        // --- Validasi dan penanganan NULL untuk setiap kolom yang mungkin NOT NULL di DB Anda ---
        // Pastikan nama kunci di `row['Nama Kolom']` persis sama dengan yang dikembalikan Flask.
        // Asumsi: Flask mengembalikan nama kolom yang sama persis dengan yang Anda lihat di PgAdmin.
        const alarmDescription = row['alarm_description'] != null ? String(row['alarm_description']) : '';
        const alarmId = row['Alarm ID'] != null ? String(row['Alarm ID']) : null;
        const alarmSource = row['Alarm Source'] != null ? String(row['Alarm Source']) : '';
        const locationInfo = row['Location Info'] != null ? String(row['Location Info']) : '';
        const otherInformation = row['Other Information'] != null ? String(row['Other Information']) : '';

        // Konversi Unix timestamp ke format DB (YYYY-MM-DD HH:MM:SS)
        const lastOccurredST = formatUnixTimestampToDbDateTime(row['Last Occurred (ST)']);
        const acknowledgedOnST = formatUnixTimestampToDbDateTime(row['Acknowledged On (ST)']);

        const fiberCableName = row['Fiber/Cable Name'] != null ? String(row['Fiber/Cable Name']) : '';
        const clearedBy = row['Cleared By'] != null ? String(row['Cleared By']) : '';
        const acknowledgedBy = row['Acknowledged By'] != null ? String(row['Acknowledged By']) : '';
        const clearanceStatus = row['Clearance Status'] != null ? String(row['Clearance Status']) : '';
        const acknowledgementStatus = row['Acknowledgement Status'] != null ? String(row['Acknowledgement Status']) : '';
        const alarmSerialNumber = row['Alarm Serial Number'] != null ? String(row['Alarm Serial Number']) : null;
        // Ambil predicted_severity dari row, karena Flask mengembalikan sebagai "Predicted Severity"
        const predictedSeverity = row['Predicted Severity'] != null ? String(row['Predicted Severity']) : 'Unknown';

        console.log(`💾 Mencoba menyimpan hasil_encoding baris ke-${i + 1} untuk user '${username}'. Data:`, {
            alarmDescription, alarmId, alarmSource, locationInfo, predictedSeverity, formattedTanggal, lastOccurredST
        });

        await encodingPool.query(`
          INSERT INTO hasil_encoding (
            alarm_description, "Alarm ID", "Alarm Source", "Location Info", "Other Information",
            "Last Occurred (ST)", "Acknowledged On (ST)", "Fiber/Cable Name", "Cleared By", "Acknowledged By",
            "Clearance Status", "Acknowledgement Status", "Alarm Serial Number",
            username, tanggal, predicted_severity
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        `, [
          alarmDescription,
          alarmId,
          alarmSource,
          locationInfo,
          otherInformation,
          lastOccurredST,
          acknowledgedOnST,
          fiberCableName,
          clearedBy,
          acknowledgedBy,
          clearanceStatus,
          acknowledgementStatus,
          alarmSerialNumber,
          username,
          formattedTanggal, // <-- GUNAKAN TANGGAL YANG SUDAH DIFORMAT DI SINI
          predictedSeverity
        ]);
        console.log(`✅ Baris hasil_encoding ke-${i + 1} berhasil disimpan.`);
      } catch (err) {
        console.error(`[❌ Gagal simpan ke hasil_encoding baris ke-${i + 1}]:`, err.message);
        console.error(`  Data yang dicoba disimpan:`, JSON.stringify(row, null, 2));
        console.error(`  Error Stack:`, err.stack); // Sangat penting untuk detail error SQL
        // Jika ada satu baris yang gagal, Anda mungkin ingin menghentikan proses atau
        // mengumpulkan semua error untuk laporan akhir. Saat ini, akan terus mencoba.
      }
    }

    console.log(`[✅ Semua ${decodedResults.length} baris berhasil diproses untuk penyimpanan hasil_encoding.]`);
    res.json({
      success: true,
      tanggal: result.tanggal_input, // Ini tanggal dari Flask, mungkin formatnya berbeda
      rows: decodedResults // Mengembalikan data yang sudah di-decode
    });

  } catch (err) {
    console.error('Predict error (outside DB loop):', err);
    res.status(500).json({ success: false, message: 'Gagal menghubungi atau memproses respon dari server Flask.' });
  } finally {
    // Hapus file yang diupload setelah diproses
    if (file && fs.existsSync(file.path)) {
      fs.unlink(file.path, (unlinkErr) => {
        if (unlinkErr) console.error('Error menghapus file upload:', unlinkErr);
      });
    }
  }
});

// Endpoint: Upload CSV ke table file_input
router.post('/uploadcsv', authenticateToken, upload.single('csv_file'), async (req, res) => {
  const filePath = req.file?.path;
  const results = [];
  const errors = [];

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(400).json({ success: false, message: 'File CSV tidak ditemukan.' });
  }

  console.log('🔄 Memulai proses upload CSV ke file_input:', req.file.originalname);

  try {
    fs.createReadStream(filePath)
      .pipe(csv({ mapHeaders: ({ header }) => header.trim() })) // Trim header untuk pencocokan yang lebih baik
      .on('data', (data) => {
        const cleaned = {};
        for (const key in data) {
          // Trim nilai data juga
          cleaned[key.trim()] = data[key].trim();
        }
        results.push(cleaned);
      })
      .on('end', async () => {
        console.log(`📦 Ditemukan ${results.length} baris data dari CSV.`);
        for (let i = 0; i < results.length; i++) {
          const row = results[i];
          try {
            console.log(`💾 Mencoba menyimpan file_input baris ke-${i + 1}:`, JSON.stringify(row, null, 2));

            // --- Validasi dan Penanganan NULL untuk file_input ---
            // Asumsi: Nama kolom di CSV sama persis dengan nama kolom di DB Anda.
            const alarmDescription = row['alarm_description'] != null ? String(row['alarm_description']) : '';
            const alarmId = row['Alarm ID'] != null ? String(row['Alarm ID']) : null;
            const alarmSource = row['Alarm Source'] != null ? String(row['Alarm Source']) : '';
            const locationInfo = row['Location Info'] != null ? String(row['Location Info']) : '';
            const otherInformation = row['Other Information'] != null ? String(row['Other Information']) : '';

            // Konversi Unix timestamp dari CSV ke format DB
            const lastOccurredST = formatUnixTimestampToDbDateTime(row['Last Occurred (ST)']);
            const acknowledgedOnST = formatUnixTimestampToDbDateTime(row['Acknowledged On (ST)']);

            const fiberCableName = row['Fiber/Cable Name'] != null ? String(row['Fiber/Cable Name']) : '';
            const clearedBy = row['Cleared By'] != null ? String(row['Cleared By']) : '';
            const acknowledgedBy = row['Acknowledged By'] != null ? String(row['Acknowledged By']) : '';
            const clearanceStatus = row['Clearance Status'] != null ? String(row['Clearance Status']) : '';
            const acknowledgementStatus = row['Acknowledgement Status'] != null ? String(row['Acknowledgement Status']) : '';
            const alarmSerialNumber = row['Alarm Serial Number'] != null ? String(row['Alarm Serial Number']) : null;

            await inputPool.query(
              `INSERT INTO file_input (
                alarm_description, "Alarm ID", "Alarm Source", "Location Info", "Other Information",
                "Last Occurred (ST)", "Acknowledged On (ST)", "Fiber/Cable Name", "Cleared By", "Acknowledged By",
                "Clearance Status", "Acknowledgement Status", "Alarm Serial Number"
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
              [
                alarmDescription,
                alarmId,
                alarmSource,
                locationInfo,
                otherInformation,
                lastOccurredST,
                acknowledgedOnST,
                fiberCableName,
                clearedBy,
                acknowledgedBy,
                clearanceStatus,
                acknowledgementStatus,
                alarmSerialNumber,
              ]
            );
            console.log(`✅ Baris file_input ke-${i + 1} berhasil disimpan.`);
          } catch (err) {
            errors.push({ index: i, error: err.message, rowData: row });
            console.error(`[❌ Gagal simpan baris CSV ${i + 1} ke file_input]:`, err.message);
            console.error(`  Data yang dicoba disimpan:`, JSON.stringify(row, null, 2));
            console.error(`  Error Stack:`, err.stack);
          }
        }

        fs.unlinkSync(filePath); // Hapus file setelah selesai

        if (errors.length > 0) {
          console.warn(`[⚠️ Selesai dengan ${errors.length} error saat upload CSV]:`, errors);
          return res.json({
            success: false,
            message: `Sebagian data gagal dimasukkan (${errors.length} dari ${results.length})`,
            errors,
          });
        }

        console.log('[✅ Semua data CSV berhasil disimpan ke database file_input.]');
        res.json({ success: true, message: 'Data berhasil disimpan ke database.' });
      });
  } catch (err) {
    console.error('Upload CSV error (outside DB loop):', err);
    res.status(500).json({ success: false, message: 'Gagal memproses file CSV.' });
  }
});

// Endpoint: Ambil data encoding
router.get('/encoding', (req, res) => {
  try {
    const filePath = path.join(__dirname, '..', 'Encoding__Documentation_Fix.xlsx');
    if (!fs.existsSync(filePath)) {
      console.error('❌ File encoding tidak ditemukan di:', filePath);
      return res.status(404).json({ success: false, message: 'File encoding tidak ditemukan.' });
    }

    const workbook = XLSX.readFile(filePath);
    console.log('✅ File encoding berhasil dibaca.');

    const allSheets = workbook.SheetNames;
    const result = {};

    allSheets.forEach(sheetName => {
      const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });
      result[sheetName] = sheetData;
    });

    console.log(`📦 Berhasil memuat data dari ${allSheets.length} sheet encoding.`);
    res.json({ success: true, data: result });

  } catch (err) {
    console.error('Error reading encoding file:', err);
    res.status(500).json({ success: false, message: 'Failed to load encoding data.' });
  }
});

module.exports = router;
