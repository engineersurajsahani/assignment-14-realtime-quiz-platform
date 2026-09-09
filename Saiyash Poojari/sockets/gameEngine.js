function calculateScore(isCorrect, timeTakenMs, totalTimeLimitMs = 15000) {
  if (!isCorrect) return 0;

  const timeRemaining = Math.max(0, totalTimeLimitMs - timeTakenMs);
  const speedBonus = Math.round((timeRemaining / totalTimeLimitMs) * 500);
  const baseScore = 500;

  return baseScore + speedBonus;
}

function computeOptionBreakdown(question, roundAnswers) {
  const breakdown = [0, 0, 0, 0];
  for (const ans of roundAnswers.values()) {
    if (ans.optionIndex >= 0 && ans.optionIndex < 4) {
      breakdown[ans.optionIndex]++;
    }
  }
  return breakdown;
}

function endQuestionRound(io, room) {
  if (!room || room.state !== 'QUESTION') return;

  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
    room.roundTimer = null;
  }

  room.state = 'TIME_UP';
  const currentQ = room.questions[room.currentQuestionIndex];
  const totalTimeLimitMs = (currentQ.timeLimitSeconds || 15) * 1000;

  for (const player of room.players.values()) {
    if (!room.roundAnswers.has(player.socketId)) {
      player.lastScoreAdded = 0;
    }
  }

  const optionBreakdown = computeOptionBreakdown(currentQ, room.roundAnswers);

  io.to(room.roomId).emit('question:time_up', {
    correctOption: currentQ.correctOption,
    explanation: currentQ.explanation,
    optionBreakdown
  });

  const sortedPlayers = Array.from(room.players.values())
    .sort((a, b) => b.score - a.score);

  const leaderboard = sortedPlayers.map((p, idx) => ({
    rank: idx + 1,
    name: p.name,
    score: p.score,
    lastScoreAdded: p.lastScoreAdded
  }));

  io.to(room.roomId).emit('leaderboard:update', {
    leaderboard
  });

  console.log(`[GAME ENGINE] Question ${room.currentQuestionIndex + 1} completed for Room ${room.pin}`);

  room.autoNextTimer = setTimeout(() => {
    advanceToNextQuestionOrEnd(io, room);
  }, 7000);
}

function advanceToNextQuestionOrEnd(io, room) {
  if (!room || room.state !== 'TIME_UP') return;

  if (room.autoNextTimer) {
    clearTimeout(room.autoNextTimer);
    room.autoNextTimer = null;
  }

  room.currentQuestionIndex++;

  if (room.currentQuestionIndex < room.questions.length) {
    sendQuestion(io, room);
  } else {
    room.state = 'ENDED';
    const sortedPlayers = Array.from(room.players.values())
      .sort((a, b) => b.score - a.score);

    const finalRanks = sortedPlayers.map((p, idx) => ({
      rank: idx + 1,
      name: p.name,
      score: p.score
    }));

    const winner = finalRanks[0] || { name: 'None', score: 0 };

    io.to(room.roomId).emit('quiz:ended', {
      winner,
      finalRanks
    });

    console.log(`[GAME ENGINE] Quiz ended for Room ${room.pin}. Winner: ${winner.name} (${winner.score} pts)`);
  }
}

function sendQuestion(io, room) {
  room.state = 'QUESTION';
  room.questionStartTime = Date.now();
  room.roundAnswers.clear();

  for (const player of room.players.values()) {
    player.answeredThisRound = false;
    player.lastScoreAdded = 0;
  }

  const currentQ = room.questions[room.currentQuestionIndex];
  const timeLimitSeconds = currentQ.timeLimitSeconds || 15;

  console.log(`[GAME ENGINE] Broadcasting Question ${room.currentQuestionIndex + 1}/${room.questions.length} to Room ${room.pin}`);

  io.to(room.roomId).emit('question:start', {
    questionIndex: room.currentQuestionIndex + 1,
    totalQuestions: room.questions.length,
    question: currentQ.question,
    options: currentQ.options,
    category: currentQ.category || room.category,
    timeLimitSeconds
  });

  io.to(room.roomId).emit('answer:progress', {
    answeredCount: 0,
    totalPlayers: room.players.size
  });

  room.roundTimer = setTimeout(() => {
    endQuestionRound(io, room);
  }, timeLimitSeconds * 1000);
}

