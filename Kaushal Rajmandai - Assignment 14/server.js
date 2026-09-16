const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const { registerLobbyHandlers } = require('./sockets/lobbyHandler');
const { registerGameHandlers } = require('./sockets/gameEngine');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);
  registerLobbyHandlers(io, socket);
  registerGameHandlers(io, socket);
});

const PORT = process.env.PORT || 5050;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));