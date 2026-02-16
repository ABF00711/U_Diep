// MySQL connection pool
// Set env vars: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (or use defaults for local dev)

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'u_diep',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function query(sql, params = []) {
    const [rows] = await pool.execute(sql, params);
    return rows;
}

async function getConnection() {
    return pool.getConnection();
}

module.exports = { pool, query, getConnection };
