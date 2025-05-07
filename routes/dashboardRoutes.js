const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');
const upload = multer({ dest: 'uploads/' });

router.get('/:username/dashboard', (req, res) => {
  res.render('dashboard', { username: req.params.username });
});

router.get('/:username/dashboard/temperature', (req, res) => {
  res.render('temperaturpage', { username: req.params.username });
});

router.get('/:username/dashboard/device', (req, res) => {
  res.render('sitedevicepage', { username: req.params.username });
});

router.get('/:username/dashboard/map', (req, res) => {
  res.render('mappage', { username: req.params.username });
});

router.get('/:username/dashboard/about', (req, res) => {
  res.render('aboutpage', { username: req.params.username });
});

router.post('/:username/dashboard/predictpage', upload.single('dummy_file'), async (req, res) => {
  const { username } = req.params;
  const { tanggal } = req.body;
  const file = req.file;

  if (!tanggal || !file) {
    req.flash('error', 'Tanggal dan file CSV wajib diisi.');
    return res.redirect(`/${username}/dashboard`);
  }

  try {
    const formData = new FormData();
    formData.append('tanggal', tanggal);
    formData.append('dummy_file', fs.createReadStream(file.path));

    const response = await fetch('http://localhost:5002/predict', {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });

    const result = await response.json();

    if (result.error) {
      req.flash('error', `Gagal prediksi: ${result.error}`);
      return res.redirect(`/${username}/dashboard`);
    }

    res.render('predictpage', {
      username,
      tanggal: result.tanggal_input,
      rows: result.results
    });

  } catch (err) {
    console.error(err);
    req.flash('error', 'Gagal menghubungi server Flask.');
    res.redirect(`/${username}/dashboard`);
  }
});

module.exports = router;
