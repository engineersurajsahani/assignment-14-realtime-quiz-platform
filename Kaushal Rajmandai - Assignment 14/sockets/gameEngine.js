const fs = require('fs');
const path = require('path');
const { games } = require('./lobbyHandler');

const questions = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/questions.json'), 'utf-8'));

const TIME_LIMIT_MS = 15000;

const calculateScore = (isCorrect, timeTakenMs) => {
  if (!isCorrect) return 0;
  const timeRemaining = Math.max(0, TIME_LIMIT_MS - timeTakenMs);
  const speedBonus = Math.round((timeRemaining / TIME_LIMIT_MS) * 500);
  return 500 + speedBonus;
};

const broadcastLeaderboard = (io, pin) => {
  const game = games[pin];
  if (!game) return;

  const leaderboard = Object.values(game.players)
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ rank: i + 1, name: p.name, score: p.score }));

  io.to(`quiz_${pin}`).emit('leaderboard:update', { leaderboard });
  return leaderboard;
};

const startQuestion = (io, pin) => {
  const game = games[pin];
  if (!game) return;

  game.currentQuestion += 1;
  const qIndex = game.currentQuestion;

  if (qIndex >= questions.length) {
    const leaderboard = broadcastLeaderboard(io, pin);
    const winner = leaderboard[0] || null;
    io.to(`quiz_${pin}`).emit('quiz:ended', { winner, finalRanks: leaderboard });
    delete games[pin];
    return;
  }

  const q = questions[qIndex];
  game.answers = {}; // socketId -> { selectedOption, timeTakenMs, submittedAt }
  game.questionStartedAt = Date.now();

  io.to(`quiz_${pin}`).emit('question:start', {
    questionIndex: qIndex + 1,
    totalQuestions: questions.length,
    question: q.question,
    options: q.options,
    timeLimitSeconds: TIME_LIMIT_MS / 1000
  });

  game.timer = setTimeout(() => {
    endQuestion(io, pin);
  }, TIME_LIMIT_MS);
};

const endQuestion = (io, pin) => {
  const game = games[pin];
  if (!game) return;

  const q = questions[game.currentQuestion];

  Object.entries(game.answers || {}).forEach(([socketId, ans]) => {
    const isCorrect = ans.selectedOption === q.correctOption;
    const score = calculateScore(isCorrect, ans.timeTakenMs);
    if (game.players[socketId]) {
      game.players[socketId].score += score;
    }
  });

  io.to(`quiz_${pin}`).emit('question:time_up', {
    correctOption: q.correctOption,
    explanation: q.explanation
  });

  broadcastLeaderboard(io, pin);

  setTimeout(() => startQuestion(io, pin), 3000);
};

const registerGameHandlers = (io, socket) => {
  socket.on('quiz:start', ({ pin }) => {
    const game = games[pin];
    if (!game || game.hostId !== socket.id) return;

    game.status = 'active';
    startQuestion(io, pin);
  });

  socket.on('answer:submit', ({ pin, selectedOption, timeTakenMs }) => {
    const game = games[pin];
    if (!game || game.status !== 'active') return;

    // Anti-cheat: reject answers submitted after the timer has expired
    const elapsed = Date.now() - game.questionStartedAt;
    if (elapsed > TIME_LIMIT_MS) return;

    if (!game.answers) game.answers = {};
    if (game.answers[socket.id]) return; // already answered this round

    game.answers[socket.id] = { selectedOption, timeTakenMs };
  });
};

module.exports = { registerGameHandlers };