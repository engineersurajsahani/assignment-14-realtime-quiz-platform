const TOTAL_TIME_LIMIT_MS = 15000;
const BASE_SCORE = 500;
const MAX_SPEED_BONUS = 500;

function calculateScore(isCorrect, timeTakenMs, totalTimeLimitMs = TOTAL_TIME_LIMIT_MS) {
  if (!isCorrect) return 0;
  const safeTime = Math.max(0, Math.min(timeTakenMs, totalTimeLimitMs));
  const timeRemaining = Math.max(0, totalTimeLimitMs - safeTime);
  const speedBonus = Math.round((timeRemaining / totalTimeLimitMs) * MAX_SPEED_BONUS);
  return BASE_SCORE + speedBonus;
}

function leaderboard(room) {
  return [...room.players.values()]
    .sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt)
    .map((player, index) => ({
      rank: index + 1,
      name: player.name,
      score: player.score,
      socketId: player.socketId
    }));
}

function publicQuestion(question, index, total) {
  return {
    questionIndex: index + 1,
    totalQuestions: total,
    question: question.question,
    options: question.options,
    timeLimitSeconds: TOTAL_TIME_LIMIT_MS / 1000,
    startedAt: Date.now()
  };
}

function clearRoomTimer(room) {
  if (room.questionTimer) {
    clearTimeout(room.questionTimer);
    room.questionTimer = null;
  }
}

module.exports = {
  TOTAL_TIME_LIMIT_MS,
  calculateScore,
  leaderboard,
  publicQuestion,
  clearRoomTimer
};
