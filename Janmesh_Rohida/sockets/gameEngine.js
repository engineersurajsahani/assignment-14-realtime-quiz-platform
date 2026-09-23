/**
 * gameEngine.js - Authoritative game engine: timers, speed-scoring, round transitions, and leaderboard updates.
 */

/**
 * Server-Side Scoring Algorithm per specification:
 * Base score: 500 points for correct answer.
 * Speed bonus: Up to 500 additional points based on remaining time.
 * Max points per question: 1000.
 *
 * @param {boolean} isCorrect - Whether the player selected the correct option
 * @param {number} timeTakenMs - Milliseconds elapsed from question start
 * @param {number} totalTimeLimitMs - Total question duration (default 15000ms)
 * @returns {number} Score earned for this question
 */
function calculateScore(isCorrect, timeTakenMs, totalTimeLimitMs = 15000) {
  if (!isCorrect) return 0;
  const timeRemaining = Math.max(0, totalTimeLimitMs - timeTakenMs);
  const speedBonus = Math.round((timeRemaining / totalTimeLimitMs) * 500); // up to 500 bonus
  const baseScore = 500;
  return baseScore + speedBonus; // max 1000 points per question
}

/**
 * Starts the quiz session (Host action).
 * @param {Map} rooms 
 * @param {Socket} socket 
 * @param {Object} data - { pin }
 * @param {Server} io 
 */
function startGame(rooms, socket, data, io) {
  if (!data || !data.pin) {
    return socket.emit("error:game", { message: "Room PIN is required to start game." });
  }

  const pin = data.pin.toString().trim();
  if (!rooms.has(pin)) {
    return socket.emit("error:game", { message: `Room PIN "${pin}" not found.` });
  }

  const room = rooms.get(pin);

  // Validate Host authorization
  if (socket.id !== room.hostSocketId) {
    return socket.emit("error:game", { message: "Only the Quiz Host can start the game." });
  }

  if (room.players.length === 0) {
    return socket.emit("error:game", { message: "Cannot start game with zero players in lobby." });
  }

  if (room.status !== "lobby") {
    return socket.emit("error:game", { message: "Quiz game is already in progress or completed." });
  }

  room.status = "in_progress";
  room.currentQuestionIndex = -1;

  console.log(`[GAME] Quiz started for PIN ${pin} with ${room.players.length} player(s).`);

  startNextQuestion(room, io);
}

/**
 * Advances to the next question round.
 * @param {Object} room 
 * @param {Server} io 
 */
function startNextQuestion(room, io) {
  // Clear any existing timeouts
  if (room.questionTimer) clearTimeout(room.questionTimer);
  if (room.nextRoundTimeout) clearTimeout(room.nextRoundTimeout);

  room.currentQuestionIndex++;

  // Check if all questions are finished
  if (room.currentQuestionIndex >= room.questions.length) {
    return endQuiz(room, io);
  }

  // Reset player per-round states
  room.players.forEach(p => {
    p.answered = false;
    p.lastAnswerCorrect = null;
    p.lastPointsGained = 0;
  });

  const q = room.questions[room.currentQuestionIndex];
  room.questionStartTimestamp = Date.now();

  // Construct question payload for clients (NEVER include correctOption or explanation)
  const questionPayload = {
    questionIndex: room.currentQuestionIndex,
    totalQuestions: room.questions.length,
    question: q.question,
    options: q.options,
    category: q.category,
    timeLimitSeconds: room.timeLimitSeconds
  };

  console.log(`[GAME] PIN ${room.pin} -> Starting Question ${room.currentQuestionIndex + 1}/${room.questions.length}`);

  // Broadcast question:start to room
  io.to(room.roomId).emit("question:start", questionPayload);

  // Start authoritative 15-second server-side timer
  const timerMs = room.timeLimitSeconds * 1000;
  room.questionTimer = setTimeout(() => {
    handleTimeUp(room, io);
  }, timerMs);
}

/**
 * Handles player answer submission.
 * @param {Map} rooms 
 * @param {Socket} socket 
 * @param {Object} data - { pin, selectedOption, timeTakenMs }
 * @param {Server} io 
 */
