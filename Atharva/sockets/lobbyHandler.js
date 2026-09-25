function generatePin(rooms) {
  let pin;

  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
  } while (rooms[pin]);

  return pin;
}

function publicPlayers(room) {
  return room.players.map((player) => ({
    name: player.name,
    score: player.score
  }));
}

module.exports = function lobbyHandler(io, socket, rooms) {
  socket.on("quiz:create", (payload = {}) => {
    const hostName = String(payload.hostName || "").trim();
    const category = String(payload.category || "Technology").trim();

    if (!hostName) {
      socket.emit("quiz:error", { message: "Host name is required." });
      return;
    }

    const pin = generatePin(rooms);

    rooms[pin] = {
      pin,
      roomId: `quiz_${pin}`,
      hostId: socket.id,
      hostName,
      category: category || "Technology",
      players: [],
      currentQuestion: 0,
      gameStarted: false,
      questionActive: false,
      timer: null,
      questionStartedAt: null
    };

    socket.join(pin);

    socket.emit("quiz:created", {
      pin,
      roomId: rooms[pin].roomId
    });

    io.to(pin).emit("lobby:update", {
      players: []
    });

    console.log(`Quiz created: ${pin} by ${hostName}`);
  });

  socket.on("quiz:join", (payload = {}) => {
    const pin = String(payload.pin || "").trim();
    const playerName = String(payload.playerName || "").trim();

    if (!pin || !playerName) {
      socket.emit("quiz:error", {
        message: "PIN and player name are required."
      });
      return;
    }

    const room = rooms[pin];

    if (!room) {
      socket.emit("quiz:error", {
        message: "Quiz room not found."
      });
      return;
    }

    if (room.gameStarted) {
      socket.emit("quiz:error", {
        message: "Game has already started."
      });
      return;
    }

    if (room.hostId === socket.id) {
      socket.emit("quiz:error", {
        message: "The host cannot join as a player."
      });
      return;
    }

    const duplicate = room.players.some(
      (player) =>
        player.name.toLowerCase() === playerName.toLowerCase()
    );

    if (duplicate) {
      socket.emit("quiz:error", {
        message: "Player name already exists."
      });
      return;
    }

    room.players.push({
      id: socket.id,
      name: playerName,
      score: 0,
      answered: false
    });

    socket.join(pin);

    socket.emit("quiz:joined", {
      pin,
      playerName
    });

    io.to(pin).emit("lobby:update", {
      players: publicPlayers(room)
    });

    console.log(`${playerName} joined quiz ${pin}`);
  });

  socket.on("disconnect", () => {
    for (const pin of Object.keys(rooms)) {
      const room = rooms[pin];

      if (room.hostId === socket.id) {
        if (room.timer) clearTimeout(room.timer);
        delete rooms[pin];
        console.log(`Host left. Quiz ${pin} removed.`);
        continue;
      }

      const index = room.players.findIndex(
        (player) => player.id === socket.id
      );

      if (index !== -1) {
        const removed = room.players.splice(index, 1)[0];

        io.to(pin).emit("lobby:update", {
          players: publicPlayers(room)
        });

        console.log(`${removed.name} left quiz ${pin}`);
      }
    }
  });
};
