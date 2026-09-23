const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { registerLobbyHandlers } = require('./sockets/lobbyHandler');
const registerGameEngineHandlers = require('./sockets/gameEngine');

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

io.on('connection', (socket) => {
  console.log('[Socket Connected] ID: ' + socket.id);

  registerLobbyHandlers(io, socket);
  registerGameEngineHandlers(io, socket);

  socket.on('disconnect', () => {
    console.log('[Socket Disconnected] ID: ' + socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('Quiz Engine running on port ' + PORT);
});