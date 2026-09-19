/**
 * Sockets: Game Engine
 * Handles authoritative round timers, anti-cheat validation,
 * speed-based dynamic scoring, round transitions, and dynamic leaderboards.
 */

const { rooms, getPlayerRoster } = require('./lobbyHandler');

const TOTAL_GAME_QUESTIONS = 5; // Standard battle length
const DEFAULT_TIME_LIMIT = 15; // 15 seconds per question
const REVEAL_DURATION_MS = 3000; // 3 seconds to display correct answer & explanation
const LEADERBOARD_DURATION_MS = 3500; // 3.5 seconds to display leaderboard before next question

/**
 * Dynamic Speed-Based Scoring Algorithm:
 * Score = Base (500) + Speed Bonus (up to 500)
 * Max score per question = 1000 points
 */
function calculateScore(isCorrect, timeTakenMs, totalTimeLimitMs = 15000) {
  if (!isCorrect) return 0;
  const timeRemaining = Math.max(0, totalTimeLimitMs - timeTakenMs);
  const speedBonus = Math.round((timeRemaining / totalTimeLimitMs) * 500);
  const baseScore = 500;
  return baseScore + speedBonus;
}

/**
 * Computes sorted leaderboard with rank assignments
 */
function computeLeaderboard(room) {
  const players = [];
  for (const [, player] of room.players.entries()) {
    players.push({
      socketId: player.socketId,
      name: player.name,
      score: player.score,
      streak: player.streak || 0,
      lastRoundPoints: player.lastRoundPoints || 0
    });
  }

  // Sort descending by score; break ties by name
  players.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return players.map((p, index) => ({
    rank: index + 1,
    name: p.name,
    score: p.score,
    streak: p.streak,
    lastRoundPoints: p.lastRoundPoints
  }));
}

/**
 * Starts a new question round
 */
function startNextQuestion(io, room) {
  if (!room) return;

  // Clear existing timers
  if (room.roundTimer) clearTimeout(room.roundTimer);
  if (room.transitionTimer) clearTimeout(room.transitionTimer);

  room.currentQuestionIndex++;
  const totalQuestions = Math.min(room.questions.length, TOTAL_GAME_QUESTIONS);

  if (room.currentQuestionIndex >= totalQuestions) {
    return endQuiz(io, room);
  }

  const questionData = room.questions[room.currentQuestionIndex];
  room.state = 'QUESTION';
  room.submissions.clear();
  room.roundStartTime = Date.now();
  room.timeLimitSeconds = questionData.timeLimitSeconds || DEFAULT_TIME_LIMIT;

  // Reset player answered flags for this round
  for (const [, player] of room.players.entries()) {
    player.hasAnswered = false;
    player.lastRoundPoints = 0;
  }

  console.log(
    `[GAME] Room PIN ${room.pin} -> Question ${room.currentQuestionIndex + 1}/${totalQuestions}`
  );

  // Broadcast question to room — STRICTOR: Omit correctOption and explanation to prevent cheating!
  io.to(room.roomId).emit('question:start', {
    questionIndex: room.currentQuestionIndex + 1,
    totalQuestions,
    question: questionData.question,
    options: questionData.options,
    timeLimitSeconds: room.timeLimitSeconds,
    category: questionData.category || room.category
  });

  // Server-authoritative timer
  const totalMs = room.timeLimitSeconds * 1000;
  room.roundTimer = setTimeout(() => {
    endQuestionRound(io, room);
  }, totalMs);
}

/**
 * Concludes the active question round, reveals correct answer, and broadcasts stats
 */
