require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

const lobbyHandler = require("./sockets/lobbyHandler");
const gameEngine = require("./sockets/gameEngine");

const app = express();
const server = http.createServer(app);

// Socket.io initialization
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// In-Memory Games Dictionary: PIN -> GameState
const games = {};

// Socket connection
io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Register Handlers
  lobbyHandler(io, socket, games);
  gameEngine(io, socket, games);
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    activeGames: Object.keys(games).length,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Quiz Battle Server running on http://localhost:${PORT}`);
});
