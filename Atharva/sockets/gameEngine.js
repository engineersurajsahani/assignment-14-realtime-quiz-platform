const questions = require("../data/questions.json");

const TIME_LIMIT = 15000;
const REVEAL_DELAY = 3000;

function publicPlayers(room) {
  return [...room.players]
    .sort((a, b) => b.score - a.score)
    .map((player) => ({
      name: player.name,
      score: player.score
    }));
}

function calculateScore(isCorrect, timeTakenMs) {
  if (!isCorrect) return 0;

  const safeTime = Math.max(0, Math.min(TIME_LIMIT, timeTakenMs));
  const timeRemaining = Math.max(0, TIME_LIMIT - safeTime);
  const speedBonus = Math.round((timeRemaining / TIME_LIMIT) * 500);

  return 500 + speedBonus;
}

function emitLeaderboard(io, room) {
  io.to(room.pin).emit("leaderboard:update", {
    players: publicPlayers(room)
  });
}

function endQuiz(io, room) {
  room.gameStarted = false;
  room.questionActive = false;
  room.questionStartedAt = null;

  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }

  const leaderboard = publicPlayers(room);

  io.to(room.pin).emit("leaderboard:update", {
    players: leaderboard
  });

  io.to(room.pin).emit("quiz:ended", {
    leaderboard
  });

  console.log(`Quiz ${room.pin} ended.`);
}

function endQuestion(io, room) {
  if (!room.questionActive) return;

  room.questionActive = false;

  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }

  const current = questions[room.currentQuestion];

  if (!current) {
    endQuiz(io, room);
    return;
  }

  io.to(room.pin).emit("question:time_up", {
    correctOption: current.correctOption,
    explanation: current.explanation
  });

  emitLeaderboard(io, room);

  room.currentQuestion += 1;

  if (room.currentQuestion >= questions.length) {
    setTimeout(() => endQuiz(io, room), REVEAL_DELAY);
    return;
  }

  setTimeout(() => {
    if (room.gameStarted) {
      startQuestion(io, room);
    }
  }, REVEAL_DELAY);
}

function startQuestion(io, room) {
  const current = questions[room.currentQuestion];

  if (!current) {
    endQuiz(io, room);
    return;
  }

  room.questionActive = true;
  room.questionStartedAt = Date.now();

  room.players.forEach((player) => {
    player.answered = false;
  });

  io.to(room.pin).emit("question:start", {
    questionIndex: room.currentQuestion,
    totalQuestions: questions.length,
    question: current.question,
    options: current.options,
    timeLimit: TIME_LIMIT
  });

  room.timer = setTimeout(() => {
    endQuestion(io, room);
  }, TIME_LIMIT);
}

module.exports = function gameEngine(io, socket, rooms) {
  socket.on("quiz:start", (payload = {}) => {
    const pin = String(payload.pin || "").trim();
    const room = rooms[pin];

    if (!room) {
      socket.emit("quiz:error", {
        message: "Quiz room not found."
      });
      return;
    }

    if (socket.id !== room.hostId) {
      socket.emit("quiz:error", {
        message: "Only the host can start the quiz."
      });
      return;
    }

    if (room.gameStarted) {
      socket.emit("quiz:error", {
        message: "Quiz has already started."
      });
      return;
    }

    if (room.players.length === 0) {
      socket.emit("quiz:error", {
        message: "At least one player is required."
      });
      return;
    }

    room.gameStarted = true;
    room.currentQuestion = 0;

    io.to(pin).emit("quiz:started");

    startQuestion(io, room);

    console.log(`Quiz ${pin} started.`);
  });

  socket.on("answer:submit", (payload = {}) => {
    const pin = String(payload.pin || "").trim();
    const selectedOption = Number(payload.selectedOption);
    const room = rooms[pin];

    if (!room) {
      socket.emit("answer:result", {
        success: false,
        message: "Quiz room not found."
      });
      return;
    }

    if (!room.gameStarted || !room.questionActive) {
      socket.emit("answer:result", {
        success: false,
        message: "There is no active question."
      });
      return;
    }

    const player = room.players.find(
      (item) => item.id === socket.id
    );

    if (!player) {
      socket.emit("answer:result", {
        success: false,
        message: "You are not a player in this quiz."
      });
      return;
    }

    if (player.answered) {
      socket.emit("answer:result", {
        success: false,
        message: "You have already answered this question."
      });
      return;
    }

    const elapsed = Date.now() - room.questionStartedAt;

    if (elapsed > TIME_LIMIT) {
      socket.emit("answer:result", {
        success: false,
        message: "Time is up."
      });

      endQuestion(io, room);
      return;
    }

    const current = questions[room.currentQuestion];

    if (!current) {
      socket.emit("answer:result", {
        success: false,
        message: "Question not found."
      });
      return;
    }

    const isCorrect =
      selectedOption === current.correctOption;

    const score = calculateScore(isCorrect, elapsed);

    player.score += score;
    player.answered = true;

    socket.emit("answer:result", {
      success: true,
      correct: isCorrect,
      score,
      totalScore: player.score
    });

    emitLeaderboard(io, room);

    const allAnswered =
      room.players.length > 0 &&
      room.players.every((item) => item.answered);

    if (allAnswered) {
      endQuestion(io, room);
    }
  });
};
