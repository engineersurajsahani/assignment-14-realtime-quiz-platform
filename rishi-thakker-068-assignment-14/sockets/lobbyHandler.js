const rooms = new Map();

function generatePin() {
  let pin;
  do {
    pin = String(Math.floor(1000 + Math.random() * 9000)); // 4-digit
  } while (rooms.has(pin));
  return pin;
}

function lobbyRoster(room) {
  return Array.from(room.players.values()).map((p) => ({ name: p.name, score: p.score }));
}

const registerLobbyHandlers = (io, socket) => {
  socket.on("quiz:create", ({ hostName, category }) => {
    const pin = generatePin();
    const roomId = `quiz_${pin}`;

    rooms.set(pin, {
      pin,
      roomId,
      hostId: socket.id,
      hostName: hostName || "Host",
      category: category || "Tech",
      players: new Map(),
      status: "lobby",
      questions: [],
      currentQuestionIndex: -1,
      roundActive: false,
      answers: new Map(),
      timer: null,
    });

    socket.join(roomId);
    socket.data.pin = pin;
    socket.data.role = "host";

    socket.emit("quiz:created", { pin, roomId });
  });

  socket.on("quiz:join", ({ pin, playerName }) => {
    const room = rooms.get(pin);

    if (!room) {
      socket.emit("quiz:error", { message: "No quiz found with that PIN" });
      return;
    }
    if (room.status !== "lobby") {
      socket.emit("quiz:error", { message: "This quiz has already started" });
      return;
    }

    room.players.set(socket.id, { name: playerName || "Player", score: 0 });

    socket.join(room.roomId);
    socket.data.pin = pin;
    socket.data.role = "player";
    socket.data.playerName = playerName;

    io.to(room.roomId).emit("lobby:update", { players: lobbyRoster(room) });
  });

  socket.on("disconnect", () => {
    const { pin, role } = socket.data;
    if (!pin) return;

    const room = rooms.get(pin);
    if (!room) return;

    if (role === "player" && room.players.has(socket.id)) {
      room.players.delete(socket.id);
      if (room.status === "lobby") {
        io.to(room.roomId).emit("lobby:update", { players: lobbyRoster(room) });
      }
    }
  });
};

module.exports = { registerLobbyHandlers, rooms, lobbyRoster };
