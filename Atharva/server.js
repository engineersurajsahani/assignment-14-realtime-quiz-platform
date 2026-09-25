require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const { Server } = require("socket.io");

const lobbyHandler = require("./sockets/lobbyHandler");
const gameEngine = require("./sockets/gameEngine");

const app = express();
const server = http.createServer(app);

const corsOrigin = process.env.CORS_ORIGIN || "*";

app.use(cors({ origin: corsOrigin }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"]
  }
});

const rooms = {};

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "real-time-quiz",
    rooms: Object.keys(rooms).length
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  lobbyHandler(io, socket, rooms);
  gameEngine(io, socket, rooms);

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5001;

server.listen(PORT, () => {
  console.log(`Quiz server running on port ${PORT}`);
});
