// Authoritative Quiz Game Engine with timers, scoring, and leaderboard broadcasts

const TIME_LIMIT_SECONDS = 15;
const TIME_LIMIT_MS = TIME_LIMIT_SECONDS * 1000;

// Dynamic scoring algorithm: Base score (500) + Speed Bonus (up to 500)
function calculateScore(isCorrect, timeTakenMs, totalTimeLimitMs = TIME_LIMIT_MS) {
  if (!isCorrect) return 0;
  const timeRemaining = Math.max(0, totalTimeLimitMs - timeTakenMs);
  const speedBonus = Math.round((timeRemaining / totalTimeLimitMs) * 500);
  const baseScore = 500;
  return baseScore + speedBonus; // Max 1000 points per question
}

// Send a question round
function sendQuestion(io, games, pin, questionIndex) {
  const game = games[pin];
  if (!game) return;

  game.status = "question";
  game.currentQuestionIndex = questionIndex;
  game.questionStartTime = Date.now();

  // Reset answered status for all players
  Object.values(game.players).forEach((p) => {
    p.answered = false;
  });

  const currentQ = game.questions[questionIndex];

  // Broadcast question to all room participants (OMIT correct answer to prevent cheating)
  io.to(game.roomId).emit("question:start", {
    questionIndex: questionIndex + 1,
    totalQuestions: game.questions.length,
    question: currentQ.question,
    options: currentQ.options,
    timeLimitSeconds: TIME_LIMIT_SECONDS
  });

  // Start authoritative 15-second server countdown timer
  if (game.timer) clearTimeout(game.timer);

  game.timer = setTimeout(() => {
    finishQuestion(io, games, pin);
  }, TIME_LIMIT_MS);
}

// Finish question round, reveal answer and broadcast leaderboard
function finishQuestion(io, games, pin) {
  const game = games[pin];
  if (!game || game.status !== "question") return;

  if (game.timer) {
    clearTimeout(game.timer);
    game.timer = null;
  }

  game.status = "review";
  const currentQ = game.questions[game.currentQuestionIndex];

  // 1. Reveal correct answer and explanation to all participants
  io.to(game.roomId).emit("question:time_up", {
    correctOption: currentQ.correctOption,
    explanation: currentQ.explanation
  });

  // 2. Calculate and broadcast sorted leaderboard
  const sortedLeaderboard = Object.values(game.players)
    .sort((a, b) => b.score - a.score)
    .map((p, index) => ({
      rank: index + 1,
      name: p.name,
      score: p.score
    }));

  io.to(game.roomId).emit("leaderboard:update", {
    leaderboard: sortedLeaderboard
  });

  // 3. Transition to next question or end quiz after 5 seconds review delay
  setTimeout(() => {
    if (!games[pin]) return;

    if (game.currentQuestionIndex + 1 < game.questions.length) {
      sendQuestion(io, games, pin, game.currentQuestionIndex + 1);
    } else {
      game.status = "ended";
      io.to(game.roomId).emit("quiz:ended", {
        winner: sortedLeaderboard[0] || { name: "No players", score: 0 },
        finalRanks: sortedLeaderboard
      });
    }
  }, 5000);
}

module.exports = function (io, socket, games) {

  // Host starts the quiz
  socket.on("quiz:start", (data) => {
    const { pin } = data || {};
    const game = games[pin];

    if (!game) return;
    if (socket.id !== game.hostSocketId) {
      return socket.emit("quiz:error", { message: "Only the Host can start the quiz." });
    }

    const playerCount = Object.keys(game.players).length;
    if (playerCount === 0) {
      return socket.emit("quiz:error", { message: "Need at least 1 player to start the quiz." });
    }

    sendQuestion(io, games, pin, 0);
  });

  // Player submits answer
  socket.on("answer:submit", (data) => {
    const { pin, selectedOption, timeTakenMs } = data || {};
    const game = games[pin];

    if (!game || game.status !== "question") {
      return socket.emit("answer:error", { message: "Question round is closed." });
    }

    const player = game.players[socket.id];
    if (!player || player.answered) {
      return socket.emit("answer:error", { message: "You have already submitted an answer." });
    }

    // Anti-cheat: Validate server-side response elapsed time
    const serverTimeTaken = Date.now() - game.questionStartTime;
    if (serverTimeTaken > TIME_LIMIT_MS + 1000) {
      return socket.emit("answer:error", { message: "Time expired!" });
    }

    const currentQ = game.questions[game.currentQuestionIndex];
    const isCorrect = parseInt(selectedOption, 10) === currentQ.correctOption;
    const responseTime = Math.min(TIME_LIMIT_MS, Math.max(0, timeTakenMs || serverTimeTaken));

    const pointsEarned = calculateScore(isCorrect, responseTime, TIME_LIMIT_MS);
    player.score += pointsEarned;
    player.answered = true;

    // Send immediate personal feedback to the player
    socket.emit("answer:result", {
      correct: isCorrect,
      pointsEarned: pointsEarned,
      currentScore: player.score,
      timeTakenMs: responseTime
    });

    // Check if ALL active players have answered; if so, trigger time_up early
    const allAnswered = Object.values(game.players).every((p) => p.answered);
    if (allAnswered) {
      finishQuestion(io, games, pin);
    }
  });
};
