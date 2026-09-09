const TOTAL_TIME_MS = 15000;

function calculateScore(isCorrect, timeTakenMs, totalTimeLimitMs = TOTAL_TIME_MS) {
  if (!isCorrect) return 0;
  const safeTime = Math.min(Math.max(Number(timeTakenMs) || 0, 0), totalTimeLimitMs);
  const timeRemaining = Math.max(0, totalTimeLimitMs - safeTime);
  const speedBonus = Math.round((timeRemaining / totalTimeLimitMs) * 500);
  return 500 + speedBonus;
}

function publicQuestion(room) {
  const q = room.questions[room.currentIndex];
  return {
    questionIndex: room.currentIndex + 1,
    totalQuestions: room.questions.length,
    question: q.question,
    options: q.options,
    timeLimitSeconds: TOTAL_TIME_MS / 1000,
    startedAt: room.questionStartedAt
  };
}

function getLeaderboard(room) {
  return [...room.players.values()]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map((player, index) => ({ rank: index + 1, name: player.name, score: player.score }));
}

function clearRoomTimer(room) {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
}

function startQuestion(io, room) {
  clearRoomTimer(room);
  room.currentIndex += 1;
  room.answered.clear();

  if (room.currentIndex >= room.questions.length) {
    endQuiz(io, room);
    return;
  }

  room.questionStartedAt = Date.now();
  io.to(room.roomId).emit('question:start', publicQuestion(room));

  room.timer = setTimeout(() => finishQuestion(io, room), TOTAL_TIME_MS);
}

function finishQuestion(io, room) {
  if (room.ended || room.currentIndex < 0) return;
  clearRoomTimer(room);
  const q = room.questions[room.currentIndex];

  io.to(room.roomId).emit('question:time_up', {
    correctOption: q.correctOption,
    explanation: q.explanation
  });

  io.to(room.roomId).emit('leaderboard:update', { leaderboard: getLeaderboard(room) });

  setTimeout(() => {
    if (!room.ended) startQuestion(io, room);
  }, 2500);
}

function endQuiz(io, room) {
  clearRoomTimer(room);
  room.ended = true;
  room.started = false;
  const finalRanks = getLeaderboard(room);
  const winner = finalRanks[0] || { name: 'No players', score: 0 };
  io.to(room.roomId).emit('quiz:ended', { winner, finalRanks });
}

function registerGameHandlers(io, socket, rooms) {
  socket.on('quiz:start', ({ pin }) => {
    const room = rooms.get(String(pin || '').trim());
    if (!room || room.hostSocketId !== socket.id) {
      socket.emit('quiz:error', { message: 'Only the quiz host can start this quiz.' });
      return;
    }
    if (room.started || room.ended) return;
    if (room.players.size === 0) {
      socket.emit('quiz:error', { message: 'At least one player must join before starting.' });
      return;
    }

    room.started = true;
    startQuestion(io, room);
  });

  socket.on('answer:submit', ({ pin, selectedOption, timeTakenMs }) => {
    const room = rooms.get(String(pin || '').trim());
    if (!room || !room.started || room.ended || room.currentIndex < 0) {
      socket.emit('answer:result', { accepted: false, message: 'No active question.' });
      return;
    }
    if (!room.players.has(socket.id)) {
      socket.emit('answer:result', { accepted: false, message: 'You are not a player in this quiz.' });
      return;
    }
    if (room.answered.has(socket.id)) {
      socket.emit('answer:result', { accepted: false, message: 'You already answered this question.' });
      return;
    }

    const serverElapsed = Date.now() - room.questionStartedAt;
    if (serverElapsed >= TOTAL_TIME_MS) {
      socket.emit('answer:result', { accepted: false, message: 'Time is up. Your answer was rejected.' });
      return;
    }

    const option = Number(selectedOption);
    if (!Number.isInteger(option) || option < 0 || option >= room.questions[room.currentIndex].options.length) {
      socket.emit('answer:result', { accepted: false, message: 'Invalid answer option.' });
      return;
    }

    room.answered.add(socket.id);
    const q = room.questions[room.currentIndex];
    const isCorrect = option === q.correctOption;
    const score = calculateScore(isCorrect, serverElapsed);
    const player = room.players.get(socket.id);
    player.score += score;

    socket.emit('answer:result', {
      accepted: true,
      isCorrect,
      scoreAwarded: score,
      timeTakenMs: serverElapsed
    });
  });
}

module.exports = { registerGameHandlers, calculateScore, getLeaderboard, TOTAL_TIME_MS, clearRoomTimer };
