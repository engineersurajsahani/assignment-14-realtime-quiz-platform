const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.static('public'));

const lobbyHandler = require('./sockets/lobbyHandler');
const gameEngine = require('./sockets/gameEngine');

io.on('connection', (socket) => {
  lobbyHandler(io, socket);
  gameEngine(io, socket);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
