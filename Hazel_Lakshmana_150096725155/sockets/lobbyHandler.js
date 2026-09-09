function generatePin(roomMap) {
  let pin;
  do {
    pin = String(Math.floor(1000 + Math.random() * 9000));
  } while (roomMap.has(pin));
  return pin;
}

function getRoom(roomMap, pin) {
  return roomMap.get(String(pin || '').trim());
}

function getPlayers(room) {
  return [...room.players.values()].map(({ name, score }) => ({ name, score }));
}

function registerLobbyHandlers(io, socket, rooms, questions) {
  socket.on('quiz:create', ({ hostName, category }) => {
    const cleanHostName = String(hostName || '').trim().slice(0, 30);
    const cleanCategory = String(category || 'Tech').trim();

    if (!cleanHostName) {
      socket.emit('quiz:error', { message: 'Host name is required.' });
      return;
    }

    let pin = generatePin(rooms);
    const roomId = `quiz_${pin}`;
    const categoryQuestions = questions.filter((q) => q.category.toLowerCase() === cleanCategory.toLowerCase());
    const selectedQuestions = categoryQuestions.length >= 5 ? categoryQuestions.slice(0, 5) : questions.slice(0, 5);

    const room = {
      pin,
      roomId,
      hostSocketId: socket.id,
      hostName: cleanHostName,
      category: cleanCategory,
      players: new Map(),
      questions: selectedQuestions,
      currentIndex: -1,
      started: false,
      ended: false,
      questionStartedAt: null,
      timer: null,
      answered: new Set()
    };

    rooms.set(pin, room);
    socket.join(roomId);
    socket.data.quizPin = pin;
    socket.data.role = 'host';
    socket.emit('quiz:created', { pin, roomId });
    io.to(roomId).emit('lobby:update', { players: getPlayers(room) });
  });

  socket.on('quiz:join', ({ pin, playerName }) => {
    const normalizedPin = String(pin || '').trim();
    const cleanName = String(playerName || '').trim().slice(0, 30);
    const room = getRoom(rooms, normalizedPin);

    if (!room) {
      socket.emit('quiz:error', { message: 'Quiz room not found.' });
      return;
    }
    if (room.started) {
      socket.emit('quiz:error', { message: 'The quiz has already started.' });
      return;
    }
    if (!cleanName) {
      socket.emit('quiz:error', { message: 'Player name is required.' });
      return;
    }
    if ([...room.players.values()].some((player) => player.name.toLowerCase() === cleanName.toLowerCase())) {
      socket.emit('quiz:error', { message: 'That player name is already in use.' });
      return;
    }

    const player = { socketId: socket.id, name: cleanName, score: 0 };
    room.players.set(socket.id, player);
    socket.join(room.roomId);
    socket.data.quizPin = normalizedPin;
    socket.data.role = 'player';
    socket.emit('quiz:joined', { pin: normalizedPin, roomId: room.roomId, player: { name: player.name, score: 0 } });
    io.to(room.roomId).emit('lobby:update', { players: getPlayers(room) });
  });
}

module.exports = { registerLobbyHandlers };
