

function generatePin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

module.exports = function registerLobbyHandlers(io, socket, gameEngine) {

  socket.on("quiz:create", ({ hostName, category }) => {
    let pin = generatePin();
    while (gameEngine.rooms.has(pin)) {
      pin = generatePin();
    }

    const roomId = `quiz_${pin}`;
    gameEngine.createRoom({
      pin,
      roomId,
      hostId: socket.id,
      hostName: hostName || "Host",
      category,
    });

    socket.join(roomId);
    socket.data.role = "host";
    socket.data.pin = pin;

    socket.emit("quiz:created", { pin, roomId });
  });


  socket.on("quiz:join", ({ pin, playerName }) => {
    const room = gameEngine.rooms.get(pin);

    if (!room) {
      socket.emit("error:join", { message: "Invalid PIN. Room not found." });
      return;
    }
    if (room.started) {
      socket.emit("error:join", { message: "This quiz has already started." });
      return;
    }
    if (!playerName || !playerName.trim()) {
      socket.emit("error:join", { message: "Player name is required." });
      return;
    }

    const player = { id: socket.id, name: playerName.trim(), score: 0 };
    room.players.set(socket.id, player);

    socket.join(room.roomId);
    socket.data.role = "player";
    socket.data.pin = pin;

    socket.emit("quiz:joined", { pin, roomId: room.roomId, hostName: room.hostName });

    io.to(room.roomId).emit("lobby:update", {
      players: Array.from(room.players.values()).map((p) => ({
        name: p.name,
        score: p.score,
      })),
    });
  });
};
