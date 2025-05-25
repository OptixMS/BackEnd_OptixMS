const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'EncodingDB', 
  password: '445656',
  port: 5432,
});

module.exports = pool;
