// Server announcement (title + content). Shown when user opens the game.
// Set via env: ANNOUNCEMENT_TITLE, ANNOUNCEMENT_CONTENT (optional)

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    const title = process.env.ANNOUNCEMENT_TITLE || 'New Announcement';
    const content = process.env.ANNOUNCEMENT_CONTENT || 'This is a new announcement';
    res.json({ title, content });
});

module.exports = router;
