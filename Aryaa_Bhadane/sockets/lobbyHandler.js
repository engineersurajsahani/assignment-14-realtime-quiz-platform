// sockets/lobbyHandler.js
const fs = require('fs');
const path = require('path');

// In-memory room store (keyed by 4-digit PIN)
const rooms = {};

// Load default question bank
function loadQuestions() {
  try {
    const questionsPath = path.join(__dirname, '../data/questions.json');
    const rawData = fs.readFileSync(questionsPath, 'utf-8');
    return JSON.parse(rawData);
  } catch (err) {
    console.error('Error loading questions:', err);
    return [];
  }
}

// Generate a random unique 4-digit PIN
function generateUniquePIN() {
  let pin;
  let attempts = 0;
  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
    attempts++;
  } while (rooms[pin] && attempts < 1000);
  return pin;
}

function registerLobbyHandlers(io, socket, gameEngine) {
  // Host initializes a quiz room
  socket.on('quiz:create', (payload = {}) => {
    const hostName = payload.hostName || 'Host';
    const category = payload.category || 'Tech & General';

    const pin = generateUniquePIN();
    const roomId = `quiz_${pin}`;

    const questions = loadQuestions();

    rooms[pin] = {
      pin,
      roomId,
      hostSocketId: socket.id,
      hostName,
      category,
      status: 'LOBBY', // 'LOBBY' | 'IN_PROGRESS' | 'QUESTION_REVIEW' | 'ENDED'
      players: {}, // socketId -> { id, name, score, answered, lastRoundScore, lastSelectedOption }
      currentQuestionIndex: -1,
      questions,
      timeLimitSeconds: 15,
      timer: null,
      reviewTimer: null,
      isQuestionOpen: false,
      questionStartTime: null
    };

    socket.join(roomId);
    socket.pin = pin;
    socket.isHost = true;

    console.log(`[LOBBY] Room created: PIN ${pin} by ${hostName} (${socket.id})`);

    // Sends PIN and roomId to the host
    socket.emit('quiz:created', {
      pin,
      roomId
    });
  });

  // Player enters lobby with PIN
  socket.on('quiz:join', (payload = {}) => {
    const pin = String(payload.pin || '').trim();
    const playerName = String(payload.playerName || '').trim();

    if (!pin || !playerName) {
      return socket.emit('quiz:error', { message: 'PIN and player name are required.' });
    }

    const room = rooms[pin];
    if (!room) {
      return socket.emit('quiz:error', { message: 'Quiz room not found. Check the PIN.' });
    }

    if (room.status !== 'LOBBY') {
      return socket.emit('quiz:error', { message: 'Quiz is already in progress or has ended.' });
    }

    // Check duplicate name in room (case-insensitive)
    const existingName = Object.values(room.players).some(
      (p) => p.name.toLowerCase() === playerName.toLowerCase()
    );
    if (existingName) {
      return socket.emit('quiz:error', { message: 'A player with this name already joined the room.' });
    }

    // Register player
    room.players[socket.id] = {
      id: socket.id,
      name: playerName,
      score: 0,
      answered: false,
      lastRoundScore: 0,
      lastSelectedOption: null
    };

    socket.join(room.roomId);
    socket.pin = pin;
    socket.isHost = false;
    socket.playerName = playerName;

    console.log(`[LOBBY] Player ${playerName} joined room ${pin}`);

    // Broadcast updated lobby roster to the room
    const playerRoster = Object.values(room.players).map((p) => ({
      name: p.name,
      score: p.score
    }));

    io.to(room.roomId).emit('lobby:update', {
      players: playerRoster
    });

    // Send confirmation to the joining player
    socket.emit('quiz:joined', {
      pin,
      playerName,
      category: room.category
    });
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    const pin = socket.pin;
    if (!pin || !rooms[pin]) return;

    const room = rooms[pin];

    if (socket.isHost) {
      console.log(`[LOBBY] Host disconnected from room ${pin}. Ending quiz.`);
      // Clear timers
      if (room.timer) clearTimeout(room.timer);
      if (room.reviewTimer) clearTimeout(room.reviewTimer);

      // Notify all players
      io.to(room.roomId).emit('quiz:host_disconnected', {
        message: 'The host has disconnected. The quiz session has ended.'
      });

      delete rooms[pin];
    } else if (room.players[socket.id]) {
      const removedPlayer = room.players[socket.id];
      console.log(`[LOBBY] Player ${removedPlayer.name} disconnected from room ${pin}`);
      delete room.players[socket.id];

      // Re-broadcast updated roster / leaderboard
      if (room.status === 'LOBBY') {
        const playerRoster = Object.values(room.players).map((p) => ({
          name: p.name,
          score: p.score
        }));
        io.to(room.roomId).emit('lobby:update', { players: playerRoster });
      } else {
        // If during game, recompute leaderboard
        gameEngine.broadcastLeaderboard(io, room);
      }
    }
  });
}

module.exports = {
  rooms,
  registerLobbyHandlers
};
