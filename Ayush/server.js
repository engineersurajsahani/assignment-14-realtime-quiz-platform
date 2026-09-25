require("dotenv").config();

const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const { Server } = require("socket.io");

const registerLobbyHandlers = require("./sockets/lobbyHandler");
const GameEngine = require("./sockets/gameEngine");

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const gameEngine = new GameEngine(io);

io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);

  registerLobbyHandlers(io, socket, gameEngine);

  socket.on("quiz:start", ({ pin }) => gameEngine.startGame(pin));
  socket.on("answer:submit", (payload) => gameEngine.submitAnswer(socket, payload));

  socket.on("disconnect", () => {
    console.log(`[disconnect] ${socket.id}`);
    gameEngine.handleDisconnect(socket);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🧠 Quiz Battle server running at http://localhost:${PORT}`);
});
