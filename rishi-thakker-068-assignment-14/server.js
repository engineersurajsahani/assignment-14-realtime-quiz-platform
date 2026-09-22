const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const { Server } = require("socket.io");
const { registerLobbyHandlers } = require("./sockets/lobbyHandler");
const { registerGameHandlers } = require("./sockets/gameEngine");

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  registerLobbyHandlers(io, socket);
  registerGameHandlers(io, socket);
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
