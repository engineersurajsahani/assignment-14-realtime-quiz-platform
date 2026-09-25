const { rooms } = require('./lobbyHandler');

// Calculate score based on answer correctness and response speed
function calculateScore(isCorrect, timeTakenMs, totalTimeLimitMs = 15000) {
  if (!isCorrect) return 0;

  const timeRemaining = Math.max(0, totalTimeLimitMs - timeTakenMs);
  const speedBonus = Math.round((timeRemaining / totalTimeLimitMs) * 500); // Up to 500 bonus points
  const baseScore = 500;

  return baseScore + speedBonus; // Total max 1000 points per question
}

// Generate sorted leaderboard payload
function getSortedLeaderboard(room) {
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  return sorted.map((player, index) => ({
    rank: index + 1,
    name: player.name,
    score: player.score
  }));
}

// Check if all players in room have submitted an answer
function checkAllPlayersAnswered(room) {
  if (room.players.length === 0) return false;
  return room.players.every(p => p.answered);
}

// Start question round
function startQuestionRound(io, room) {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }

  // Reset player answers for this round
  room.players.forEach(p => {
    p.answered = false;
    p.currentAnswer = null;
  });

  const currentQ = room.questions[room.currentQuestionIndex];
  room.state = 'QUESTION';
  room.questionStartTime = Date.now();
  room.countdown = currentQ.timeLimitSeconds || 15;

  console.log(
    `[GameEngine] Starting Q${room.currentQuestionIndex + 1} for Room ${room.pin}`
  );

  // Broadcast question payload to room (OMITS correctOption and explanation)
  const questionPayload = {
    questionIndex: room.currentQuestionIndex + 1,
    totalQuestions: room.questions.length,
    question: currentQ.question,
    options: currentQ.options,
    timeLimitSeconds: room.countdown
  };

  io.to(room.roomId).emit('question:start', questionPayload);

  // Send immediate initial tick
  io.to(room.roomId).emit('timer:tick', { timeLeft: room.countdown });

  // Countdown timer loop
  room.timerInterval = setInterval(() => {
    room.countdown -= 1;
    io.to(room.roomId).emit('timer:tick', { timeLeft: Math.max(0, room.countdown) });

    if (room.countdown <= 0) {
      clearInterval(room.timerInterval);
      room.timerInterval = null;
      endQuestionRound(io, room);
    }
  }, 1000);
}

// End question round, reveal answer and send leaderboard
function endQuestionRound(io, room) {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }

  room.state = 'REVEAL';
  const currentQ = room.questions[room.currentQuestionIndex];

  console.log(`[GameEngine] Time up for Q${room.currentQuestionIndex + 1} in Room ${room.pin}`);

  // Reveal correct answer and explanation to all room participants
  io.to(room.roomId).emit('question:time_up', {
    correctOption: currentQ.correctOption,
    explanation: currentQ.explanation
  });

  // Calculate and broadcast live sorted leaderboard
  const leaderboard = getSortedLeaderboard(room);
  io.to(room.roomId).emit('leaderboard:update', { leaderboard });

  // Check if answer submission stats should be sent to host
  const stats = {
    totalPlayers: room.players.length,
    answeredCount: room.players.filter(p => p.answered).length,
    optionCounts: [0, 0, 0, 0]
  };

  room.players.forEach(p => {
    if (p.currentAnswer && p.currentAnswer.selectedOption !== undefined) {
      const idx = p.currentAnswer.selectedOption;
      if (stats.optionCounts[idx] !== undefined) {
        stats.optionCounts[idx]++;
      }
    }
  });

  io.to(room.roomId).emit('round:stats', stats);
}

function initGameEngine(io, socket) {
  // Host starts the quiz
  socket.on('quiz:start', (data = {}) => {
    const { pin } = data;
    if (!pin || !rooms.has(pin)) {
      return socket.emit('quiz:error', { message: 'Invalid room PIN.' });
    }

    const room = rooms.get(pin);

    if (room.hostSocketId !== socket.id) {
      return socket.emit('quiz:error', { message: 'Only the Host can start the quiz.' });
    }

    if (room.players.length === 0) {
      return socket.emit('quiz:error', { message: 'Cannot start quiz with 0 players in lobby.' });
    }

    room.currentQuestionIndex = 0;
    startQuestionRound(io, room);
  });

  // Player submits answer
  socket.on('answer:submit', (data = {}) => {
    const { pin, selectedOption } = data;

    if (!pin || !rooms.has(pin)) {
      return socket.emit('answer:rejected', { message: 'Invalid room PIN.' });
    }

    const room = rooms.get(pin);

    if (room.state !== 'QUESTION') {
      return socket.emit('answer:rejected', {
        message: 'Answers are not currently accepted for this round.'
      });
    }

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) {
      return socket.emit('answer:rejected', { message: 'Player not found in room.' });
    }

    if (player.answered) {
      return socket.emit('answer:rejected', { message: 'You have already submitted an answer.' });
    }

    const totalTimeLimitMs = (room.questions[room.currentQuestionIndex].timeLimitSeconds || 15) * 1000;
    const serverTimeTakenMs = Date.now() - room.questionStartTime;

    // Anti-cheat validation: reject if submitted after time limit (+ 500ms network buffer)
    if (serverTimeTakenMs > totalTimeLimitMs + 500) {
      return socket.emit('answer:rejected', {
        message: 'Time expired! Answer was submitted after countdown ended.'
      });
    }

    const currentQ = room.questions[room.currentQuestionIndex];
    const isCorrect = selectedOption === currentQ.correctOption;
    const scoreEarned = calculateScore(isCorrect, serverTimeTakenMs, totalTimeLimitMs);

    player.answered = true;
    player.currentAnswer = {
      selectedOption,
      timeTakenMs: serverTimeTakenMs,
      isCorrect,
      scoreEarned
    };
    player.score += scoreEarned;

    console.log(
      `[GameEngine] Player ${player.name} submitted option ${selectedOption} in ${serverTimeTakenMs}ms. Correct: ${isCorrect}, Score Earned: ${scoreEarned}`
    );

    // Acknowledge submission to player
    socket.emit('answer:ack', {
      success: true,
      selectedOption,
      isCorrect,
      scoreEarned,
      totalScore: player.score
    });

    // Send answer count update to Host
    const answeredCount = room.players.filter(p => p.answered).length;
    io.to(room.roomId).emit('answer:progress', {
      answeredCount,
      totalPlayers: room.players.length
    });

    // If all players have submitted answers, finish round immediately
    if (checkAllPlayersAnswered(room)) {
      console.log(`[GameEngine] All players answered for Room ${pin}. Ending round early.`);
      endQuestionRound(io, room);
    }
  });

  // Host triggers next question
  socket.on('question:next', (data = {}) => {
    const { pin } = data;
    if (!pin || !rooms.has(pin)) return;

    const room = rooms.get(pin);
    if (room.hostSocketId !== socket.id) return;

    room.currentQuestionIndex += 1;

    if (room.currentQuestionIndex >= room.questions.length) {
      // Quiz ended
      room.state = 'ENDED';
      const finalLeaderboard = getSortedLeaderboard(room);
      const winner = finalLeaderboard[0] || { name: 'No Winner', score: 0 };

      console.log(`[GameEngine] Quiz Ended for Room ${pin}. Winner: ${winner.name}`);

      io.to(room.roomId).emit('quiz:ended', {
        winner,
        finalRanks: finalLeaderboard
      });
    } else {
      startQuestionRound(io, room);
    }
  });
}

module.exports = {
  calculateScore,
  getSortedLeaderboard,
  initGameEngine
};
