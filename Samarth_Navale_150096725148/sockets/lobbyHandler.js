const quizRooms = {};

const generatePin = () => {
  let pin;
  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
  } while (quizRooms[pin]);
  return pin;
};

const getLobbyPlayers = (pin) => {
  const room = quizRooms[pin];
  if (!room) return [];
  return Object.values(room.players).map((p) => ({
    name: p.name,
    score: p.score
  }));
};

const setupLobbyHandler = (io, socket) => {
  socket.on('quiz:create', ({ hostName, category }) => {
    const pin = generatePin();
    const roomId = `quiz_${pin}`;

    quizRooms[pin] = {
      pin,
      roomId,
      hostId: socket.id,
      hostName: hostName || 'Host',
      category: category || 'General Tech',
      status: 'lobby',
      players: {},
      currentQuestionIndex: -1,
      currentQuestionStartTime: 0,
      timer: null
    };

    socket.join(roomId);
    socket.isHost = true;
    socket.currentPin = pin;

    socket.emit('quiz:created', { pin, roomId });
  });

  socket.on('quiz:join', ({ pin, playerName }) => {
    if (!pin || !quizRooms[pin]) {
      return socket.emit('quiz:error', { message: 'Invalid or expired Quiz PIN' });
    }

    const room = quizRooms[pin];
    if (room.status !== 'lobby') {
      return socket.emit('quiz:error', { message: 'Game has already started' });
    }

    const name = (playerName || 'Player').trim();
    socket.join(room.roomId);
    socket.currentPin = pin;
    socket.playerName = name;

    room.players[socket.id] = {
      socketId: socket.id,
      name,
      score: 0,
      answered: false
    };

    socket.emit('quiz:joined', { pin, playerName: name });

    io.to(room.roomId).emit('lobby:update', {
      players: getLobbyPlayers(pin)
    });
  });

  socket.on('disconnect', () => {
    const pin = socket.currentPin;
    if (pin && quizRooms[pin]) {
      const room = quizRooms[pin];
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        io.to(room.roomId).emit('lobby:update', {
          players: getLobbyPlayers(pin)
        });
      }
    }
  });
};

module.exports = { setupLobbyHandler, quizRooms, getLobbyPlayers };
