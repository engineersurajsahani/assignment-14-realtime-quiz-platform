// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');

const { registerLobbyHandlers } = require('./sockets/lobbyHandler');
const gameEngine = require('./sockets/gameEngine');

const app = express();
const server = http.createServer(app);

// Enable CORS for API and Socket.io
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Fallback health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Socket connection lifecycle
io.on('connection', (socket) => {
  console.log(`[SOCKET] Client connected: ${socket.id}`);

  // Register Lobby & Room Handlers
  registerLobbyHandlers(io, socket, gameEngine);

  // Register Gameplay & Anti-Cheat Handlers
  gameEngine.registerGameHandlers(io, socket);

  socket.on('error', (err) => {
    console.error(`[SOCKET ERROR] ${socket.id}:`, err);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 Real-Time Quiz Platform Running!`);
  console.log(`📍 Local URL: http://localhost:${PORT}`);
  console.log(`🕹️ Host View:   http://localhost:${PORT}/host.html`);
  console.log(`📱 Player View: http://localhost:${PORT}/player.html`);
  console.log(`=========================================`);
});
