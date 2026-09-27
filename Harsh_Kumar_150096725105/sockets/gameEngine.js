const { games, calculateScore } = require('./gameStore');
const questions = require('../data/questions.json');

module.exports = (io, socket) => {
  socket.on('quiz:start', ({ pin }) => {
    const roomId = `quiz_${pin}`;
    const game = games[roomId];

    if (game && game.hostId === socket.id) {
      game.state = 'playing';
      game.currentQuestionIndex = 0;
      sendQuestion(io, roomId);
    }
  });

  socket.on('answer:submit', ({ pin, selectedOption }) => {
    const roomId = `quiz_${pin}`;
    const game = games[roomId];
    if (!game || game.state !== 'playing') return;

    const player = game.players[socket.id];
    if (!player || player.hasAnswered) return;

    const timeTakenMs = Date.now() - game.startTime;
    if (timeTakenMs > 15000) return; // Expired

    player.hasAnswered = true;
    const currentQ = questions[game.currentQuestionIndex];
    const isCorrect = currentQ.correctOption === selectedOption;
    
    player.score += calculateScore(isCorrect, timeTakenMs, 15000);
  });

  function sendQuestion(io, roomId) {
    const game = games[roomId];
    const currentQ = questions[game.currentQuestionIndex];
    
    // Reset players answers
    Object.values(game.players).forEach(p => p.hasAnswered = false);

    game.startTime = Date.now();
    io.to(roomId).emit('question:start', {
      questionIndex: game.currentQuestionIndex + 1,
      totalQuestions: questions.length,
      question: currentQ.question,
      options: currentQ.options,
      timeLimitSeconds: 15
    });

    game.timer = setTimeout(() => {
      io.to(roomId).emit('question:time_up', {
        correctOption: currentQ.correctOption,
        explanation: currentQ.explanation
      });

      const leaderboard = Object.values(game.players)
        .sort((a, b) => b.score - a.score)
        .map((p, i) => ({ rank: i + 1, name: p.name, score: p.score }));
        
      io.to(roomId).emit('leaderboard:update', { leaderboard });

      setTimeout(() => {
        game.currentQuestionIndex++;
        if (game.currentQuestionIndex < questions.length) {
          sendQuestion(io, roomId);
        } else {
          game.state = 'ended';
          io.to(roomId).emit('quiz:ended', {
            winner: leaderboard[0],
            finalRanks: leaderboard
          });
        }
      }, 5000); // Wait 5 seconds before next question
    }, 15000);
  }
};
