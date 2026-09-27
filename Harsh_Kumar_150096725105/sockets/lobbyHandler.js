const { games } = require('./gameStore');

module.exports = (io, socket) => {
  socket.on('quiz:create', ({ hostName, category }) => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    const roomId = `quiz_${pin}`;
    
    games[roomId] = {
      pin,
      roomId,
      hostId: socket.id,
      hostName,
      category,
      players: {},
      state: 'lobby', // lobby, playing, ended
      currentQuestionIndex: -1,
      startTime: null,
      timer: null
    };

    socket.join(roomId);
    socket.emit('quiz:created', { pin, roomId });
  });

  socket.on('quiz:join', ({ pin, playerName }) => {
    const roomId = `quiz_${pin}`;
    const game = games[roomId];
    
    if (!game || game.state !== 'lobby') {
      return socket.emit('error', { message: 'Invalid PIN or Game already started' });
    }

    game.players[socket.id] = {
      name: playerName,
      score: 0,
      hasAnswered: false
    };

    socket.join(roomId);
    
    const playersList = Object.values(game.players).map(p => ({ name: p.name, score: p.score }));
    io.to(roomId).emit('lobby:update', { players: playersList });
  });
};
