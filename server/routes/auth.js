// Auth routes: register, login
// Funding (deposit/withdraw) will be added in a later version (Veta/Beta).

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const userRepository = require('../db/userRepository.js');
const { requireAuth } = require('../middleware/auth.js');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/auth.js');

const SALT_ROUNDS = 10;

/**
 * POST /api/auth/register
 * Body: { email, username, password }
 */
router.post('/register', async (req, res) => {
    try {
        const { email, username, password } = req.body;

        if (!email || !username || !password) {
            return res.status(400).json({ error: 'Email, username, and password are required' });
        }

        const emailTrimmed = String(email).trim().toLowerCase();
        const usernameTrimmed = String(username).trim();

        if (usernameTrimmed.length < 2 || usernameTrimmed.length > 64) {
            return res.status(400).json({ error: 'Username must be 2–64 characters' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const user = await userRepository.createUser(emailTrimmed, usernameTrimmed, passwordHash);

        const token = jwt.sign(
            { userId: user.id },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.status(201).json({
            token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                balance: Number(user.balance)
            }
        });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Email or username already registered' });
        }
        console.error('Register error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

/**
 * POST /api/auth/login
 * Body: { email, password } OR { username, password }
 */
router.post('/login', async (req, res) => {
    try {
        const { email, username, password } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }

        let user;
        if (email) {
            user = await userRepository.getUserByEmail(String(email).trim().toLowerCase());
        } else if (username) {
            user = await userRepository.getUserByUsername(String(username).trim());
        } else {
            return res.status(400).json({ error: 'Email or username is required' });
        }

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Invalid email/username or password' });
        }

        const token = jwt.sign(
            { userId: user.id },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                balance: Number(user.balance)
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * GET /api/auth/me
 * Requires Authorization: Bearer <token>
 * Returns current user (id, email, username, balance).
 */
router.get('/me', requireAuth, async (req, res) => {
    try {
        const fresh = await userRepository.getUserById(req.user.id);
        res.json({
            user: {
                id: fresh.id,
                email: fresh.email,
                username: fresh.username,
                balance: Number(fresh.balance)
            }
        });
    } catch (err) {
        console.error('Me error:', err);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

module.exports = router;
