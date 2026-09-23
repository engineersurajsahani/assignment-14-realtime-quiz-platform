/**
 * lobbyHandler.js - Room creation, 4-digit PIN generation, player joining & disconnect handling.
 */

const questionsData = require('../data/questions.json');

/**
 * Generates a unique 4-digit numeric PIN code.
 * Retries if a collision occurs with an active room.
 * @param {Map} rooms 
 * @returns {string} 4-digit PIN
 */
function generateUniquePin(rooms) {
  let pin;
  let attempts = 0;
  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
    attempts++;
    if (attempts > 10000) {
      throw new Error("Unable to generate unique room PIN: Max attempts reached.");
    }
  } while (rooms.has(pin));
  return pin;
}

/**
 * Initializes a new quiz room for a Host.
 * @param {Map} rooms - Master in-memory store
 * @param {Socket} socket - Host socket
 * @param {Object} data - { hostName, category }
 */
function createRoom(rooms, socket, data) {
  const pin = generateUniquePin(rooms);
  const roomId = `quiz_${pin}`;

  // Filter questions by category if specified and matches, else use all questions
  let selectedQuestions = [...questionsData];
  if (data && data.category && data.category !== "All Categories") {
    const filtered = questionsData.filter(q => q.category.toLowerCase() === data.category.toLowerCase());
    if (filtered.length > 0) {
      selectedQuestions = filtered;
    }
  }

  const roomState = {
    pin,
    roomId,
    hostSocketId: socket.id,
    hostName: (data && data.hostName && data.hostName.trim()) || "Host",
    category: (data && data.category) || "General Tech",
    status: "lobby", // "lobby" | "in_progress" | "ended"
    players: [],
    questions: selectedQuestions,
    currentQuestionIndex: -1,
    timeLimitSeconds: 15,
    questionTimer: null,
    nextRoundTimeout: null,
    questionStartTimestamp: null
  };

  rooms.set(pin, roomState);
  socket.join(roomId);

  // Store room PIN on host socket for quick reference
  socket.quizPin = pin;
  socket.isHost = true;

  console.log(`[LOBBY] Room created: PIN ${pin} by Host "${roomState.hostName}" (${socket.id})`);

  socket.emit("quiz:created", {
    pin,
    roomId,
    category: roomState.category,
    totalQuestions: roomState.questions.length
  });
}

/**
 * Handles a player attempting to join an existing room lobby using a PIN.
 * @param {Map} rooms 
 * @param {Socket} socket - Player socket
 * @param {Object} data - { pin, playerName }
 * @param {Server} io - Socket.io server instance
 */
function joinRoom(rooms, socket, data, io) {
  if (!data || !data.pin || !data.playerName) {
    return socket.emit("error:join", { message: "PIN and Player Name are required." });
  }

  const pin = data.pin.toString().trim();
  const playerName = data.playerName.trim();

  if (!rooms.has(pin)) {
    return socket.emit("error:join", { message: `Room PIN "${pin}" not found.` });
  }

  const room = rooms.get(pin);

  if (room.status !== "lobby") {
    return socket.emit("error:join", { message: "Quiz has already started or ended." });
  }

  // Check for duplicate player names in the same room
  const nameExists = room.players.some(p => p.name.toLowerCase() === playerName.toLowerCase());
  if (nameExists) {
    return socket.emit("error:join", { message: `Name "${playerName}" is already taken in this room.` });
  }

  const newPlayer = {
    socketId: socket.id,
    name: playerName,
    score: 0,
    answered: false,
    lastAnswerCorrect: null,
    lastPointsGained: 0
  };

  room.players.push(newPlayer);
  socket.join(room.roomId);

  socket.quizPin = pin;
  socket.playerName = playerName;
  socket.isHost = false;

  console.log(`[LOBBY] Player "${playerName}" (${socket.id}) joined room PIN ${pin}`);

  // Confirm join to player
  socket.emit("quiz:joined", {
    pin,
    playerName,
    hostName: room.hostName,
    category: room.category
  });

  // Broadcast updated lobby roster to entire room
  const rosterPayload = {
    players: room.players.map(p => ({ name: p.name, score: p.score }))
  };
  io.to(room.roomId).emit("lobby:update", rosterPayload);
}

/**
 * Gracefully handles host or player socket disconnections.
 * @param {Map} rooms 
 * @param {Socket} socket 
 * @param {Server} io 
 */
function handleDisconnect(rooms, socket, io) {
  const pin = socket.quizPin;
  if (!pin || !rooms.has(pin)) return;

  const room = rooms.get(pin);

  if (socket.isHost || socket.id === room.hostSocketId) {
    console.log(`[LOBBY] Host disconnected from room PIN ${pin}`);
    io.to(room.roomId).emit("host:disconnected", {
      message: "The Quiz Host has left. The game session has ended."
    });
    // Clear any timers
    if (room.questionTimer) clearTimeout(room.questionTimer);
    if (room.nextRoundTimeout) clearTimeout(room.nextRoundTimeout);
    rooms.delete(pin);
  } else {
    // Player disconnected
    const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
    if (playerIndex !== -1) {
      const removedPlayer = room.players.splice(playerIndex, 1)[0];
      console.log(`[LOBBY] Player "${removedPlayer.name}" left room PIN ${pin}`);

      if (room.status === "lobby") {
        io.to(room.roomId).emit("lobby:update", {
          players: room.players.map(p => ({ name: p.name, score: p.score }))
        });
      }
    }
  }
}

module.exports = {
  createRoom,
  joinRoom,
  handleDisconnect,
  generateUniquePin
};
