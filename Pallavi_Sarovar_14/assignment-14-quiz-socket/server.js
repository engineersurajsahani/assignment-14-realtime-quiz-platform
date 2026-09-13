require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { createRoom, addPlayer, roomRoster, sanitizeName } = require('./sockets/lobbyHandler');
const { TOTAL_TIME_LIMIT_MS, calculateScore, leaderboard, publicQuestion, clearRoomTimer } = require('./sockets/gameEngine');

const PORT = Number(process.env.PORT) || 5000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CLIENT_ORIGIN || '*' } });
const rooms = new Map();
const questions = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'questions.json'), 'utf8'));

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));

function getRoom(socket, pin) {
  const room = rooms.get(String(pin || '').trim());
  if (!room) socket.emit('quiz:error', { message: 'Room not found. Check the PIN and try again.' });
  return room;
}

function broadcastLobby(room) {
  io.to(room.roomId).emit('lobby:update', {
    pin: room.pin,
    hostName: room.hostName,
    category: room.category,
    players: roomRoster(room)
  });
}

function emitLeaderboard(room) {
  io.to(room.roomId).emit('leaderboard:update', { leaderboard: leaderboard(room) });
}

function finishQuestion(room) {
  if (!rooms.has(room.pin) || room.status !== 'playing') return;
  clearRoomTimer(room);
  const question = questions[room.currentQuestionIndex];
  room.status = 'reveal';
  io.to(room.roomId).emit('question:time_up', {
    correctOption: question.correctOption,
    explanation: question.explanation
  });
  emitLeaderboard(room);

  setTimeout(() => {
    if (!rooms.has(room.pin) || room.status !== 'reveal') return;
    if (room.currentQuestionIndex >= questions.length - 1) {
      room.status = 'ended';
      const ranks = leaderboard(room);
      io.to(room.roomId).emit('quiz:ended', {
        winner: ranks[0] || null,
        finalRanks: ranks
      });
      return;
    }
    startQuestion(room);
  }, 2800);
}

function startQuestion(room) {
  clearRoomTimer(room);
  room.currentQuestionIndex += 1;
  room.status = 'playing';
  room.answers.clear();
  room.players.forEach(player => { player.answered = false; });
  room.questionStartedAt = Date.now();
  const question = questions[room.currentQuestionIndex];
  io.to(room.roomId).emit('question:start', publicQuestion(question, room.currentQuestionIndex, questions.length));
  broadcastLobby(room);
  room.questionTimer = setTimeout(() => finishQuestion(room), TOTAL_TIME_LIMIT_MS);
}

io.on('connection', socket => {
  socket.on('quiz:create', ({ hostName, category } = {}) => {
    const room = createRoom(rooms, hostName, category);
    room.hostSocketId = socket.id;
    socket.join(room.roomId);
    socket.data.role = 'host';
    socket.data.pin = room.pin;
    socket.emit('quiz:created', { pin: room.pin, roomId: room.roomId, hostName: room.hostName, category: room.category });
    broadcastLobby(room);
  });

  socket.on('quiz:join', ({ pin, playerName } = {}) => {
    const room = getRoom(socket, pin);
    if (!room) return;
    if (room.status !== 'lobby') return socket.emit('quiz:error', { message: 'This quiz has already started.' });
    if (room.players.size >= 30) return socket.emit('quiz:error', { message: 'This room is full (30 players maximum).' });
    const player = addPlayer(room, socket.id, playerName);
    socket.join(room.roomId);
    socket.data.role = 'player';
    socket.data.pin = room.pin;
    socket.data.playerName = player.name;
    socket.emit('quiz:joined', { pin: room.pin, roomId: room.roomId, player: { name: player.name, score: player.score } });
    broadcastLobby(room);
  });

  socket.on('quiz:start', ({ pin } = {}) => {
    const room = getRoom(socket, pin);
    if (!room) return;
    if (room.hostSocketId !== socket.id) return socket.emit('quiz:error', { message: 'Only the host can start the quiz.' });
    if (room.status !== 'lobby') return socket.emit('quiz:error', { message: 'The quiz is already running.' });
    if (room.players.size < 1) return socket.emit('quiz:error', { message: 'Invite at least one player before starting.' });
    startQuestion(room);
  });

  socket.on('answer:submit', ({ pin, selectedOption } = {}) => {
    const room = getRoom(socket, pin);
    if (!room || socket.data.role !== 'player') return;
    if (room.status !== 'playing') return socket.emit('quiz:error', { message: 'Answering is closed for this question.' });
    if (room.answers.has(socket.id)) return socket.emit('quiz:error', { message: 'You already answered this question.' });

    const option = Number(selectedOption);
    const question = questions[room.currentQuestionIndex];
    if (!Number.isInteger(option) || option < 0 || option >= question.options.length) {
      return socket.emit('quiz:error', { message: 'Invalid answer option.' });
    }

    const timeTakenMs = Math.max(0, Date.now() - room.questionStartedAt);
    if (timeTakenMs > TOTAL_TIME_LIMIT_MS) return socket.emit('quiz:error', { message: 'Time is up. Your answer was rejected.' });

    const player = room.players.get(socket.id);
    const isCorrect = option === question.correctOption;
    const points = calculateScore(isCorrect, timeTakenMs, TOTAL_TIME_LIMIT_MS);
    player.score += points;
    player.answered = true;
    room.answers.set(socket.id, { selectedOption: option, isCorrect, timeTakenMs, points });

    socket.emit('answer:result', { isCorrect, points, timeTakenMs });
    io.to(room.roomId).emit('player:answered', { name: player.name, answeredCount: room.answers.size, totalPlayers: room.players.size });
    emitLeaderboard(room);

    if (room.answers.size === room.players.size) finishQuestion(room);
  });

  socket.on('disconnect', () => {
    const pin = socket.data.pin;
    const room = rooms.get(pin);
    if (!room) return;

    if (room.hostSocketId === socket.id) {
      clearRoomTimer(room);
      io.to(room.roomId).emit('quiz:error', { message: 'The host disconnected. This quiz has ended.' });
      io.in(room.roomId).socketsLeave(room.roomId);
      rooms.delete(pin);
      return;
    }

    if (room.players.delete(socket.id)) {
      if (room.status === 'playing' && room.answers.size >= room.players.size) finishQuestion(room);
      broadcastLobby(room);
      emitLeaderboard(room);
    }
  });
});

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
server.listen(PORT, () => console.log(`Quiz Arena running at http://localhost:${PORT}`));
