function generatePin(rooms) {
  let pin;
  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
  } while (rooms.has(pin));
  return pin;
}

function initLobbyHandlers(io, socket, rooms, questionBank) {
  socket.on('quiz:create', (payload = {}) => {
    const { hostName = 'Host Admin', category = 'General Tech' } = payload;
    const pin = generatePin(rooms);
    const roomId = `quiz_${pin}`;

    let roomQuestions = questionBank;
    if (category && category !== 'All Categories' && category !== 'General Tech') {
      const filtered = questionBank.filter(q => q.category === category);
      if (filtered.length > 0) roomQuestions = filtered;
    }

    const roomState = {
      pin,
      roomId,
      hostSocketId: socket.id,
      hostName,
      category,
      state: 'LOBBY',
      players: new Map(),
      questions: roomQuestions,
      currentQuestionIndex: 0,
      roundTimer: null,
      questionStartTime: null,
      roundAnswers: new Map()
    };

    rooms.set(pin, roomState);
    socket.join(roomId);

    console.log(`[LOBBY] Room created PIN: ${pin} by Host: ${hostName}`);

    socket.emit('quiz:created', {
      pin,
      roomId,
      category,
      questionCount: roomQuestions.length
    });
  });

  socket.on('quiz:join', (payload = {}, callback) => {
    const { pin, playerName } = payload;

    if (!pin || !playerName || !playerName.trim()) {
      const errorMsg = 'Please provide a valid PIN and Player Name.';
      if (typeof callback === 'function') callback({ success: false, message: errorMsg });
      socket.emit('error', { message: errorMsg });
      return;
    }

    const cleanPin = pin.toString().trim();
    const cleanName = playerName.trim();
    const room = rooms.get(cleanPin);

    if (!room) {
      const errorMsg = `Invalid PIN: ${cleanPin}. Room does not exist.`;
      if (typeof callback === 'function') callback({ success: false, message: errorMsg });
      socket.emit('quiz:join_error', { message: errorMsg });
      return;
    }

    if (room.state !== 'LOBBY') {
      const errorMsg = 'Game has already started or ended in this room.';
      if (typeof callback === 'function') callback({ success: false, message: errorMsg });
      socket.emit('quiz:join_error', { message: errorMsg });
      return;
    }

    let finalPlayerName = cleanName;
    const existingNames = Array.from(room.players.values()).map(p => p.name);
    if (existingNames.includes(cleanName)) {
      finalPlayerName = `${cleanName} (${Math.floor(Math.random() * 90 + 10)})`;
    }

    const playerData = {
      socketId: socket.id,
      name: finalPlayerName,
      score: 0,
      answeredThisRound: false,
      lastScoreAdded: 0
    };
    room.players.set(socket.id, playerData);

    socket.join(room.roomId);

    console.log(`[LOBBY] Player "${finalPlayerName}" joined Room PIN: ${cleanPin}`);

    if (typeof callback === 'function') {
      callback({
        success: true,
        pin: cleanPin,
        playerName: finalPlayerName,
        totalPlayers: room.players.size
      });
    }
    socket.emit('quiz:joined', {
      pin: cleanPin,
      playerName: finalPlayerName,
      totalPlayers: room.players.size
    });

    const playerList = Array.from(room.players.values()).map(p => ({
      name: p.name,
      score: p.score
    }));

    io.to(room.roomId).emit('lobby:update', {
      players: playerList,
      totalPlayers: playerList.length
    });
  });
}

module.exports = {
  generatePin,
  initLobbyHandlers
};
