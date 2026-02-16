// User database operations

const { query } = require('./connection.js');
const GameConfig = require('../../shared/Config.js');

const DEFAULT_BALANCE = GameConfig.ECONOMY.INITIAL_BALANCE || 100;

/**
 * Create a new user (register).
 * @returns {object} { id, email, username, balance, created_at }
 */
async function createUser(email, username, passwordHash) {
    const result = await query(
        'INSERT INTO users (email, username, password_hash, balance) VALUES (?, ?, ?, ?)',
        [email, username, passwordHash, DEFAULT_BALANCE]
    );
    return await getUserById(result.insertId);
}

/**
 * Get user by ID (without password_hash).
 */
async function getUserById(id) {
    const rows = await query(
        'SELECT id, email, username, balance, created_at, updated_at FROM users WHERE id = ?',
        [id]
    );
    return rows[0] || null;
}

/**
 * Get user by email (for login; includes password_hash for verification).
 */
async function getUserByEmail(email) {
    const rows = await query(
        'SELECT id, email, username, password_hash, balance FROM users WHERE email = ?',
        [email]
    );
    return rows[0] || null;
}

/**
 * Get user by username (for login; includes password_hash for verification).
 */
async function getUserByUsername(username) {
    const rows = await query(
        'SELECT id, email, username, password_hash, balance FROM users WHERE username = ?',
        [username]
    );
    return rows[0] || null;
}

/**
 * Update user balance (after stake deduction, kill reward, refund, etc.).
 */
async function updateBalance(userId, newBalance) {
    const safeBalance = Math.max(0, Number(newBalance));
    await query('UPDATE users SET balance = ? WHERE id = ?', [safeBalance, userId]);
    return safeBalance;
}

/**
 * Get current balance for a user.
 */
async function getBalance(userId) {
    const rows = await query('SELECT balance FROM users WHERE id = ?', [userId]);
    return rows[0] ? Number(rows[0].balance) : 0;
}

module.exports = {
    createUser,
    getUserById,
    getUserByEmail,
    getUserByUsername,
    updateBalance,
    getBalance
};
