const questions = require('../data/questions.json');
const { games } = require('./lobbyHandler');

function calculateScore(isCorrect, timeTakenMs, totalTimeLimitMs = 15000) {
  if (!isCorrect) return 0;
  const timeRemaining = Math.max(0, totalTimeLimitMs - timeTakenMs);
  const speedBonus = Math.round((timeRemaining / totalTimeLimitMs) * 500);
  const baseScore = 500;
  return baseScore + speedBonus;
}

function registerGameEngineHandlers(io, socket) {
  socket.on('quiz:start', (data) => {
    const pin = data?.pin;
    const game = games.get(pin);

    if (!game || game.hostSocketId !== socket.id) {
      return socket.emit('error:message', { message: 'Unauthorized host action' });
    }

    if (game.players.size === 0) {
      return socket.emit('error:message', { message: 'Cannot start without players' });
    }

    game.state = 'IN_PROGRESS';
    game.currentQuestionIndex = 0;
    startQuestionRound(io, game);
  });

  socket.on('answer:submit', (data) => {
    const { pin, selectedOption, timeTakenMs } = data;
    const game = games.get(pin);

    if (!game || game.state !== 'IN_PROGRESS') return;

    const player = game.players.get(socket.id);
    if (!player || player.answeredInCurrentRound) return;

    const currentQ = questions[game.currentQuestionIndex];
    const totalTimeLimitMs = (currentQ.timeLimitSeconds || 15) * 1000;

    const actualTimeTaken = Date.now() - game.questionStartTime;

    if (actualTimeTaken > totalTimeLimitMs + 1000) {
      return socket.emit('answer:result', {
        isCorrect: false,
        scoreEarned: 0,
        message: 'Time expired!'
      });
    }

    player.answeredInCurrentRound = true;
    const isCorrect = selectedOption === currentQ.correctOption;
    const earnedScore = calculateScore(isCorrect, actualTimeTaken, totalTimeLimitMs);

    player.score += earnedScore;

    socket.emit('answer:result', {
      isCorrect,
      scoreEarned: earnedScore,
      totalScore: player.score
    });
  });
}

function startQuestionRound(io, game) {
  const currentQ = questions[game.currentQuestionIndex];
  if (!currentQ) {
    return endQuiz(io, game);
  }

  game.players.forEach(p => p.answeredInCurrentRound = false);
  game.questionStartTime = Date.now();

  const payload = {
    questionIndex: game.currentQuestionIndex + 1,
    totalQuestions: questions.length,
    question: currentQ.question,
    options: currentQ.options,
    timeLimitSeconds: currentQ.timeLimitSeconds || 15
  };

  io.to(game.roomId).emit('question:start', payload);

  const durationMs = (currentQ.timeLimitSeconds || 15) * 1000;
  game.roundTimer = setTimeout(() => {
    endQuestionRound(io, game);
  }, durationMs);
}

function endQuestionRound(io, game) {
  clearTimeout(game.roundTimer);
  const currentQ = questions[game.currentQuestionIndex];

  io.to(game.roomId).emit('question:time_up', {
    correctOption: currentQ.correctOption,
    explanation: currentQ.explanation
  });

  const leaderboard = Array.from(game.players.values())
    .map(p => ({ name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score)
    .map((p, idx) => ({ rank: idx + 1, ...p }));

  io.to(game.roomId).emit('leaderboard:update', { leaderboard });

  setTimeout(() => {
    game.currentQuestionIndex++;
    if (game.currentQuestionIndex < questions.length) {
      startQuestionRound(io, game);
    } else {
      endQuiz(io, game);
    }
  }, 5000);
}

function endQuiz(io, game) {
  game.state = 'ENDED';

  const finalRanks = Array.from(game.players.values())
    .map(p => ({ name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score)
    .map((p, idx) => ({ rank: idx + 1, ...p }));

  const winner = finalRanks[0] || { name: 'None', score: 0 };

  io.to(game.roomId).emit('quiz:ended', {
    winner,
    finalRanks
  });
}

module.exports = registerGameEngineHandlers;