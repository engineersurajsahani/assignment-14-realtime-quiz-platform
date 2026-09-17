// sockets/gameEngine.js
const { rooms } = require('./lobbyHandler');

/**
 * Server-Side Scoring Algorithm
 * Base (500) + Speed Bonus (up to 500)
 */
function calculateScore(isCorrect, timeTakenMs, totalTimeLimitMs = 15000) {
  if (!isCorrect) return 0;
  const timeRemaining = Math.max(0, totalTimeLimitMs - timeTakenMs);
  const speedBonus = Math.round((timeRemaining / totalTimeLimitMs) * 500); // Up to 500 bonus points
  const baseScore = 500;
  return baseScore + speedBonus; // Total max 1000 points per question
}

/**
 * Compute leaderboard with dense ranking and tie handling
 */
function computeLeaderboard(playersObj) {
  const players = Object.values(playersObj || {});
  // Sort descending by score
  players.sort((a, b) => b.score - a.score);

  let currentRank = 1;
  const leaderboard = [];

  for (let i = 0; i < players.length; i++) {
    if (i > 0 && players[i].score < players[i - 1].score) {
      currentRank = i + 1;
    }
    leaderboard.push({
      rank: currentRank,
      name: players[i].name,
      score: players[i].score
    });
  }

  return leaderboard;
}

/**
 * Broadcast current leaderboard to the room
 */
function broadcastLeaderboard(io, room) {
  if (!room) return;
  const leaderboard = computeLeaderboard(room.players);
  io.to(room.roomId).emit('leaderboard:update', {
    leaderboard
  });
}

/**
 * Start the next question or end the quiz
 */
function sendNextQuestion(io, room) {
  if (!room) return;

  // Clear any existing timers
  if (room.timer) clearTimeout(room.timer);
  if (room.reviewTimer) clearTimeout(room.reviewTimer);

  room.currentQuestionIndex++;

  // Check if all questions are completed
  if (room.currentQuestionIndex >= room.questions.length) {
    room.status = 'ENDED';
    const finalLeaderboard = computeLeaderboard(room.players);
    const winner = finalLeaderboard.length > 0 ? finalLeaderboard[0] : { name: 'None', score: 0 };

    console.log(`[GAME] Room ${room.pin} Quiz Ended. Winner: ${winner.name} (${winner.score} pts)`);

    io.to(room.roomId).emit('quiz:ended', {
      winner,
      finalRanks: finalLeaderboard
    });
    return;
  }

  const currentQ = room.questions[room.currentQuestionIndex];
  const timeLimitSeconds = room.timeLimitSeconds || 15;

  // Reset player per-question state
  Object.values(room.players).forEach((p) => {
    p.answered = false;
    p.lastRoundScore = 0;
    p.lastSelectedOption = null;
  });

  room.status = 'QUESTION';
  room.isQuestionOpen = true;
  room.questionStartTime = Date.now();

  console.log(
    `[GAME] Room ${room.pin}: Broadcasting Question ${room.currentQuestionIndex + 1}/${room.questions.length}`
  );

  // Broadcast question:start without revealing the correctOption
  io.to(room.roomId).emit('question:start', {
    questionIndex: room.currentQuestionIndex + 1,
    totalQuestions: room.questions.length,
    question: currentQ.question,
    options: currentQ.options,
    timeLimitSeconds
  });

  // Server-authoritative timer
  room.timer = setTimeout(() => {
    handleTimeUp(io, room);
  }, timeLimitSeconds * 1000);
}

/**
 * Handles time up for the current question
 */
function handleTimeUp(io, room) {
  if (!room || room.status !== 'QUESTION') return;

  room.isQuestionOpen = false;
  room.status = 'QUESTION_REVIEW';
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }

  const currentQ = room.questions[room.currentQuestionIndex];

  console.log(
    `[GAME] Room ${room.pin}: Time up for Question ${room.currentQuestionIndex + 1}. Correct: ${currentQ.correctOption}`
  );

  // 1. Reveal correct answer and explanation
  io.to(room.roomId).emit('question:time_up', {
    correctOption: currentQ.correctOption,
    explanation: currentQ.explanation
  });

  // 2. Broadcast updated leaderboard after round
  broadcastLeaderboard(io, room);

  // 3. Auto transition to next question after 5 seconds of review
  room.reviewTimer = setTimeout(() => {
    sendNextQuestion(io, room);
  }, 5000);
}

