// User database operations

const { query } = require('./connection.js');
const GameConfig = require('../../shared/Config.js');

const DEFAULT_BALANCE = GameConfig.ECONOMY.INITIAL_BALANCE || 100;
const DEFAULT_XP_TO_NEXT = GameConfig.XP.BASE_XP_TO_NEXT_LEVEL || 100;
const DEFAULT_STATS = JSON.stringify({
    maxHealth: 0, reload: 0, movementSpeed: 0, bulletSpeed: 0,
    bulletDamage: 0, bulletPenetration: 0, bulletSize: 0, bodyDamage: 0, healthRegen: 0
});

/**
 * Create a new user (register).
 * @returns {object} { id, email, username, balance, level, xp, ... }
 */
async function createUser(email, username, passwordHash) {
    const result = await query(
        'INSERT INTO users (email, username, password_hash, balance, level, xp, xp_to_next_level, stat_points) VALUES (?, ?, ?, ?, 1, 0, ?, ?)',
        [email, username, passwordHash, DEFAULT_BALANCE, DEFAULT_XP_TO_NEXT, DEFAULT_STATS]
    );
    return await getUserById(result.insertId);
}

/**
 * Get user by ID (without password_hash), including game stats.
 */
async function getUserById(id) {
    const rows = await query(
        'SELECT id, email, username, balance, level, xp, xp_to_next_level, stat_points, created_at, updated_at FROM users WHERE id = ?',
        [id]
    );
    const row = rows[0];
    if (!row) return null;
    const raw = row.stat_points;
    row.stats = (raw && typeof raw === 'string' ? JSON.parse(raw) : raw) || JSON.parse(DEFAULT_STATS);
    delete row.stat_points;
    return row;
}

/**
 * Get game stats for a user (level, xp, xp_to_next_level, stats). For join/rejoin.
 */
async function getGameStats(userId) {
    const rows = await query(
        'SELECT level, xp, xp_to_next_level, stat_points FROM users WHERE id = ?',
        [userId]
    );
    const row = rows[0];
    if (!row) return null;
    const raw = row.stat_points;
    const stats = (raw && typeof raw === 'string' ? JSON.parse(raw) : raw) || JSON.parse(DEFAULT_STATS);
    return {
        level: row.level || 1,
        xp: row.xp || 0,
        xpToNextLevel: row.xp_to_next_level || DEFAULT_XP_TO_NEXT,
        stats
    };
}

/**
 * Update game stats (level, xp, xpToNextLevel, stats) for a user.
 */
async function updateGameStats(userId, gameStats) {
    const { level, xp, xpToNextLevel, stats } = gameStats;
    const statsJson = typeof stats === 'string' ? stats : JSON.stringify(stats || {});
    await query(
        'UPDATE users SET level = ?, xp = ?, xp_to_next_level = ?, stat_points = ? WHERE id = ?',
        [level || 1, xp || 0, xpToNextLevel || DEFAULT_XP_TO_NEXT, statsJson, userId]
    );
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
    getBalance,
    getGameStats,
    updateGameStats
};
