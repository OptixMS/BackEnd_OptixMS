const { Pool } = require('pg');
require('dotenv').config();

const inputPool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.INPUT_DB_NAME || 'InputDB',
  password: process.env.DB_PASSWORD || '445656',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
});

module.exports = inputPool;