function endQuestionRound(io, room) {
  if (!room || room.state !== 'QUESTION') return;

  if (room.roundTimer) clearTimeout(room.roundTimer);
  room.state = 'TIME_UP';

  const currentQ = room.questions[room.currentQuestionIndex];
  const optionCounts = [0, 0, 0, 0];

  // Count choices
  for (const [, sub] of room.submissions.entries()) {
    if (sub.selectedOption >= 0 && sub.selectedOption < 4) {
      optionCounts[sub.selectedOption]++;
    }
  }

  // Calculate scores and streaks
  for (const [socketId, player] of room.players.entries()) {
    const sub = room.submissions.get(socketId);
    let roundPoints = 0;
    let isCorrect = false;

    if (sub && sub.isCorrect) {
      isCorrect = true;
      roundPoints = sub.scoreAdded;
      player.streak = (player.streak || 0) + 1;
    } else {
      player.streak = 0;
    }

    player.score += roundPoints;
    player.lastRoundPoints = roundPoints;

    // Send individual feedback to player
    io.to(socketId).emit('answer:result', {
      isCorrect,
      correctOption: currentQ.correctOption,
      scoreAdded: roundPoints,
      totalScore: player.score,
      streak: player.streak
    });
  }

  console.log(`[GAME] Room PIN ${room.pin} -> Time is up for Question ${room.currentQuestionIndex + 1}`);

  // Broadcast correct answer & summary stats to room
  io.to(room.roomId).emit('question:time_up', {
    correctOption: currentQ.correctOption,
    explanation: currentQ.explanation,
    stats: {
      totalAnswers: room.submissions.size,
      totalPlayers: room.players.size,
      optionCounts
    }
  });

  // Schedule Leaderboard Broadcast after REVEAL_DURATION_MS
  room.transitionTimer = setTimeout(() => {
    showLeaderboard(io, room);
  }, REVEAL_DURATION_MS);
}

/**
 * Broadcasts the updated leaderboard to the room
 */
function showLeaderboard(io, room) {
  if (!room) return;
  room.state = 'LEADERBOARD';

  const leaderboard = computeLeaderboard(room);

  console.log(`[GAME] Room PIN ${room.pin} -> Broadcasting Leaderboard:`, leaderboard.map(l => `${l.rank}. ${l.name} (${l.score})`).join(', '));

  io.to(room.roomId).emit('leaderboard:update', {
    leaderboard
  });

  const totalQuestions = Math.min(room.questions.length, TOTAL_GAME_QUESTIONS);

  // Transition to next question or end quiz after LEADERBOARD_DURATION_MS
  room.transitionTimer = setTimeout(() => {
    if (room.currentQuestionIndex + 1 < totalQuestions) {
      startNextQuestion(io, room);
    } else {
      endQuiz(io, room);
    }
  }, LEADERBOARD_DURATION_MS);
}

/**
 * Ends the quiz and crowns the winner
 */
function endQuiz(io, room) {
  if (!room) return;

  if (room.roundTimer) clearTimeout(room.roundTimer);
  if (room.transitionTimer) clearTimeout(room.transitionTimer);

  room.state = 'ENDED';
  const finalRanks = computeLeaderboard(room);
  const winner = finalRanks.length > 0 ? finalRanks[0] : { name: 'No participants', score: 0 };

  console.log(`[GAME] Room PIN ${room.pin} -> Quiz Ended! Winner: ${winner.name} (${winner.score} pts)`);

  io.to(room.roomId).emit('quiz:ended', {
    winner: {
      name: winner.name,
      score: winner.score
    },
    finalRanks
  });
}

/**
 * Registers game play socket handlers
 */
