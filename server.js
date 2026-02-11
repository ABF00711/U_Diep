// HTTP server with Socket.io for multiplayer
// Run with: node server.js
// Access at: http://localhost:3000 or http://YOUR_IP:3000

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const GameServer = require('./js/GameServer.js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Serve static files from the project root
app.use(express.static(__dirname));

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize game server
const gameServer = new GameServer(io);

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 U_Diep server is running!`);
    console.log(`\n📍 Local:   http://localhost:${PORT}`);
    console.log(`📍 Network:  http://${getLocalIP()}:${PORT}`);
    console.log(`\nPress Ctrl+C to stop the server\n`);
});

// Get local IP address
function getLocalIP() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip internal (loopback) and non-IPv4 addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}
