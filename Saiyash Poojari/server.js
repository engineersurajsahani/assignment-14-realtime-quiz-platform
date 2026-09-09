const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { initLobbyHandlers } = require('./sockets/lobbyHandler');
const { initGameEngineHandlers } = require('./sockets/gameEngine');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

let questionsBank = [];
const questionsPath = path.join(__dirname, 'data', 'questions.json');

try {
  const data = fs.readFileSync(questionsPath, 'utf8');
  questionsBank = JSON.parse(data);
  console.log(`[SERVER] Loaded ${questionsBank.length} questions from questions.json`);
} catch (err) {
  console.error('[SERVER] Failed to read questions.json:', err);
  questionsBank = [
    {
      id: 1,
      category: 'General Tech',
      question: 'What is Node.js built on?',
      options: ['V8 Engine', 'SpiderMonkey', 'Chakra', 'JVM'],
      correctOption: 0,
      explanation: 'Node.js is built on Google Chrome V8 engine.',
      timeLimitSeconds: 15
    }
  ];
}

const rooms = new Map();

app.get('/api/categories', (req, res) => {
  const categories = Array.from(new Set(questionsBank.map(q => q.category)));
  res.json({ categories });
});

io.on('connection', (socket) => {
  console.log(`[SOCKET] Client connected: ${socket.id}`);

  initLobbyHandlers(io, socket, rooms, questionsBank);
  initGameEngineHandlers(io, socket, rooms);

  socket.on('disconnect', () => {
    console.log(`[SOCKET] Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`QUIZ BATTLE ARENA SERVER RUNNING ON PORT ${PORT}`);
  console.log(`Open Host Dashboard : http://localhost:${PORT}/host.html`);
  console.log(`Open Player Gamepad : http://localhost:${PORT}/player.html`);
  console.log(`=======================================================`);
});
