const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'ksqh_metro2',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
  // PostGIS connection ready
});

pool.on('error', (err) => {
  console.error('PostgreSQL Pool Error:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
