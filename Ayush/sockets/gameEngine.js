

const fs = require("fs");
const path = require("path");

const QUESTION_TIME_MS = 15000;
const INTERMISSION_MS = 4000;

class GameEngine {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this.questionBank = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "data", "questions.json"), "utf-8")
    );
  }

  createRoom({ pin, roomId, hostId, hostName, category }) {
    this.rooms.set(pin, {
      pin,
      roomId,
      hostId,
      hostName,
      category: category || "General",
      players: new Map(),
      questions: this.pickQuestions(category),
      currentQuestionIndex: -1,
      started: false,
      timer: null,
      nextTimer: null,
      questionStartTime: null,
      answersThisRound: new Map(),
    });
  }

  pickQuestions(category) {
    const pool = category
      ? this.questionBank.filter(
          (q) => q.category?.toLowerCase() === String(category).toLowerCase()
        )
      : this.questionBank;
    const source = pool.length ? pool : this.questionBank;
    return this.shuffle([...source]).slice(0, 5);
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  startGame(pin) {
    const room = this.rooms.get(pin);
    if (!room || room.started || room.players.size === 0) return;
    room.started = true;
    this.nextQuestion(room);
  }

  nextQuestion(room) {
    room.currentQuestionIndex += 1;
    room.answersThisRound = new Map();

    if (room.currentQuestionIndex >= room.questions.length) {
      this.endGame(room);
      return;
    }

    const q = room.questions[room.currentQuestionIndex];
    room.questionStartTime = Date.now();

    this.io.to(room.roomId).emit("question:start", {
      questionIndex: room.currentQuestionIndex + 1,
      totalQuestions: room.questions.length,
      question: q.question,
      options: q.options,
      timeLimitSeconds: QUESTION_TIME_MS / 1000,
    });

    clearTimeout(room.timer);
    room.timer = setTimeout(() => this.revealAnswer(room), QUESTION_TIME_MS);
  }

  submitAnswer(socket, { pin, selectedOption, timeTakenMs }) {
    const room = this.rooms.get(pin);
    if (!room || !room.started) return;
    if (room.currentQuestionIndex < 0 || room.currentQuestionIndex >= room.questions.length) return;
    if (room.answersThisRound.has(socket.id)) return;

    const elapsed = Date.now() - room.questionStartTime;
    if (elapsed > QUESTION_TIME_MS) return;

    const q = room.questions[room.currentQuestionIndex];
    const isCorrect = selectedOption === q.correctOption;
    const timeSpent = typeof timeTakenMs === "number" ? timeTakenMs : elapsed;
    const points = this.calculateScore(isCorrect, timeSpent, QUESTION_TIME_MS);

    room.answersThisRound.set(socket.id, { selectedOption, points, isCorrect });

    const player = room.players.get(socket.id);
    if (player) {
      player.score += points;
      socket.emit("answer:result", { isCorrect, points, totalScore: player.score });
    }
  }


  calculateScore(isCorrect, timeTakenMs, totalTimeLimitMs = QUESTION_TIME_MS) {
    if (!isCorrect) return 0;
    const timeRemaining = Math.max(0, totalTimeLimitMs - timeTakenMs);
    const speedBonus = Math.round((timeRemaining / totalTimeLimitMs) * 500);
    const baseScore = 500;
    return baseScore + speedBonus;
  }

  revealAnswer(room) {
    const q = room.questions[room.currentQuestionIndex];

    this.io.to(room.roomId).emit("question:time_up", {
      correctOption: q.correctOption,
      explanation: q.explanation || "",
    });

    const leaderboard = Array.from(room.players.values())
      .sort((a, b) => b.score - a.score)
      .map((p, idx) => ({ rank: idx + 1, name: p.name, score: p.score }));

    this.io.to(room.roomId).emit("leaderboard:update", { leaderboard });

    clearTimeout(room.nextTimer);
    room.nextTimer = setTimeout(() => this.nextQuestion(room), INTERMISSION_MS);
  }

  endGame(room) {
    const finalRanks = Array.from(room.players.values())
      .sort((a, b) => b.score - a.score)
      .map((p, idx) => ({ rank: idx + 1, name: p.name, score: p.score }));

    this.io.to(room.roomId).emit("quiz:ended", {
      winner: finalRanks[0] || null,
      finalRanks,
    });

    clearTimeout(room.timer);
    clearTimeout(room.nextTimer);
    this.rooms.delete(room.pin);
  }

  handleDisconnect(socket) {
    const pin = socket.data.pin;
    if (!pin) return;
    const room = this.rooms.get(pin);
    if (!room) return;

    if (socket.data.role === "player") {
      room.players.delete(socket.id);
      this.io.to(room.roomId).emit("lobby:update", {
        players: Array.from(room.players.values()).map((p) => ({
          name: p.name,
          score: p.score,
        })),
      });
    } else if (socket.data.role === "host") {

      this.io.to(room.roomId).emit("quiz:host_left", {
        message: "The host has disconnected. Quiz ended.",
      });
      clearTimeout(room.timer);
      clearTimeout(room.nextTimer);
      this.rooms.delete(pin);
    }
  }
}

module.exports = GameEngine;
