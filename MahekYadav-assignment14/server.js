require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { registerLobbyHandlers } = require('./sockets/lobbyHandler');
const { registerGameHandlers, clearRoomTimer } = require('./sockets/gameEngine');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 5000;
const rooms = new Map();
const questions = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'questions.json'), 'utf8'));

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => res.json({ status: 'ok', rooms: rooms.size }));

function generatePin(roomMap) {
  let pin;
  do {
    pin = String(Math.floor(1000 + Math.random() * 9000));
  } while (roomMap.has(pin));
  return pin;
}

function getRoom(roomMap, pin) {
  return roomMap.get(String(pin || '').trim());
}

function getPlayers(room) {
  return [...room.players.values()].map(({ name, score }) => ({ name, score }));
}

io.on('connection', (socket) => {
  registerLobbyHandlers(io, socket, rooms, questions);
  registerGameHandlers(io, socket, rooms);

  socket.on('disconnect', () => {
    const pin = socket.data.quizPin;
    const room = rooms.get(pin);
    if (!room) return;

    if (room.hostSocketId === socket.id) {
      clearRoomTimer(room);
      io.to(room.roomId).emit('quiz:error', { message: 'The host disconnected. Quiz ended.' });
      io.in(room.roomId).socketsLeave(room.roomId);
      rooms.delete(pin);
      return;
    }

    room.players.delete(socket.id);
    room.answered.delete(socket.id);
    io.to(room.roomId).emit('lobby:update', { players: getPlayers(room) });
  });
});

server.listen(PORT, () => {
  console.log(`Quiz server running at http://localhost:${PORT}`);
});

module.exports = { getRoom, generatePin, getPlayers };
