const { Pool } = require('pg');
require('dotenv').config();

// Для Render используем DATABASE_URL из переменных окружения
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false  // Обязательно для Render
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('❌ Database error:', err.message);
});

const testConnection = async () => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as time');
        console.log('✅ Database connected at:', result.rows[0].time);
        client.release();
        return true;
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
        return false;
    }
};

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
    testConnection
};