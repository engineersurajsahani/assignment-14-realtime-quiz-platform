const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { initLobbyHandlers } = require('./sockets/lobbyHandler');
const { initGameEngine } = require('./sockets/gameEngine');

const app = express();
const server = http.createServer(app);

// Enable CORS
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Load Questions Bank
const questionsPath = path.join(__dirname, 'data', 'questions.json');
let questionsBank = [];

try {
  const data = fs.readFileSync(questionsPath, 'utf8');
  questionsBank = JSON.parse(data);
  console.log(`[Server] Loaded ${questionsBank.length} questions from questions.json`);
} catch (err) {
  console.error('[Server] Error loading questions.json:', err.message);
  questionsBank = [
    {
      id: 1,
      question: "What is Node.js runtime based on?",
      options: ["V8", "SpiderMonkey", "Chakra", "JVM"],
      correctOption: 0,
      explanation: "Node.js is built on Google Chrome's V8 engine.",
      timeLimitSeconds: 15
    }
  ];
}

// Initialize Socket.io with CORS config
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Socket connection handling
io.on('connection', (socket) => {
  console.log(`[Socket] New connection established: ${socket.id}`);

  // Register socket modules
  initLobbyHandlers(io, socket, questionsBank);
  initGameEngine(io, socket);
});

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 Quiz Battle Server running on port ${PORT}`);
  console.log(`   Host View:   http://localhost:${PORT}/host.html`);
  console.log(`   Player View: http://localhost:${PORT}/player.html`);
  console.log(`=================================================`);
});