function initGameEngineHandlers(io, socket, rooms) {
  socket.on('quiz:start', (payload = {}) => {
    const { pin } = payload;
    if (!pin) return;

    const room = rooms.get(pin.toString().trim());
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (room.hostSocketId !== socket.id) {
      socket.emit('error', { message: 'Only the room host can start the game.' });
      return;
    }

    if (room.players.size === 0) {
      socket.emit('error', { message: 'Cannot start game without players in lobby!' });
      return;
    }

    if (room.state !== 'LOBBY') {
      socket.emit('error', { message: 'Game has already started.' });
      return;
    }

    room.currentQuestionIndex = 0;
    sendQuestion(io, room);
  });

  socket.on('answer:submit', (payload = {}, callback) => {
    const { pin, selectedOption } = payload;
    const cleanPin = pin ? pin.toString().trim() : '';
    const room = rooms.get(cleanPin);

    if (!room) {
      const err = 'Room not found.';
      if (typeof callback === 'function') callback({ success: false, message: err });
      return;
    }

    if (room.state !== 'QUESTION') {
      const err = 'Round is not active or time has expired!';
      if (typeof callback === 'function') callback({ success: false, message: err });
      return;
    }

    const player = room.players.get(socket.id);
    if (!player) {
      const err = 'Player not registered in room.';
      if (typeof callback === 'function') callback({ success: false, message: err });
      return;
    }

    if (player.answeredThisRound) {
      const err = 'You have already submitted an answer for this question!';
      if (typeof callback === 'function') callback({ success: false, message: err });
      return;
    }

    const serverTimeTakenMs = Date.now() - room.questionStartTime;
    const currentQ = room.questions[room.currentQuestionIndex];
    const totalTimeLimitMs = (currentQ.timeLimitSeconds || 15) * 1000;

    if (serverTimeTakenMs > totalTimeLimitMs + 500) {
      const err = 'Submission rejected: Time limit expired!';
      if (typeof callback === 'function') callback({ success: false, message: err });
      socket.emit('answer:rejected', { message: err });
      return;
    }

    const isCorrect = selectedOption === currentQ.correctOption;
    const scoreEarned = calculateScore(isCorrect, serverTimeTakenMs, totalTimeLimitMs);

    player.score += scoreEarned;
    player.lastScoreAdded = scoreEarned;
    player.answeredThisRound = true;

    room.roundAnswers.set(socket.id, {
      optionIndex: selectedOption,
      timeTakenMs: serverTimeTakenMs,
      scoreEarned,
      isCorrect
    });

    console.log(`[ANSWER] Player ${player.name} selected option ${selectedOption} in ${serverTimeTakenMs}ms -> Correct: ${isCorrect}, Score: +${scoreEarned}`);

    const confirmPayload = {
      success: true,
      selectedOption,
      message: 'Answer received! Waiting for time up...'
    };
    if (typeof callback === 'function') callback(confirmPayload);
    socket.emit('answer:confirmed', confirmPayload);

    io.to(room.roomId).emit('answer:progress', {
      answeredCount: room.roundAnswers.size,
      totalPlayers: room.players.size
    });

    if (room.roundAnswers.size >= room.players.size) {
      console.log(`[GAME ENGINE] All ${room.players.size} players answered early. Ending round.`);
      endQuestionRound(io, room);
    }
  });

  socket.on('quiz:next_question', (payload = {}) => {
    const { pin } = payload;
    const room = rooms.get(pin ? pin.toString().trim() : '');
    if (room && room.hostSocketId === socket.id && room.state === 'TIME_UP') {
      advanceToNextQuestionOrEnd(io, room);
    }
  });

  socket.on('disconnect', () => {
    for (const [pin, room] of rooms.entries()) {
      if (room.players.has(socket.id)) {
        const player = room.players.get(socket.id);
        console.log(`[LOBBY] Player ${player.name} disconnected from room ${pin}`);
        room.players.delete(socket.id);
        room.roundAnswers.delete(socket.id);

        const playerList = Array.from(room.players.values()).map(p => ({
          name: p.name,
          score: p.score
        }));
        io.to(room.roomId).emit('lobby:update', {
          players: playerList,
          totalPlayers: playerList.length
        });

        if (room.players.size === 0 && room.hostSocketId === socket.id) {
          if (room.roundTimer) clearTimeout(room.roundTimer);
          if (room.autoNextTimer) clearTimeout(room.autoNextTimer);
          rooms.delete(pin);
        }
      } else if (room.hostSocketId === socket.id) {
        console.log(`[LOBBY] Host left room ${pin}`);
        io.to(room.roomId).emit('quiz:ended', {
          winner: { name: 'Game Closed (Host Left)', score: 0 },
          finalRanks: []
        });
        if (room.roundTimer) clearTimeout(room.roundTimer);
        if (room.autoNextTimer) clearTimeout(room.autoNextTimer);
        rooms.delete(pin);
      }
    }
  });
}

module.exports = {
  calculateScore,
  initGameEngineHandlers
};
