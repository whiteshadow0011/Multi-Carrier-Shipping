import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  user: process.env.PGUSER || 'postgres',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'carrier_gateway',
  password: process.env.PGPASSWORD || 'postgres',
  port: parseInt(process.env.PGPORT, 10) || 5432,
  max: 20, 
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  console.log('[PostgreSQL] Client connected to pool');
});

pool.on('error', (err) => {
  console.error('[PostgreSQL Unexpected Error]:', err.message);
});

export const query = (text, params) => pool.query(text, params);