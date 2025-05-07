const express = require('express');
const multer = require('multer');
const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');
const csv = require('csv-parser');
const path = require('path');
const XLSX = require('xlsx');
const inputPool = require(path.join(__dirname, '..', 'config', 'inputDb'));

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Endpoint: Prediksi via Flask
router.post('/api/predict', upload.single('csv_file'), async (req, res) => {
  const { tanggal } = req.body;
  const file = req.file;

  // ✅ Tambahkan LOG untuk debug
  console.log('\n=== [DEBUG] REQUEST MASUK KE /api/predict ===');
  console.log('[Tanggal dari req.body]:', tanggal);
  console.log('[File dari req.file]:', file ? {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    path: file.path
  } : 'Tidak ada file');

  // Validasi awal
  if (!tanggal || !file) {
    console.log('[ERROR] Tanggal atau file tidak terkirim!');
    return res.status(400).json({ success: false, message: 'Tanggal dan file wajib diisi.' });
  }

  try {
    const formData = new FormData();
    formData.append('tanggal', tanggal);
    formData.append('dummy_file', fs.createReadStream(file.path));

    const response = await fetch('http://localhost:5002/predict', {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders(),
    });

    const result = await response.json();

    if (result.error) {
      return res.status(500).json({ success: false, message: result.error });
    }

    res.json({
      success: true,
      tanggal: result.tanggal_input,
      rows: result.results,
    });

  } catch (err) {
    console.error('Predict error:', err);
    res.status(500).json({ success: false, message: 'Gagal menghubungi server Flask.' });
  }
});

// Endpoint: Upload CSV ke database PostgreSQL
router.post('/api/uploadcsv', upload.single('csv_file'), async (req, res) => {
  const filePath = req.file?.path;
  const results = [];
  const errors = [];

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(400).json({ success: false, message: 'File CSV tidak ditemukan.' });
  }

  try {
    fs.createReadStream(filePath)
      .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
      .on('data', (data) => {
        const cleaned = {};
        for (const key in data) {
          cleaned[key.trim()] = data[key].trim();
        }
        results.push(cleaned);
      })
      .on('end', async () => {
        for (let i = 0; i < results.length; i++) {
          const row = results[i];
          try {
            await inputPool.query(
              `INSERT INTO File_Input (
                alarm_description, "Alarm ID", "Alarm Source", "Location Info", "Other Information",
                "Last Occurred (ST)", "Acknowledged On (ST)", "Fiber/Cable Name", "Cleared By", "Acknowledged By",
                "Clearance Status", "Acknowledgement Status", "Alarm Serial Number"
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
              [
                row['alarm_description'],
                row['Alarm ID'],
                row['Alarm Source'],
                row['Location Info'],
                row['Other Information'],
                row['Last Occurred (ST)'],
                row['Acknowledged On (ST)'],
                row['Fiber/Cable Name'],
                row['Cleared By'],
                row['Acknowledged By'],
                row['Clearance Status'],
                row['Acknowledgement Status'],
                row['Alarm Serial Number'],
              ]
            );
          } catch (err) {
            errors.push({ index: i, error: err.message });
          }
        }

        fs.unlinkSync(filePath);

        if (errors.length > 0) {
          console.warn('Beberapa baris gagal:', errors);
          return res.json({
            success: false,
            message: `Sebagian data gagal dimasukkan (${errors.length} dari ${results.length})`,
            errors,
          });
        }

        res.json({ success: true, message: 'Data berhasil disimpan ke database.' });
      });
  } catch (err) {
    console.error('Upload CSV error:', err);
    res.status(500).json({ success: false, message: 'Gagal memproses file CSV.' });
  }
});

router.get('/api/encoding', (req, res) => {
  try {
    // Baca file Excel
    const filePath = path.join(__dirname, 'Encoding__Documentation_fix.xlsx');
    const workbook = XLSX.readFile(filePath);

    const allSheets = workbook.SheetNames;
    const result = {};

    // Ambil semua sheet dan masukkan ke objek
    allSheets.forEach(sheetName => {
      const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });
      result[sheetName] = sheetData;
    });

    res.json({ success: true, data: result });

  } catch (err) {
    console.error('Error reading encoding file:', err);
    res.status(500).json({ success: false, message: 'Failed to load encoding data.' });
  }
});

module.exports = router;
