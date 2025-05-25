const express = require('express');
const axios = require('axios');
const sites = require('./sitecode');
const sitecode = require('./sitecode');
const router = express.Router();

async function getSuhuByAdm4(name, kodeAdm4) {
    try {
      const url = `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${kodeAdm4}`;
      const response = await axios.get(url);
  
      const cuacaData = response.data?.data?.[0]?.cuaca ?? [];
      const suhuList = [];
      const now = new Date();
  
      for (const hari of cuacaData) {
        for (const jam of hari) {
          const waktuJam = new Date(jam.local_datetime);
          const selisihMs = waktuJam - now;
  
          if (selisihMs >= 0 && selisihMs <= 4 * 60 * 60 * 1000) {
            suhuList.push({
              waktu: jam.local_datetime,
              suhu_celcius: jam.t
            });
          }
        }
      }
  
      return {
        lokasi: name,
        jumlah_data: suhuList.length,
        suhu: suhuList
      };
    } catch (error) {
      console.error(`❌ ${name} (${kodeAdm4}): ${error.message}`);
      return {
        lokasi: name,
        error: 'Gagal ambil data'
      };
    }
  }
  

router.get('/sitetemperature', async (req, res) => {
    const results = await Promise.all(sitecode.map(loc =>
        getSuhuByAdm4(loc.name, loc.kodeAdm4)
      ));
    
      res.json({
        jumlah_lokasi: results.length,
        data: results
      });
    });
     
module.exports = router;
