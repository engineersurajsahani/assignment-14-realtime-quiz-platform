const rooms = new Map();

// Utility to generate a unique 4-digit PIN
function generatePin() {
  let pin;
  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
  } while (rooms.has(pin));
  return pin;
}

// Get clean list of players for lobby broadcast
function getLobbyRoster(room) {
  return room.players.map(p => ({
    name: p.name,
    score: p.score
  }));
}

function initLobbyHandlers(io, socket, questionsBank) {
  // Host initializes a quiz room
  socket.on('quiz:create', (data = {}) => {
    const hostName = data.hostName || 'Host';
    const category = data.category || 'General Tech';
    const pin = generatePin();
    const roomId = `quiz_${pin}`;

    const newRoom = {
      pin,
      roomId,
      hostSocketId: socket.id,
      hostName,
      category,
      state: 'LOBBY', // LOBBY, QUESTION, REVEAL, ENDED
      players: [],
      questions: JSON.parse(JSON.stringify(questionsBank)),
      currentQuestionIndex: 0,
      questionStartTime: null,
      timerInterval: null,
      countdown: 15
    };

    rooms.set(pin, newRoom);
    socket.join(roomId);

    socket.pin = pin;
    socket.isHost = true;

    console.log(`[Lobby] Room created with PIN: ${pin} by ${hostName}`);

    socket.emit('quiz:created', {
      pin,
      roomId
    });
  });

  // Player enters lobby with PIN
  socket.on('quiz:join', (data = {}) => {
    const { pin, playerName } = data;

    if (!pin || !rooms.has(pin)) {
      return socket.emit('quiz:error', { message: 'Invalid Quiz PIN. Please try again.' });
    }

    const room = rooms.get(pin);

    if (room.state !== 'LOBBY') {
      return socket.emit('quiz:error', { message: 'Quiz has already started or ended.' });
    }

    if (!playerName || playerName.trim() === '') {
      return socket.emit('quiz:error', { message: 'Please enter a valid player name.' });
    }

    const trimmedName = playerName.trim();
    const nameExists = room.players.some(
      p => p.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (nameExists) {
      return socket.emit('quiz:error', { message: 'Player name already taken in this lobby.' });
    }

    // Add player to room
    const newPlayer = {
      socketId: socket.id,
      name: trimmedName,
      score: 0,
      answered: false,
      currentAnswer: null
    };

    room.players.push(newPlayer);
    socket.join(room.roomId);

    socket.pin = pin;
    socket.playerName = trimmedName;
    socket.isHost = false;

    console.log(`[Lobby] Player ${trimmedName} joined room ${pin}`);

    socket.emit('quiz:joined', {
      pin,
      playerName: trimmedName,
      roomId: room.roomId
    });

    // Broadcast lobby roster to room
    io.to(room.roomId).emit('lobby:update', {
      players: getLobbyRoster(room)
    });
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    if (!socket.pin || !rooms.has(socket.pin)) return;

    const room = rooms.get(socket.pin);

    if (socket.isHost) {
      console.log(`[Lobby] Host disconnected from room ${socket.pin}`);
      io.to(room.roomId).emit('quiz:error', { message: 'Host has disconnected. Quiz closed.' });
      if (room.timerInterval) clearInterval(room.timerInterval);
      rooms.delete(socket.pin);
    } else {
      console.log(`[Lobby] Player ${socket.playerName} disconnected from room ${socket.pin}`);
      room.players = room.players.filter(p => p.socketId !== socket.id);
      
      if (room.state === 'LOBBY') {
        io.to(room.roomId).emit('lobby:update', {
          players: getLobbyRoster(room)
        });
      }
    }
  });
}

module.exports = {
  rooms,
  initLobbyHandlers,
  getLobbyRoster
};
