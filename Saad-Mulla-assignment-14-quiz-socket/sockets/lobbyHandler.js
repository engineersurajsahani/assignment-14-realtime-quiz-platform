const games = new Map();

function generatePin() {
  let pin;
  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
  } while (games.has(pin));
  return pin;
}

function registerLobbyHandlers(io, socket) {
  socket.on('quiz:create', (data) => {
    const pin = generatePin();
    const roomId = 'quiz_' + pin;

    const game = {
      pin,
      roomId,
      hostSocketId: socket.id,
      hostName: data?.hostName || 'Host',
      category: data?.category || 'General',
      state: 'LOBBY',
      players: new Map(),
      currentQuestionIndex: 0,
      questionStartTime: null,
      roundTimer: null
    };

    games.set(pin, game);
    socket.join(roomId);

    socket.emit('quiz:created', { pin, roomId });
  });

  socket.on('quiz:join', (data) => {
    const pin = data?.pin;
    const playerName = data?.playerName?.trim();

    if (!pin || !games.has(pin)) {
      return socket.emit('error:message', { message: 'Invalid Quiz PIN' });
    }

    const game = games.get(pin);
    if (game.state !== 'LOBBY') {
      return socket.emit('error:message', { message: 'Game has already started' });
    }

    if (!playerName) {
      return socket.emit('error:message', { message: 'Player name is required' });
    }

    game.players.set(socket.id, {
      id: socket.id,
      name: playerName,
      score: 0,
      answeredInCurrentRound: false
    });

    socket.join(game.roomId);
    socket.emit('quiz:joined', { pin, playerName });

    broadcastLobbyUpdate(io, game);
  });

  socket.on('disconnect', () => {
    games.forEach((game, pin) => {
      if (game.players.has(socket.id)) {
        game.players.delete(socket.id);
        broadcastLobbyUpdate(io, game);
      }
    });
  });
}

function broadcastLobbyUpdate(io, game) {
  const playersList = Array.from(game.players.values()).map(p => ({
    name: p.name,
    score: p.score
  }));

  io.to(game.roomId).emit('lobby:update', { players: playersList });
}

module.exports = {
  games,
  registerLobbyHandlers,
  broadcastLobbyUpdate
};