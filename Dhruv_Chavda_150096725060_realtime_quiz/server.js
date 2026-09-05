const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');

const registerLobbyHandlers = require('./sockets/lobbyHandler');

// Load environment configuration
dotenv.config();

const app = express();
const server = http.createServer(app);

// Configure Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// API Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: '🧠 Real-Time Multiplayer Live Quiz Engine is operational',
    version: '1.0.0'
  });
});

// Socket connection pipeline
io.on('connection', (socket) => {
  console.log(`⚡ Client connected: ${socket.id}`);
  registerLobbyHandlers(io, socket);
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Live Quiz Battle Server running at http://localhost:${PORT}`);
  console.log(`🎮 Host Dashboard: http://localhost:${PORT}/host.html`);
  console.log(`📱 Player Gamepad: http://localhost:${PORT}/player.html`);
});

module.exports = { app, server, io };
