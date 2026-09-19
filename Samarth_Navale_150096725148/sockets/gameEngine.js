const path = require('path');
const questions = require('../data/questions.json');
const { quizRooms } = require('./lobbyHandler');

const QUESTION_TIME_SECONDS = 15;
const QUESTION_TIME_MS = QUESTION_TIME_SECONDS * 1000;

const calculateScore = (isCorrect, timeTakenMs, totalTimeLimitMs = 15000) => {
  if (!isCorrect) return 0;
  const timeRemaining = Math.max(0, totalTimeLimitMs - timeTakenMs);
  const speedBonus = Math.round((timeRemaining / totalTimeLimitMs) * 500);
  const baseScore = 500;
  return baseScore + speedBonus;
};

const getLeaderboard = (pin) => {
  const room = quizRooms[pin];
  if (!room) return [];

  const players = Object.values(room.players).map((p) => ({
    name: p.name,
    score: p.score
  }));

  players.sort((a, b) => b.score - a.score);

  return players.map((p, idx) => ({
    rank: idx + 1,
    name: p.name,
    score: p.score
  }));
};

const sendQuestion = (io, pin, qIndex) => {
  const room = quizRooms[pin];
  if (!room) return;

  if (qIndex >= questions.length) {
    room.status = 'ended';
    const finalRanks = getLeaderboard(pin);
    const winner = finalRanks.length > 0 ? finalRanks[0] : { name: 'None', score: 0 };
    return io.to(room.roomId).emit('quiz:ended', {
      winner,
      finalRanks
    });
  }

  room.currentQuestionIndex = qIndex;
  room.currentQuestionStartTime = Date.now();

  Object.values(room.players).forEach((p) => {
    p.answered = false;
  });

  const q = questions[qIndex];

  io.to(room.roomId).emit('question:start', {
    questionIndex: qIndex + 1,
    totalQuestions: questions.length,
    question: q.question,
    options: q.options,
    timeLimitSeconds: QUESTION_TIME_SECONDS
  });

  if (room.timer) clearTimeout(room.timer);

  room.timer = setTimeout(() => {
    handleTimeUp(io, pin, qIndex);
  }, QUESTION_TIME_MS);
};

const handleTimeUp = (io, pin, qIndex) => {
  const room = quizRooms[pin];
  if (!room) return;

  const q = questions[qIndex];

  io.to(room.roomId).emit('question:time_up', {
    correctOption: q.correctOption,
    explanation: q.explanation
  });

  const leaderboard = getLeaderboard(pin);
  io.to(room.roomId).emit('leaderboard:update', { leaderboard });

  room.timer = setTimeout(() => {
    sendQuestion(io, pin, qIndex + 1);
  }, 4000);
};

const setupGameEngine = (io, socket) => {
  socket.on('quiz:start', ({ pin }) => {
    const p = pin || socket.currentPin;
    if (!p || !quizRooms[p]) return;

    const room = quizRooms[p];
    if (room.hostId !== socket.id) return;

    room.status = 'in_progress';
    sendQuestion(io, p, 0);
  });

  socket.on('answer:submit', ({ pin, selectedOption, timeTakenMs }) => {
    const p = pin || socket.currentPin;
    if (!p || !quizRooms[p]) return;

    const room = quizRooms[p];
    if (room.status !== 'in_progress') return;

    const player = room.players[socket.id];
    if (!player || player.answered) return;

    const elapsed = Date.now() - room.currentQuestionStartTime;
    if (elapsed > QUESTION_TIME_MS + 500) {
      return socket.emit('answer:rejected', { message: 'Time up for this question' });
    }

    player.answered = true;

    const q = questions[room.currentQuestionIndex];
    if (!q) return;

    const isCorrect = Number(selectedOption) === q.correctOption;
    const timeUsed = Number(timeTakenMs) || elapsed;
    const scoreEarned = calculateScore(isCorrect, timeUsed, QUESTION_TIME_MS);

    player.score += scoreEarned;

    socket.emit('answer:result', {
      correct: isCorrect,
      scoreGained: scoreEarned,
      totalScore: player.score
    });
  });
};

module.exports = {
  setupGameEngine,
  calculateScore,
  getLeaderboard,
  sendQuestion,
  handleTimeUp
};