function registerGameHandlers(io, socket) {
  /**
   * Host starts the quiz battle
   * Payload: { pin: "8421" }
   */
  socket.on('quiz:start', (data = {}) => {
    try {
      const pin = String(data.pin || '').trim();
      const room = rooms.get(pin);

      if (!room) {
        return socket.emit('error:message', { message: 'Room not found.' });
      }

      if (room.hostSocketId !== socket.id) {
        return socket.emit('error:message', { message: 'Only the host can start the quiz.' });
      }

      if (room.state !== 'LOBBY') {
        return socket.emit('error:message', { message: 'Quiz is already running.' });
      }

      if (room.players.size === 0) {
        return socket.emit('error:message', {
          message: 'Cannot start quiz without players. Please wait for at least one player to join.'
        });
      }

      console.log(`[GAME] Host started quiz for room PIN ${pin} with ${room.players.size} players`);
      startNextQuestion(io, room);
    } catch (err) {
      console.error('[GAME] Error in quiz:start:', err);
      socket.emit('error:message', { message: 'Failed to start quiz.' });
    }
  });

  /**
   * Host manually advances to next question or skips
   * Payload: { pin: "8421" }
   */
  socket.on('quiz:next', (data = {}) => {
    try {
      const pin = String(data.pin || '').trim();
      const room = rooms.get(pin);
      if (!room || room.hostSocketId !== socket.id) return;

      if (room.state === 'LEADERBOARD' || room.state === 'TIME_UP') {
        if (room.transitionTimer) clearTimeout(room.transitionTimer);
        const totalQuestions = Math.min(room.questions.length, TOTAL_GAME_QUESTIONS);
        if (room.currentQuestionIndex + 1 < totalQuestions) {
          startNextQuestion(io, room);
        } else {
          endQuiz(io, room);
        }
      }
    } catch (err) {
      console.error('[GAME] Error in quiz:next:', err);
    }
  });

  /**
   * Player submits chosen option
   * Payload: { pin: "8421", selectedOption: 0, timeTakenMs: 3200 }
   */
  socket.on('answer:submit', (data = {}) => {
    try {
      const pin = String(data.pin || '').trim();
      const selectedOption = parseInt(data.selectedOption, 10);
      const room = rooms.get(pin);

      // Validation: Room exists
      if (!room) {
        return socket.emit('answer:rejected', {
          reason: 'Quiz room not found.'
        });
      }

      // Validation: Room in active question state
      if (room.state !== 'QUESTION') {
        return socket.emit('answer:rejected', {
          reason: 'No active question round accepting submissions.'
        });
      }

      const player = room.players.get(socket.id);
      if (!player) {
        return socket.emit('answer:rejected', {
          reason: 'You are not an active player in this room.'
        });
      }

      // Anti-Cheat: Reject duplicate answer submission
      if (room.submissions.has(socket.id)) {
        return socket.emit('answer:rejected', {
          reason: 'Answer already submitted for this round.'
        });
      }

      // Anti-Cheat: Timer Expiry Check (Server Authoritative)
      const now = Date.now();
      const serverElapsedMs = now - room.roundStartTime;
      const totalLimitMs = (room.timeLimitSeconds || DEFAULT_TIME_LIMIT) * 1000;
      const LATENCY_GRACE_PERIOD_MS = 500; // 500ms network tolerance

      if (serverElapsedMs > totalLimitMs + LATENCY_GRACE_PERIOD_MS) {
        return socket.emit('answer:rejected', {
          reason: 'Time expired! Answer submitted after clock ran out.'
        });
      }

      // Option bounds check
      const currentQ = room.questions[room.currentQuestionIndex];
      if (
        isNaN(selectedOption) ||
        selectedOption < 0 ||
        selectedOption >= currentQ.options.length
      ) {
        return socket.emit('answer:rejected', {
          reason: 'Invalid option selected.'
        });
      }

      // Anti-Cheat: Speed Calculation
      // Use the verified server elapsed time to prevent client-side time spoofing
      const verifiedTimeTakenMs = Math.min(
        Math.max(serverElapsedMs, 50),
        totalLimitMs
      );

      const isCorrect = selectedOption === currentQ.correctOption;
      const scoreAdded = calculateScore(isCorrect, verifiedTimeTakenMs, totalLimitMs);

      // Record submission
      room.submissions.set(socket.id, {
        socketId: socket.id,
        playerName: player.name,
        selectedOption,
        timeTakenMs: verifiedTimeTakenMs,
        isCorrect,
        scoreAdded
      });

      player.hasAnswered = true;

      // Acknowledge receipt to player
      socket.emit('answer:acknowledged', {
        selectedOption,
        timeTakenMs: verifiedTimeTakenMs
      });

      // Notify host of live answer submission count
      io.to(room.hostSocketId).emit('answer:count_update', {
        answeredCount: room.submissions.size,
        totalPlayers: room.players.size
      });

      // If all players have answered, trigger round end early
      if (room.submissions.size >= room.players.size && room.players.size > 0) {
        if (room.roundTimer) clearTimeout(room.roundTimer);
        // Short 500ms delay for snappy transition
        room.roundTimer = setTimeout(() => {
          endQuestionRound(io, room);
        }, 500);
      }
    } catch (err) {
      console.error('[GAME] Error in answer:submit:', err);
      socket.emit('answer:rejected', { reason: 'Failed to process submission.' });
    }
  });
}

module.exports = {
  calculateScore,
  computeLeaderboard,
  startNextQuestion,
  endQuestionRound,
  showLeaderboard,
  endQuiz,
  registerGameHandlers
};
