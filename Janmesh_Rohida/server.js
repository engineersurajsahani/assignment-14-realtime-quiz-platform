/**
 * server.js - Real-Time Multiplayer Live Quiz Battle Server
 * Express + Socket.io Server Entry Point
 */

require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');

const lobbyHandler = require('./sockets/lobbyHandler');
const gameEngine = require('./sockets/gameEngine');

const app = express();
const server = http.createServer(app);

// Enable CORS for cross-origin socket requests if needed
app.use(cors());
app.use(express.json());

// Serve static frontend assets from /public directory
app.use(express.static(path.join(__dirname, 'public')));

// Root route fallback to index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.io initialization with CORS configuration
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// In-memory Game State Store (keyed by 4-digit PIN string)
const rooms = new Map();

// Socket connection lifecycle handlers
io.on('connection', (socket) => {
  console.log(`[SOCKET] Client connected: ${socket.id}`);

  // --- Lobby & Room Management Events ---
  
  // Host initializes a new room PIN
  socket.on('quiz:create', (data) => {
    lobbyHandler.createRoom(rooms, socket, data);
  });

  // Player joins an existing room PIN
  socket.on('quiz:join', (data) => {
    lobbyHandler.joinRoom(rooms, socket, data, io);
  });

  // Host clicks "Start Game"
  socket.on('quiz:start', (data) => {
    gameEngine.startGame(rooms, socket, data, io);
  });

  // --- Gameplay & Answer Events ---

  // Player submits a chosen option
  socket.on('answer:submit', (data) => {
    gameEngine.submitAnswer(rooms, socket, data, io);
  });

  // Handle client disconnection
  socket.on('disconnect', () => {
    console.log(`[SOCKET] Client disconnected: ${socket.id}`);
    lobbyHandler.handleDisconnect(rooms, socket, io);
  });
});

let PORT = process.env.PORT || 5000;

function startServer(portToTry) {
  server.listen(portToTry)
    .on('listening', () => {
      console.log(`====================================================`);
      console.log(`🚀 Real-Time Quiz Battle Server is running!`);
      console.log(`🌐 Local URL: http://localhost:${portToTry}`);
      console.log(`====================================================`);
    })
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[WARNING] Port ${portToTry} is in use (e.g., macOS AirPlay Receiver). Retrying on port ${portToTry + 1}...`);
        startServer(portToTry + 1);
      } else {
        console.error('[ERROR] Server startup error:', err);
      }
    });
}

startServer(PORT);

