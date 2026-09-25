document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // Detect current page view
  const isHostPage = !!document.getElementById('section-create');
  const isPlayerPage = !!document.getElementById('section-join');

  let currentPin = null;
  let currentPlayerName = null;
  let currentQuestionOptions = [];
  let answerSubmitted = false;

  // ==========================================
  // HOST PAGE LOGIC
  // ==========================================
  if (isHostPage) {
    const sectionCreate = document.getElementById('section-create');
    const sectionLobby = document.getElementById('section-lobby');
    const sectionQuestion = document.getElementById('section-question');
    const sectionLeaderboard = document.getElementById('section-leaderboard');
    const sectionFinal = document.getElementById('section-final');

    const btnCreateQuiz = document.getElementById('btn-create-quiz');
    const btnStartGame = document.getElementById('btn-start-game');
    const btnNextQuestion = document.getElementById('btn-next-question');

    const displayPin = document.getElementById('display-pin');
    const playerCount = document.getElementById('player-count');
    const lobbyPlayersList = document.getElementById('lobby-players-list');

    const questionProgress = document.getElementById('question-progress');
    const answersProgress = document.getElementById('answers-progress');
    const timerDisplay = document.getElementById('timer-display');
    const questionText = document.getElementById('question-text');
    const revealPanel = document.getElementById('reveal-panel');
    const explanationText = document.getElementById('explanation-text');
    const hostControls = document.getElementById('host-controls');

    const leaderboardList = document.getElementById('leaderboard-list');
    const winnerName = document.getElementById('winner-name');
    const winnerScore = document.getElementById('winner-score');
    const finalRanksList = document.getElementById('final-ranks-list');

    // Create Quiz Handler
    btnCreateQuiz.addEventListener('click', () => {
      const hostName = document.getElementById('input-host-name').value.trim();
      const category = document.getElementById('input-category').value.trim();

      socket.emit('quiz:create', { hostName, category });
    });

    // Quiz Created Callback
    socket.on('quiz:created', (data) => {
      currentPin = data.pin;
      displayPin.textContent = currentPin;

      sectionCreate.classList.add('d-none');
      sectionLobby.classList.remove('d-none');
    });

    // Lobby Update Callback
    socket.on('lobby:update', (data) => {
      const players = data.players || [];
      playerCount.textContent = players.length;

      if (players.length > 0) {
        btnStartGame.removeAttribute('disabled');
        lobbyPlayersList.innerHTML = players
          .map(
            p => `<div class="player-chip"><i class="fa-solid fa-user text-info"></i> ${escapeHtml(p.name)}</div>`
          )
          .join('');
      } else {
        btnStartGame.setAttribute('disabled', 'true');
        lobbyPlayersList.innerHTML = '<div class="text-muted fst-italic">Waiting for players to join...</div>';
      }
    });

    // Start Game Handler
    btnStartGame.addEventListener('click', () => {
      if (!currentPin) return;
      socket.emit('quiz:start', { pin: currentPin });
    });

    // Question Start Callback
    socket.on('question:start', (data) => {
      sectionLobby.classList.add('d-none');
      sectionLeaderboard.classList.add('d-none');
      sectionQuestion.classList.remove('d-none');
      revealPanel.classList.add('d-none');
      hostControls.classList.add('d-none');

      questionProgress.textContent = `Question ${data.questionIndex} of ${data.totalQuestions}`;
      answersProgress.textContent = `Answers: 0 / ${playerCount.textContent}`;
      questionText.textContent = data.question;

      // Render options
      currentQuestionOptions = data.options || [];
      currentQuestionOptions.forEach((opt, idx) => {
        const el = document.getElementById(`opt-${idx}`);
        if (el) {
          el.className = `option-card option-${idx}`;
          const textSpan = el.querySelector('.opt-text');
          if (textSpan) textSpan.textContent = opt;
        }
      });
    });

    // Timer Tick Callback
    socket.on('timer:tick', (data) => {
      timerDisplay.textContent = data.timeLeft;
      if (data.timeLeft <= 5) {
        timerDisplay.classList.add('timer-warning');
      } else {
        timerDisplay.classList.remove('timer-warning');
      }
    });

    // Answer Progress Callback
    socket.on('answer:progress', (data) => {
      answersProgress.textContent = `Answers: ${data.answeredCount} / ${data.totalPlayers}`;
    });

    // Time Up / Reveal Callback
    socket.on('question:time_up', (data) => {
      revealPanel.classList.remove('d-none');
      explanationText.textContent = data.explanation || 'Round Completed!';
      hostControls.classList.remove('d-none');

      // Highlight correct option
      currentQuestionOptions.forEach((_, idx) => {
        const el = document.getElementById(`opt-${idx}`);
        if (el) {
          if (idx === data.correctOption) {
            el.classList.add('option-correct');
          } else {
            el.classList.add('option-dimmed');
          }
        }
      });
    });

    // Next Question Click Handler
    btnNextQuestion.addEventListener('click', () => {
      if (!currentPin) return;
      socket.emit('question:next', { pin: currentPin });
    });

    // Leaderboard Update Callback
    socket.on('leaderboard:update', (data) => {
      const ranks = data.leaderboard || [];
      leaderboardList.innerHTML = ranks
        .map(p => {
          let rankClass = '';
          if (p.rank === 1) rankClass = 'rank-1';
          else if (p.rank === 2) rankClass = 'rank-2';
          else if (p.rank === 3) rankClass = 'rank-3';

          return `
            <div class="leaderboard-item">
              <div class="d-flex align-items-center gap-3">
                <div class="rank-badge ${rankClass}">#${p.rank}</div>
                <div>${escapeHtml(p.name)}</div>
              </div>
              <div class="text-warning">${p.score} pts</div>
            </div>
          `;
        })
        .join('');
    });

    // Quiz Ended Callback
    socket.on('quiz:ended', (data) => {
      sectionQuestion.classList.add('d-none');
      sectionLeaderboard.classList.add('d-none');
      sectionFinal.classList.remove('d-none');

      const winner = data.winner || { name: 'N/A', score: 0 };
      winnerName.textContent = winner.name;
      winnerScore.textContent = winner.score;

      const finalRanks = data.finalRanks || [];
      finalRanksList.innerHTML = finalRanks
        .map(
          p => `<div class="d-flex justify-content-between py-2 border-bottom border-secondary">
                  <span>#${p.rank} ${escapeHtml(p.name)}</span>
                  <span class="text-warning fw-bold">${p.score} pts</span>
                </div>`
        )
        .join('');
    });

    // Error handler
    socket.on('quiz:error', (data) => {
      alert(data.message || 'An error occurred.');
    });
  }

  // ==========================================
  // PLAYER PAGE LOGIC
  // ==========================================
  if (isPlayerPage) {
    const sectionJoin = document.getElementById('section-join');
    const sectionWaiting = document.getElementById('section-waiting');
    const sectionGamepad = document.getElementById('section-gamepad');
    const sectionFinal = document.getElementById('section-final');

    const btnJoin = document.getElementById('btn-join');
    const inputPin = document.getElementById('input-pin');
    const inputPlayerName = document.getElementById('input-player-name');
    const joinError = document.getElementById('join-error');
    const playerDisplayName = document.getElementById('player-display-name');

    const playerQuestionNum = document.getElementById('player-question-num');
    const playerTimer = document.getElementById('player-timer');
    const playerQuestionText = document.getElementById('player-question-text');
    const playerAnswerGrid = document.getElementById('player-answer-grid');
    const playerFeedback = document.getElementById('player-feedback');
    const feedbackAlert = document.getElementById('feedback-alert');

    const playerFinalRank = document.getElementById('player-final-rank');
    const playerFinalScore = document.getElementById('player-final-score');

    // Join Arena Handler
    btnJoin.addEventListener('click', () => {
      const pin = inputPin.value.trim();
      const playerName = inputPlayerName.value.trim();

      if (!pin || pin.length !== 4) {
        showJoinError('Please enter a valid 4-digit PIN.');
        return;
      }
      if (!playerName) {
        showJoinError('Please enter your nickname.');
        return;
      }

      currentPin = pin;
      currentPlayerName = playerName;

      socket.emit('quiz:join', { pin, playerName });
    });

    function showJoinError(msg) {
      joinError.textContent = msg;
      joinError.classList.remove('d-none');
    }

    // Joined Callback
    socket.on('quiz:joined', (data) => {
      joinError.classList.add('d-none');
      playerDisplayName.textContent = data.playerName;
      sectionJoin.classList.add('d-none');
      sectionWaiting.classList.remove('d-none');
    });

    // Question Start Callback
    socket.on('question:start', (data) => {
      answerSubmitted = false;
      sectionWaiting.classList.add('d-none');
      sectionGamepad.classList.remove('d-none');
      playerFeedback.classList.add('d-none');

      playerQuestionNum.textContent = `Q ${data.questionIndex}/${data.totalQuestions}`;
      playerQuestionText.textContent = data.question;
      playerTimer.textContent = `${data.timeLimitSeconds}s`;

      // Reset & enable answer buttons
      const buttons = playerAnswerGrid.querySelectorAll('.btn-answer');
      buttons.forEach((btn, idx) => {
        btn.removeAttribute('disabled');
        const optText = data.options ? data.options[idx] : `Option ${idx + 1}`;
        const labelEl = btn.querySelector('.opt-label');
        if (labelEl) labelEl.textContent = optText;
      });
    });

    // Timer Tick Callback
    socket.on('timer:tick', (data) => {
      playerTimer.textContent = `${data.timeLeft}s`;
    });

    // Answer Button Click Handler
    playerAnswerGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-answer');
      if (!btn || answerSubmitted) return;

      const selectedOption = parseInt(btn.getAttribute('data-opt'), 10);
      answerSubmitted = true;

      // Disable all buttons
      const buttons = playerAnswerGrid.querySelectorAll('.btn-answer');
      buttons.forEach(b => b.setAttribute('disabled', 'true'));

      // Show temporary submitted state
      playerFeedback.classList.remove('d-none');
      feedbackAlert.className = 'alert alert-info p-3 mb-0 fw-bold fs-5';
      feedbackAlert.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Answer Submitted! Waiting for timer...';

      socket.emit('answer:submit', {
        pin: currentPin,
        selectedOption
      });
    });

    // Answer Ack Callback
    socket.on('answer:ack', (data) => {
      playerFeedback.classList.remove('d-none');
      if (data.isCorrect) {
        feedbackAlert.className = 'alert alert-success p-3 mb-0 fw-bold fs-5';
        feedbackAlert.innerHTML = `<i class="fa-solid fa-circle-check me-2"></i>Correct! +${data.scoreEarned} pts<br><small class="fs-6">Total Score: ${data.totalScore}</small>`;
      } else {
        feedbackAlert.className = 'alert alert-danger p-3 mb-0 fw-bold fs-5';
        feedbackAlert.innerHTML = `<i class="fa-solid fa-circle-xmark me-2"></i>Incorrect! +0 pts<br><small class="fs-6">Total Score: ${data.totalScore}</small>`;
      }
    });

    // Answer Rejected Callback
    socket.on('answer:rejected', (data) => {
      playerFeedback.classList.remove('d-none');
      feedbackAlert.className = 'alert alert-warning p-3 mb-0 fw-bold fs-5';
      feedbackAlert.innerHTML = `<i class="fa-solid fa-triangle-exclamation me-2"></i>${data.message || 'Submission rejected.'}`;
    });

    // Time Up Callback
    socket.on('question:time_up', () => {
      // Disable buttons if not already disabled
      const buttons = playerAnswerGrid.querySelectorAll('.btn-answer');
      buttons.forEach(b => b.setAttribute('disabled', 'true'));

      if (!answerSubmitted) {
        playerFeedback.classList.remove('d-none');
        feedbackAlert.className = 'alert alert-warning p-3 mb-0 fw-bold fs-5';
        feedbackAlert.innerHTML = `<i class="fa-solid fa-hourglass-end me-2"></i>Time Expired! No answer submitted.`;
      }
    });

    // Quiz Ended Callback
    socket.on('quiz:ended', (data) => {
      sectionGamepad.classList.add('d-none');
      sectionWaiting.classList.add('d-none');
      sectionFinal.classList.remove('d-none');

      const finalRanks = data.finalRanks || [];
      const myRankObj = finalRanks.find(r => r.name.toLowerCase() === (currentPlayerName || '').toLowerCase());

      if (myRankObj) {
        playerFinalRank.textContent = `Your Rank: #${myRankObj.rank}`;
        playerFinalScore.textContent = `Score: ${myRankObj.score} pts`;
      } else {
        playerFinalRank.textContent = 'Quiz Complete';
        playerFinalScore.textContent = '';
      }
    });

    // Error Handler
    socket.on('quiz:error', (data) => {
      showJoinError(data.message || 'Error occurred.');
    });
  }

  // Utility HTML Escape
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
