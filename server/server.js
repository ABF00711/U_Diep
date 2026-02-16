// HTTP server with Socket.io for multiplayer
// Run with: node server/server.js (or npm start from project root)
// Access at: http://localhost:3000 or http://YOUR_IP:3000

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const GameServer = require('./GameServer.js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Socket.io: verify JWT and attach user (id, email, username, balance) to socket
const { verifyToken } = require('./middleware/auth.js');
io.use(async (socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    socket.user = await verifyToken(token);
    next();
});

const PORT = process.env.PORT || 3000;

// JSON body parser for API
app.use(express.json());

// Auth API (register, login, me)
const authRoutes = require('./routes/auth.js');
app.use('/api/auth', authRoutes);

// Serve static files from the public directory
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// Serve shared Config.js for client
app.get('/shared/Config.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'shared', 'Config.js'));
});

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
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
