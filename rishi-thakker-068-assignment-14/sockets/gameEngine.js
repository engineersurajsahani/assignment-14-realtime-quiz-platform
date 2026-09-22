const { rooms, lobbyRoster } = require("./lobbyHandler");
const questionBank = require("../data/questions.json");

const TIME_LIMIT_SECONDS = 10;
const NEXT_QUESTION_DELAY_MS = 5000;

function calculateScore(isCorrect, timeTakenMs, totalTimeLimitMs = TIME_LIMIT_SECONDS * 1000) {
  if (!isCorrect) return 0;

  const timeRemaining = Math.max(0, totalTimeLimitMs - timeTakenMs);
  const speedBonus = Math.round((timeRemaining / totalTimeLimitMs) * 500);
  const baseScore = 500;

  return baseScore + speedBonus;
}

function buildLeaderboard(room) {
  return Array.from(room.players.values())
    .sort((a, b) => b.score - a.score)
    .map((p, index) => ({ rank: index + 1, name: p.name, score: p.score }));
}

function pickQuestions(category) {
  const matching = questionBank.filter(
    (q) => q.category.toLowerCase() === (category || "").toLowerCase()
  );
  return matching.length > 0 ? matching : questionBank;
}

const registerGameHandlers = (io, socket) => {
  socket.on("quiz:start", ({ pin }) => {
    const room = rooms.get(pin);
    if (!room || room.hostId !== socket.id) return;

    room.status = "in_progress";
    room.questions = pickQuestions(room.category);
    room.currentQuestionIndex = -1;

    startNextQuestion(io, room);
  });

  socket.on("answer:submit", ({ pin, selectedOption, timeTakenMs }) => {
    const room = rooms.get(pin);
    if (!room || room.status !== "in_progress") return;
    if (!room.roundActive) return;
    if (room.answers.has(socket.id)) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const question = room.questions[room.currentQuestionIndex];
    const isCorrect = selectedOption === question.correctOption;
    const score = calculateScore(isCorrect, timeTakenMs, TIME_LIMIT_SECONDS * 1000);

    room.answers.set(socket.id, { selectedOption, timeTakenMs, isCorrect, score });
    player.score += score;
  });
};

function startNextQuestion(io, room) {
  room.currentQuestionIndex += 1;

  if (room.currentQuestionIndex >= room.questions.length) {
    endQuiz(io, room);
    return;
  }

  const question = room.questions[room.currentQuestionIndex];
  room.roundActive = true;
  room.answers = new Map();

  io.to(room.roomId).emit("question:start", {
    questionIndex: room.currentQuestionIndex + 1,
    totalQuestions: room.questions.length,
    question: question.question,
    options: question.options,
    timeLimitSeconds: TIME_LIMIT_SECONDS,
  });

  clearTimeout(room.timer);
  room.timer = setTimeout(() => endRound(io, room), TIME_LIMIT_SECONDS * 1000);
}

function endRound(io, room) {
  if (!room.roundActive) return;
  room.roundActive = false;

  const question = room.questions[room.currentQuestionIndex];

  io.to(room.roomId).emit("question:time_up", {
    correctOption: question.correctOption,
    explanation: question.explanation,
  });

  io.to(room.roomId).emit("leaderboard:update", { leaderboard: buildLeaderboard(room) });

  setTimeout(() => startNextQuestion(io, room), NEXT_QUESTION_DELAY_MS);
}

function endQuiz(io, room) {
  room.status = "ended";
  const finalRanks = buildLeaderboard(room);

  io.to(room.roomId).emit("quiz:ended", {
    winner: finalRanks[0] || null,
    finalRanks,
  });

  rooms.delete(room.pin);
}

module.exports = { registerGameHandlers, calculateScore };
