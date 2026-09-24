// Socket handler for quiz lobby, PIN generation and player joining
const questions = require("../data/questions.json");

function generatePin(games) {
  let pin;
  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
  } while (games[pin]);
  return pin;
}

module.exports = function (io, socket, games) {

  // Host creates a new quiz room
  socket.on("quiz:create", (data) => {
    const { hostName, category } = data || {};
    const pin = generatePin(games);
    const roomId = `quiz_${pin}`;

    games[pin] = {
      pin,
      roomId,
      hostSocketId: socket.id,
      hostName: hostName || "Quiz Host",
      category: category || "Tech Trivia",
      status: "lobby", // "lobby" | "question" | "review" | "ended"
      currentQuestionIndex: 0,
      players: {}, // socketId -> { socketId, name, score, answered }
      questions: questions,
      timer: null,
      questionStartTime: null
    };

    socket.join(roomId);
    socket.isHost = true;
    socket.pin = pin;

    socket.emit("quiz:created", {
      pin,
      roomId,
      category: games[pin].category,
      totalQuestions: games[pin].questions.length
    });
  });

  // Player joins quiz lobby via 4-digit PIN
  socket.on("quiz:join", (data) => {
    const { pin, playerName } = data || {};
    const cleanPin = pin ? pin.toString().trim() : "";
    const cleanName = playerName ? playerName.trim() : "";

    if (!cleanPin || !cleanName) {
      return socket.emit("quiz:error", { message: "PIN and Player Name are required" });
    }

    const game = games[cleanPin];

    if (!game) {
      return socket.emit("quiz:error", { message: "Invalid Quiz PIN. Room not found." });
    }

    if (game.status !== "lobby") {
      return socket.emit("quiz:error", { message: "Game has already started." });
    }

    // Add player to game
    game.players[socket.id] = {
      socketId: socket.id,
      name: cleanName,
      score: 0,
      answered: false
    };

    socket.join(game.roomId);
    socket.pin = cleanPin;
    socket.playerName = cleanName;
    socket.isHost = false;

    socket.emit("quiz:joined", {
      success: true,
      pin: cleanPin,
      playerName: cleanName
    });

    // Broadcast updated player roster to all participants in the lobby
    const playerList = Object.values(game.players).map((p) => ({
      name: p.name,
      score: p.score
    }));

    io.to(game.roomId).emit("lobby:update", {
      players: playerList
    });
  });

  // Handle player/host disconnection
  socket.on("disconnect", () => {
    const pin = socket.pin;
    if (pin && games[pin]) {
      const game = games[pin];

      if (socket.isHost) {
        // Host left - end the room
        io.to(game.roomId).emit("quiz:error", {
          message: "The Host disconnected. Quiz terminated."
        });
        delete games[pin];
      } else if (game.players[socket.id]) {
        // Player left - remove and update roster
        delete game.players[socket.id];
        const playerList = Object.values(game.players).map((p) => ({
          name: p.name,
          score: p.score
        }));
        io.to(game.roomId).emit("lobby:update", { players: playerList });
      }
    }
  });
};
