const defaultQuestions = require('../data/questions.json');

// In-Memory Games State Store
// Structure:
// {
//   [pin]: {
//     pin: string,
//     hostSocketId: string,
//     hostName: string,
//     category: string,
//     status: 'lobby' | 'in_progress' | 'round_break' | 'ended',
//     players: { [socketId]: { socketId, name, score: 0, answered: false, answerTime: 0, lastPoints: 0 } },
//     currentQuestionIndex: 0,
//     questions: Array,
//     timerInterval: null,
//     timeRemaining: 15,
//     questionStartTime: 0
//   }
// }
const games = {};

function calculateScore(isCorrect, timeTakenMs, totalTimeLimitMs = 15000) {
  if (!isCorrect) return 0;
  const timeRemaining = Math.max(0, totalTimeLimitMs - timeTakenMs);
  const speedBonus = Math.round((timeRemaining / totalTimeLimitMs) * 500); // Up to 500 bonus points
  const baseScore = 500;
  return baseScore + speedBonus; // Total max 1000 points per question
}

function getLeaderboard(game) {
  const playerList = Object.values(game.players);
  playerList.sort((a, b) => b.score - a.score);
  return playerList.map((p, idx) => ({
    rank: idx + 1,
    name: p.name,
    score: p.score,
    lastPoints: p.lastPoints || 0
  }));
}

function startQuestion(io, pin) {
  const game = games[pin];
  if (!game) return;

  const currentQ = game.questions[game.currentQuestionIndex];
  if (!currentQ) {
    return endQuiz(io, pin);
  }

  game.status = 'in_progress';
  game.timeRemaining = 15;
  game.questionStartTime = Date.now();

  // Reset answer states for all players
  for (const socketId in game.players) {
    game.players[socketId].answered = false;
    game.players[socketId].answerTime = 0;
    game.players[socketId].lastPoints = 0;
  }

  // 1. Broadcast question payload (NEVER send correctOption to clients to prevent inspect-element cheating!)
  io.to(pin).emit('question:start', {
    questionIndex: game.currentQuestionIndex + 1,
    totalQuestions: game.questions.length,
    category: currentQ.category || game.category,
    question: currentQ.question,
    options: currentQ.options,
    timeLimitSeconds: game.timeRemaining
  });

  // 2. Clear any existing timer and start synchronized 1s interval
  clearInterval(game.timerInterval);
  game.timerInterval = setInterval(() => {
    game.timeRemaining -= 1;

    io.to(pin).emit('timer:tick', {
      timeRemaining: game.timeRemaining
    });

    if (game.timeRemaining <= 0) {
      clearInterval(game.timerInterval);
      endQuestion(io, pin);
    }
  }, 1000);
}

function handleAnswerSubmission(io, socket, { pin, selectedOption, timeTakenMs }) {
  const game = games[pin];
  if (!game || game.status !== 'in_progress') {
    return socket.emit('answer:rejected', { reason: 'No active question round' });
  }

  const player = game.players[socket.id];
  if (!player) {
    return socket.emit('answer:rejected', { reason: 'Player not in this game' });
  }

  if (player.answered) {
    return socket.emit('answer:rejected', { reason: 'Answer already submitted' });
  }

  // Anti-cheat verification: Check if submission arrived after timer expiry
  const actualTimeTaken = timeTakenMs || (Date.now() - game.questionStartTime);
  if (actualTimeTaken > 15500) { // 15s + 500ms grace period for network latency
    return socket.emit('answer:rejected', { reason: 'Time expired for this question' });
  }

  const currentQ = game.questions[game.currentQuestionIndex];
  const isCorrect = parseInt(selectedOption, 10) === currentQ.correctOption;
  const points = calculateScore(isCorrect, actualTimeTaken, 15000);

  player.answered = true;
  player.answerTime = actualTimeTaken;
  player.lastPoints = points;
  player.score += points;

  // Feedback to the submitting player
  socket.emit('answer:result', {
    isCorrect,
    pointsAwarded: points,
    totalScore: player.score
  });

  // Notify host that player answered
  io.to(game.hostSocketId).emit('player:answered', {
    playerName: player.name,
    totalAnswered: Object.values(game.players).filter(p => p.answered).length,
    totalPlayers: Object.keys(game.players).length
  });

  // If all players have answered before time expires, advance immediately
  const allAnswered = Object.values(game.players).every(p => p.answered);
  if (allAnswered) {
    clearInterval(game.timerInterval);
    endQuestion(io, pin);
  }
}

function endQuestion(io, pin) {
  const game = games[pin];
  if (!game) return;

  clearInterval(game.timerInterval);
  game.status = 'round_break';

  const currentQ = game.questions[game.currentQuestionIndex];
  const leaderboard = getLeaderboard(game);

  // 1. Reveal correct answer & explanation
  io.to(pin).emit('question:time_up', {
    correctOption: currentQ.correctOption,
    correctAnswerText: currentQ.options[currentQ.correctOption],
    explanation: currentQ.explanation || ''
  });

  // 2. Broadcast updated dynamic leaderboard
  io.to(pin).emit('leaderboard:update', {
    leaderboard
  });

  // 3. Move to next question after 4-second review intermission
  setTimeout(() => {
    game.currentQuestionIndex += 1;
    if (game.currentQuestionIndex < game.questions.length) {
      startQuestion(io, pin);
    } else {
      endQuiz(io, pin);
    }
  }, 4000);
}

function endQuiz(io, pin) {
  const game = games[pin];
  if (!game) return;

  clearInterval(game.timerInterval);
  game.status = 'ended';

  const finalRanks = getLeaderboard(game);
  const winner = finalRanks[0] || { name: 'Nobody', score: 0 };

  io.to(pin).emit('quiz:ended', {
    winner,
    finalRanks
  });

  console.log(`🏆 Quiz ${pin} finished! Winner: ${winner.name} (${winner.score} pts)`);
}

module.exports = {
  games,
  defaultQuestions,
  calculateScore,
  getLeaderboard,
  startQuestion,
  handleAnswerSubmission,
  endQuestion,
  endQuiz
};
