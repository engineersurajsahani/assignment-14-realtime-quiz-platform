const {
  games,
  defaultQuestions,
  getLeaderboard,
  startQuestion,
  handleAnswerSubmission
} = require('./gameEngine');

function generatePin() {
  let pin;
  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
  } while (games[pin]);
  return pin;
}

module.exports = function registerLobbyHandlers(io, socket) {
  // 1. Host creates a new Quiz Game Room
  socket.on('quiz:create', ({ hostName, category }) => {
    const pin = generatePin();
    const safeHostName = (hostName && hostName.trim()) || 'Host';
    const safeCategory = (category && category.trim()) || 'Technology';

    socket.join(pin);
    socket.isHost = true;
    socket.gamePin = pin;

    games[pin] = {
      pin,
      hostSocketId: socket.id,
      hostName: safeHostName,
      category: safeCategory,
      status: 'lobby',
      players: {},
      currentQuestionIndex: 0,
      questions: [...defaultQuestions],
      timerInterval: null,
      timeRemaining: 15,
      questionStartTime: 0
    };

    socket.emit('quiz:created', {
      pin,
      roomId: `quiz_${pin}`,
      category: safeCategory,
      totalQuestions: defaultQuestions.length
    });

    console.log(`🎮 Host '${safeHostName}' created Quiz Game with PIN: ${pin}`);
  });

  // 2. Player joins lobby with PIN
  socket.on('quiz:join', ({ pin, playerName }) => {
    const safePin = pin ? pin.trim() : '';
    const safeName = (playerName && playerName.trim()) || `Player_${Math.floor(Math.random() * 900 + 100)}`;
    const game = games[safePin];

    if (!game) {
      return socket.emit('quiz:error', { message: 'Invalid PIN. Room not found.' });
    }

    if (game.status !== 'lobby') {
      return socket.emit('quiz:error', { message: 'Game has already started.' });
    }

    socket.join(safePin);
    socket.gamePin = safePin;
    socket.playerName = safeName;
    socket.isHost = false;

    game.players[socket.id] = {
      socketId: socket.id,
      name: safeName,
      score: 0,
      answered: false,
      answerTime: 0,
      lastPoints: 0
    };

    socket.emit('quiz:joined', {
      pin: safePin,
      playerName: safeName,
      category: game.category,
      totalQuestions: game.questions.length
    });

    // Broadcast updated lobby roster to everyone in the room
    const roster = Object.values(game.players).map(p => ({ name: p.name, score: p.score }));
    io.to(safePin).emit('lobby:update', {
      players: roster,
      totalPlayers: roster.length
    });

    console.log(`🙋 Player '${safeName}' joined Lobby ${safePin}`);
  });

  // 3. Host starts game
  socket.on('quiz:start', ({ pin }) => {
    const game = games[pin];
    if (!game) return;

    if (socket.id !== game.hostSocketId) {
      return socket.emit('quiz:error', { message: 'Only the host can start the game.' });
    }

    if (Object.keys(game.players).length === 0) {
      return socket.emit('quiz:error', { message: 'Cannot start without any players in lobby.' });
    }

    console.log(`🚀 Host started Quiz Battle for PIN ${pin}!`);
    startQuestion(io, pin);
  });

  // 4. Player submits answer
  socket.on('answer:submit', (data) => {
    handleAnswerSubmission(io, socket, data);
  });

  // 5. Disconnection handling
  socket.on('disconnect', () => {
    const pin = socket.gamePin;
    if (pin && games[pin]) {
      const game = games[pin];

      if (socket.id === game.hostSocketId) {
        // Host disconnected
        clearInterval(game.timerInterval);
        io.to(pin).emit('quiz:error', { message: 'Host disconnected. Game ended.' });
        delete games[pin];
      } else if (game.players[socket.id]) {
        // Player disconnected
        delete game.players[socket.id];
        const roster = Object.values(game.players).map(p => ({ name: p.name, score: p.score }));
        io.to(pin).emit('lobby:update', {
          players: roster,
          totalPlayers: roster.length
        });
      }
    }
  });
};