function submitAnswer(rooms, socket, data, io) {
  if (!data || data.pin === undefined || data.selectedOption === undefined) {
    return socket.emit("error:answer", { message: "Invalid submission data." });
  }

  const pin = data.pin.toString().trim();
  if (!rooms.has(pin)) {
    return socket.emit("error:answer", { message: "Room not found." });
  }

  const room = rooms.get(pin);

  if (room.status !== "in_progress") {
    return socket.emit("error:answer", { message: "Quiz is not currently active." });
  }

  const player = room.players.find(p => p.socketId === socket.id);
  if (!player) {
    return socket.emit("error:answer", { message: "Player not found in this room." });
  }

  // ANTI-CHEAT CHECK 1: Disallow double submission
  if (player.answered) {
    return socket.emit("error:answer", { message: "You have already submitted an answer for this question." });
  }

  // ANTI-CHEAT CHECK 2: Validate timer expiration
  const serverElapsedMs = Date.now() - room.questionStartTimestamp;
  const maxAllowedMs = room.timeLimitSeconds * 1000 + 1000; // 1s grace margin for network jitter
  if (serverElapsedMs > maxAllowedMs) {
    return socket.emit("error:answer", { message: "Time limit expired! Submission rejected." });
  }

  // Calculate canonical time taken (prefer smaller of client-reported or server elapsed, bounded by server elapsed)
  const clientTimeTakenMs = typeof data.timeTakenMs === 'number' ? data.timeTakenMs : serverElapsedMs;
  const canonicalTimeMs = Math.min(Math.max(0, clientTimeTakenMs), serverElapsedMs);

  const currentQ = room.questions[room.currentQuestionIndex];
  const selectedOptionIndex = parseInt(data.selectedOption, 10);
  const isCorrect = (selectedOptionIndex === currentQ.correctOption);

  const pointsGained = calculateScore(isCorrect, canonicalTimeMs, room.timeLimitSeconds * 1000);

  // Update player state
  player.score += pointsGained;
  player.answered = true;
  player.lastAnswerCorrect = isCorrect;
  player.lastPointsGained = pointsGained;

  console.log(`[GAME] PIN ${room.pin} -> Player "${player.name}" answered ${isCorrect ? 'CORRECT' : 'INCORRECT'} in ${canonicalTimeMs}ms (+${pointsGained} pts, total: ${player.score})`);

  // Acknowledge submission privately to player
  socket.emit("answer:ack", {
    isCorrect,
    pointsGained,
    totalScore: player.score
  });

  // Notify host live progress count
  const answeredCount = room.players.filter(p => p.answered).length;
  io.to(room.hostSocketId).emit("host:player_answered", {
    answeredCount,
    totalPlayers: room.players.length
  });

  // Early end condition: check if 100% of players have answered
  const allAnswered = room.players.every(p => p.answered);
  if (allAnswered && room.players.length > 0) {
    console.log(`[GAME] PIN ${room.pin} -> All ${room.players.length} player(s) answered early. Ending round.`);
    if (room.questionTimer) clearTimeout(room.questionTimer);
    handleTimeUp(room, io);
  }
}

/**
 * Reveals answer and broadcasts sorted leaderboard when round timer expires.
 * @param {Object} room 
 * @param {Server} io 
 */
function handleTimeUp(room, io) {
  if (room.questionTimer) clearTimeout(room.questionTimer);

  const q = room.questions[room.currentQuestionIndex];

  // 1. Reveal correct answer & explanation
  io.to(room.roomId).emit("question:time_up", {
    correctOption: q.correctOption,
    explanation: q.explanation
  });

  // 2. Calculate sorted leaderboard
  const sortedLeaderboard = [...room.players]
    .sort((a, b) => b.score - a.score)
    .map((p, index) => ({
      rank: index + 1,
      name: p.name,
      score: p.score,
      lastAnswerCorrect: p.lastAnswerCorrect,
      lastPointsGained: p.lastPointsGained
    }));

  // Broadcast leaderboard update
  io.to(room.roomId).emit("leaderboard:update", {
    leaderboard: sortedLeaderboard
  });

  // Schedule transition to next question or final winner screen after a 5s reveal window
  room.nextRoundTimeout = setTimeout(() => {
    if (room.currentQuestionIndex + 1 < room.questions.length) {
      startNextQuestion(room, io);
    } else {
      endQuiz(room, io);
    }
  }, 5000);
}

/**
 * Concludes the quiz session and announces the winner.
 * @param {Object} room 
 * @param {Server} io 
 */
function endQuiz(room, io) {
  if (room.questionTimer) clearTimeout(room.questionTimer);
  if (room.nextRoundTimeout) clearTimeout(room.nextRoundTimeout);

  room.status = "ended";

  const sortedRanks = [...room.players]
    .sort((a, b) => b.score - a.score)
    .map((p, index) => ({
      rank: index + 1,
      name: p.name,
      score: p.score
    }));

  const winner = sortedRanks.length > 0 ? sortedRanks[0] : null;

  console.log(`[GAME] PIN ${room.pin} -> Quiz Ended! Winner: ${winner ? winner.name : 'None'} with ${winner ? winner.score : 0} pts.`);

  io.to(room.roomId).emit("quiz:ended", {
    winner: winner ? { name: winner.name, score: winner.score } : null,
    finalRanks: sortedRanks
  });
}

module.exports = {
  calculateScore,
  startGame,
  submitAnswer,
  handleTimeUp,
  endQuiz
};
