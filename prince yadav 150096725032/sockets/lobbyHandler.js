/**
 * Sockets: Lobby Handler
 * Manages Room creation, 4-digit PIN generation, player joins, and lobby updates.
 */

// In-memory store for active quiz rooms
// pin -> room object
const rooms = new Map();

/**
 * Generates a unique 4-digit numeric PIN not currently in use
 */
function generateRoomPin() {
  let pin;
  let attempts = 0;
  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
    attempts++;
    if (attempts > 1000) break;
  } while (rooms.has(pin));
  return pin;
}

/**
 * Returns formatted player roster for lobby:update
 */
function getPlayerRoster(room) {
  const list = [];
  for (const [, player] of room.players.entries()) {
    list.push({
      name: player.name,
      score: player.score,
      streak: player.streak || 0
    });
  }
  return list;
}

/**
 * Initializes lobby event handlers for a connected socket
 */
function registerLobbyHandlers(io, socket, questionsBank) {
  /**
   * Host creates a new quiz room
   * Payload: { hostName: "Professor X", category: "Tech" }
   */
  socket.on('quiz:create', (data = {}) => {
    try {
      const hostName = (data.hostName || 'Quiz Master').trim();
      const category = (data.category || 'All').trim();
      const pin = generateRoomPin();
      const roomId = `quiz_${pin}`;

      // Filter questions if category specified, else shuffle all
      let filteredQuestions = [...questionsBank];
      if (category && category !== 'All') {
        const matches = questionsBank.filter(
          (q) => q.category.toLowerCase() === category.toLowerCase()
        );
        if (matches.length > 0) filteredQuestions = matches;
      }

      // Shuffle questions
      filteredQuestions.sort(() => Math.random() - 0.5);

      const room = {
        pin,
        roomId,
        hostSocketId: socket.id,
        hostName,
        category,
        state: 'LOBBY', // 'LOBBY' | 'QUESTION' | 'TIME_UP' | 'LEADERBOARD' | 'ENDED'
        players: new Map(), // socketId -> player object
        questions: filteredQuestions,
        currentQuestionIndex: -1,
        roundStartTime: 0,
        roundTimer: null,
        roundCountdownInterval: null,
        timeLimitSeconds: 15,
        submissions: new Map(), // socketId -> submission
        createdAt: Date.now()
      };

      rooms.set(pin, room);

      // Join socket room
      socket.join(roomId);
      socket.data = { isHost: true, pin, role: 'host' };

      console.log(`[LOBBY] Room created: PIN ${pin} by Host '${hostName}'`);

      // Server -> Host
      socket.emit('quiz:created', { pin, roomId });
    } catch (err) {
      console.error('[LOBBY] Error in quiz:create:', err);
      socket.emit('error:message', { message: 'Failed to create quiz room.' });
    }
  });

  /**
   * Player joins an existing quiz room with PIN
   * Payload: { pin: "8421", playerName: "Karan" }
   */
  socket.on('quiz:join', (data = {}) => {
    try {
      const pin = String(data.pin || '').trim();
      const playerName = String(data.playerName || '').trim();

      if (!pin) {
        return socket.emit('error:message', { message: 'Please enter a 4-digit room PIN.' });
      }

      if (!playerName) {
        return socket.emit('error:message', { message: 'Please enter a valid player nickname.' });
      }

      const room = rooms.get(pin);
      if (!room) {
        return socket.emit('error:message', { message: `Quiz room with PIN ${pin} not found.` });
      }

      if (room.state !== 'LOBBY') {
        return socket.emit('error:message', {
          message: 'Quiz has already started. Cannot join this room.'
        });
      }

      // Check for duplicate player names in the room
      for (const [, player] of room.players.entries()) {
        if (player.name.toLowerCase() === playerName.toLowerCase()) {
          return socket.emit('error:message', {
            message: `Nickname '${playerName}' is already taken in this room. Choose another!`
          });
        }
      }

      // Register player
      const playerObj = {
        socketId: socket.id,
        name: playerName,
        score: 0,
        streak: 0,
        hasAnswered: false,
        joinedAt: Date.now()
      };

      room.players.set(socket.id, playerObj);
      socket.join(room.roomId);
      socket.data = { isHost: false, pin, playerName, role: 'player' };

      console.log(`[LOBBY] Player '${playerName}' joined room PIN ${pin}`);

      // Confirm to player
      socket.emit('quiz:joined', {
        pin,
        playerName,
        roomId: room.roomId,
        hostName: room.hostName,
        category: room.category
      });

      // Broadcast updated roster to entire room
      io.to(room.roomId).emit('lobby:update', {
        players: getPlayerRoster(room)
      });
    } catch (err) {
      console.error('[LOBBY] Error in quiz:join:', err);
      socket.emit('error:message', { message: 'Failed to join quiz room.' });
    }
  });

  /**
   * Handle player or host disconnection
   */
  socket.on('disconnect', () => {
    try {
      const { pin, role, playerName } = socket.data || {};
      if (!pin) return;

      const room = rooms.get(pin);
      if (!room) return;

      if (role === 'host') {
        console.log(`[LOBBY] Host disconnected from room PIN ${pin}. Closing room.`);
        io.to(room.roomId).emit('quiz:host_left', {
          message: 'Host has ended the session or disconnected.'
        });
        if (room.roundTimer) clearTimeout(room.roundTimer);
        if (room.transitionTimer) clearTimeout(room.transitionTimer);
        if (room.roundCountdownInterval) clearInterval(room.roundCountdownInterval);
        rooms.delete(pin);
      } else if (role === 'player') {
        console.log(`[LOBBY] Player '${playerName}' left room PIN ${pin}.`);
        room.players.delete(socket.id);
        room.submissions.delete(socket.id);

        if (room.state === 'LOBBY') {
          io.to(room.roomId).emit('lobby:update', {
            players: getPlayerRoster(room)
          });
        }
      }
    } catch (err) {
      console.error('[LOBBY] Error handling disconnect:', err);
    }
  });
}

module.exports = {
  rooms,
  generateRoomPin,
  getPlayerRoster,
  registerLobbyHandlers
};