function registerGameHandlers(io, socket) {
  // Host starts the quiz
  socket.on('quiz:start', (payload = {}) => {
    const pin = String(payload.pin || socket.pin || '').trim();
    const room = rooms[pin];

    if (!room) {
      return socket.emit('quiz:error', { message: 'Room not found.' });
    }

    if (socket.id !== room.hostSocketId) {
      return socket.emit('quiz:error', { message: 'Only the host can start the quiz.' });
    }

    if (room.status !== 'LOBBY') {
      return socket.emit('quiz:error', { message: 'Quiz has already started.' });
    }

    console.log(`[GAME] Host started quiz for Room ${pin} with ${Object.keys(room.players).length} players.`);
    room.currentQuestionIndex = -1;
    sendNextQuestion(io, room);
  });

  // Player submits an answer
  socket.on('answer:submit', (payload = {}) => {
    const pin = String(payload.pin || socket.pin || '').trim();
    const room = rooms[pin];

    if (!room) {
      return socket.emit('answer:rejected', { reason: 'Room not found.' });
    }

    const player = room.players[socket.id];
    if (!player) {
      return socket.emit('answer:rejected', { reason: 'Player not registered in this room.' });
    }

    // Anti-cheat 1: Check if question is open on server
    if (!room.isQuestionOpen || room.status !== 'QUESTION') {
      console.warn(`[ANTI-CHEAT] Player ${player.name} submitted after round closed in room ${pin}. Rejected.`);
      return socket.emit('answer:rejected', { reason: 'Question time has expired.' });
    }

    // Anti-cheat 2: Duplicate-answer prevention
    if (player.answered) {
      return socket.emit('answer:rejected', { reason: 'Answer already submitted for this question.' });
    }

    // Anti-cheat 3: Authoritative server elapsed time verification
    const serverElapsedMs = Date.now() - room.questionStartTime;
    const totalLimitMs = (room.timeLimitSeconds || 15) * 1000;

    // Grace period of 500ms for network latency
    if (serverElapsedMs > totalLimitMs + 500) {
      console.warn(
        `[ANTI-CHEAT] Server elapsed time (${serverElapsedMs}ms) exceeded limit for ${player.name}. Rejected.`
      );
      return socket.emit('answer:rejected', { reason: 'Answer arrived after time limit.' });
    }

    // Use client timeTakenMs clamped to server elapsed time to prevent manipulation
    const clientTimeTakenMs = typeof payload.timeTakenMs === 'number' ? payload.timeTakenMs : serverElapsedMs;
    const effectiveTimeTakenMs = Math.min(Math.max(0, clientTimeTakenMs), serverElapsedMs);

    const selectedOption = parseInt(payload.selectedOption, 10);
    const currentQ = room.questions[room.currentQuestionIndex];
    const isCorrect = selectedOption === currentQ.correctOption;

    // Calculate score with authoritative speed bonus
    const scoreGained = calculateScore(isCorrect, effectiveTimeTakenMs, totalLimitMs);

    // Update player state
    player.answered = true;
    player.score += scoreGained;
    player.lastRoundScore = scoreGained;
    player.lastSelectedOption = selectedOption;

    console.log(
      `[GAME] Room ${pin} - Player ${player.name} answered option ${selectedOption} (${isCorrect ? 'CORRECT' : 'WRONG'}) in ${effectiveTimeTakenMs}ms -> +${scoreGained} pts (Total: ${player.score})`
    );

    // Acknowledge answer to player
    socket.emit('answer:acknowledged', {
      selectedOption,
      isCorrect,
      scoreGained,
      totalScore: player.score
    });

    // Notify host about submission progress
    const answeredCount = Object.values(room.players).filter((p) => p.answered).length;
    const totalPlayers = Object.keys(room.players).length;

    io.to(room.hostSocketId).emit('host:answer_count_update', {
      answeredCount,
      totalPlayers
    });

    // If all connected players have answered, accelerate time up
    if (answeredCount > 0 && answeredCount >= totalPlayers) {
      console.log(`[GAME] All ${totalPlayers} players answered in room ${pin}. Triggering instant review.`);
      if (room.timer) clearTimeout(room.timer);
      // Small 300ms pause so UI feels responsive before revealing
      room.timer = setTimeout(() => {
        handleTimeUp(io, room);
      }, 300);
    }
  });
}

module.exports = {
  calculateScore,
  computeLeaderboard,
  broadcastLeaderboard,
  registerGameHandlers
};
