const games = {}; // pin -> { hostId, players: {socketId: {name, score}}, category, status }

const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString();

const registerLobbyHandlers = (io, socket) => {
  socket.on('quiz:create', ({ hostName, category }) => {
    const pin = generatePin();
    games[pin] = {
      hostId: socket.id,
      hostName,
      category,
      players: {},
      status: 'lobby',
      currentQuestion: -1
    };
    socket.join(`quiz_${pin}`);
    socket.data.pin = pin;
    socket.data.isHost = true;

    socket.emit('quiz:created', { pin, roomId: `quiz_${pin}` });
  });

  socket.on('quiz:join', ({ pin, playerName }) => {
    const game = games[pin];
    if (!game) {
      return socket.emit('quiz:error', { message: 'Invalid PIN' });
    }
    if (game.status !== 'lobby') {
      return socket.emit('quiz:error', { message: 'Game already started' });
    }

    game.players[socket.id] = { name: playerName, score: 0 };
    socket.join(`quiz_${pin}`);
    socket.data.pin = pin;
    socket.data.playerName = playerName;

    io.to(`quiz_${pin}`).emit('lobby:update', {
      players: Object.values(game.players).map(p => ({ name: p.name, score: p.score }))
    });
  });

  socket.on('disconnect', () => {
    const pin = socket.data.pin;
    if (!pin || !games[pin]) return;

    const game = games[pin];
    if (game.players[socket.id]) {
      delete game.players[socket.id];
      io.to(`quiz_${pin}`).emit('lobby:update', {
        players: Object.values(game.players).map(p => ({ name: p.name, score: p.score }))
      });
    }
    if (game.hostId === socket.id) {
      delete games[pin];
    }
  });
};

module.exports = { registerLobbyHandlers, games };