/**
 * Assignment 14: Real-Time Multiplayer Live Quiz Battle
 * Server Entrypoint (Express + Socket.io)
 * Author: Prince Yadav (150096725032)
 */

require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');

const questionsData = require('./data/questions.json');
const { rooms, registerLobbyHandlers } = require('./sockets/lobbyHandler');
const { registerGameHandlers } = require('./sockets/gameEngine');

const app = express();
const server = http.createServer(app);

// CORS configuration for REST and WebSockets
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Socket.io initialization with cross-origin capabilities
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// REST Healthcheck endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    activeRooms: rooms.size
  });
});

// REST Endpoint: Inspect active rooms (admin/debugging)
app.get('/api/rooms', (req, res) => {
  const roomList = [];
  for (const [pin, room] of rooms.entries()) {
    roomList.push({
      pin,
      roomId: room.roomId,
      hostName: room.hostName,
      category: room.category,
      state: room.state,
      playerCount: room.players.size,
      currentQuestion: room.currentQuestionIndex + 1,
      totalQuestions: room.questions.length
    });
  }
  res.json({ success: true, count: roomList.length, rooms: roomList });
});

// REST Endpoint: Question bank metadata
app.get('/api/questions/meta', (req, res) => {
  const categories = [...new Set(questionsData.map((q) => q.category))];
  res.json({
    totalQuestions: questionsData.length,
    categories
  });
});

// Socket.io Connection Handler
io.on('connection', (socket) => {
  console.log(`[SOCKET] Client connected: ${socket.id}`);

  // Register modular socket handlers
  registerLobbyHandlers(io, socket, questionsData);
  registerGameHandlers(io, socket);

  socket.on('disconnect', (reason) => {
    console.log(`[SOCKET] Client disconnected: ${socket.id} (${reason})`);
  });
});

const DEFAULT_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;

function startServer(port) {
  const onListening = () => {
    server.removeListener('error', onError);
    console.log(`=======================================================`);
    console.log(` 🚀 QUIZ BATTLE ARENA SERVER RUNNING ON PORT ${port} `);
    console.log(` Host View:   http://localhost:${port}/host.html       `);
    console.log(` Player View: http://localhost:${port}/player.html     `);
    console.log(` Landing:     http://localhost:${port}/index.html      `);
    console.log(`=======================================================`);
  };

  const onError = (err) => {
    server.removeListener('listening', onListening);
    if (err.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      console.warn(`[WARN] Port ${port} is occupied (commonly macOS AirPlay). Falling back to port ${nextPort}...`);
      startServer(nextPort);
    } else {
      console.error('[SERVER ERROR]', err);
    }
  };

  server.once('listening', onListening);
  server.once('error', onError);
  server.listen(port);
}

startServer(DEFAULT_PORT);

module.exports = { app, server, io };
