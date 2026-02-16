// Verify JWT and attach user to request (for REST) or return user (for Socket.io)

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/auth.js');
const userRepository = require('../db/userRepository.js');

/**
 * REST middleware: require valid JWT, set req.user = { id, email, username, balance }.
 */
async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await userRepository.getUserById(decoded.userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

/**
 * Verify JWT from token string; return user { id, email, username, balance } or null.
 * Used by Socket.io connection middleware.
 */
async function verifyToken(token) {
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await userRepository.getUserById(decoded.userId);
        return user ? user : null;
    } catch {
        return null;
    }
}

module.exports = { requireAuth, verifyToken };
