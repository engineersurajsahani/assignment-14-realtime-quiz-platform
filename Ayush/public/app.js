

const QuizApp = {
  formatSeconds(sec) {
    return String(Math.max(0, Math.floor(sec)));
  },
  sortLeaderboard(players) {
    return [...players]
      .sort((a, b) => b.score - a.score)
      .map((p, idx) => ({ rank: idx + 1, name: p.name, score: p.score }));
  },
};
