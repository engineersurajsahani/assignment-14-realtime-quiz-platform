// Real-Time Multiplayer Quiz Platform - Client Controllers

let socket = null;
let currentPin = null;
let questionStartTime = 0;

function getSocket() {
  if (!socket) {
    socket = io();
  }
  return socket;
}

// ==========================================
// 1. HOST CONTROLLER
// ==========================================
function initHostApp() {
  const sk = getSocket();

  // Elements
  const formCreate = document.getElementById('form-create-game');
  const hostPinDisplay = document.getElementById('host-pin-display');
  const pinVal = document.getElementById('pin-val');
  const lobbyBigPin = document.getElementById('lobby-big-pin');
  const lobbyCount = document.getElementById('lobby-count');
  const lobbyPlayersGrid = document.getElementById('lobby-players-grid');
  const btnStartGame = document.getElementById('btn-start-game');

  // Views
  const viewCreate = document.getElementById('view-create');
  const viewLobby = document.getElementById('view-lobby');
  const viewQuestion = document.getElementById('view-question');
  const viewReveal = document.getElementById('view-reveal');
  const viewLeaderboard = document.getElementById('view-leaderboard');
  const viewWinner = document.getElementById('view-winner');

  function showHostView(viewToShow) {
    [viewCreate, viewLobby, viewQuestion, viewReveal, viewLeaderboard, viewWinner].forEach(v => {
      if (v) v.classList.add('hidden');
    });
    if (viewToShow) viewToShow.classList.remove('hidden');
  }

  // 1. Host Creates Game
  formCreate.addEventListener('submit', (e) => {
    e.preventDefault();
    const hostName = document.getElementById('host-name').value;
    const category = document.getElementById('host-category').value;
    sk.emit('quiz:create', { hostName, category });
  });

  sk.on('quiz:created', ({ pin }) => {
    currentPin = pin;
    pinVal.textContent = pin;
    lobbyBigPin.textContent = pin;
    showHostView(viewLobby);
  });

  // 2. Lobby Roster Update
  sk.on('lobby:update', ({ players, totalPlayers }) => {
    lobbyCount.textContent = totalPlayers;
    lobbyPlayersGrid.innerHTML = '';
    players.forEach(p => {
      const chip = document.createElement('div');
      chip.className = 'player-chip';
      chip.textContent = p.name;
      lobbyPlayersGrid.appendChild(chip);
    });
  });

  // 3. Start Game Button
  btnStartGame.addEventListener('click', () => {
    sk.emit('quiz:start', { pin: currentPin });
  });

  // 4. Question Start
  sk.on('question:start', (data) => {
    showHostView(viewQuestion);
    document.getElementById('host-q-index').textContent = `Question ${data.questionIndex} / ${data.totalQuestions}`;
    document.getElementById('host-q-text').textContent = data.question;
    document.getElementById('host-timer').textContent = data.timeLimitSeconds;
    document.getElementById('host-answered-count').textContent = '0 answered';

    // Reset option styling
    data.options.forEach((opt, idx) => {
      const optEl = document.getElementById(`host-opt-${idx}`);
      if (optEl) {
        optEl.querySelector('.opt-text').textContent = opt;
        optEl.style.opacity = '1';
        optEl.style.transform = 'none';
      }
    });
  });

  // 5. Timer Tick
  sk.on('timer:tick', ({ timeRemaining }) => {
    const timerEl = document.getElementById('host-timer');
    if (timerEl) {
      timerEl.textContent = timeRemaining;
      if (timeRemaining <= 5) {
        timerEl.style.borderColor = '#ef4444';
      } else {
        timerEl.style.borderColor = '#6366f1';
      }
    }
  });

  // 6. Player Answered Counter Update
  sk.on('player:answered', ({ totalAnswered, totalPlayers }) => {
    const answeredBadge = document.getElementById('host-answered-count');
    if (answeredBadge) {
      answeredBadge.textContent = `${totalAnswered} / ${totalPlayers} answered`;
    }
  });

  // 7. Time Up & Reveal
  sk.on('question:time_up', ({ correctOption, correctAnswerText, explanation }) => {
    showHostView(viewReveal);
    document.getElementById('reveal-correct-text').textContent = `${correctAnswerText}`;
    document.getElementById('reveal-explanation').textContent = explanation;
  });

  // 8. Leaderboard Update
  sk.on('leaderboard:update', ({ leaderboard }) => {
    // Show leaderboard briefly before next question
    setTimeout(() => {
      showHostView(viewLeaderboard);
      const tbody = document.getElementById('leaderboard-body');
      tbody.innerHTML = '';
      leaderboard.forEach(p => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>#${p.rank}</td>
          <td>${p.name}</td>
          <td>${p.score.toLocaleString()} pts</td>
        `;
        tbody.appendChild(row);
      });
    }, 1500);
  });

  // 9. Quiz Ended
  sk.on('quiz:ended', ({ winner, finalRanks }) => {
    showHostView(viewWinner);
    document.getElementById('winner-name').textContent = winner.name;
    document.getElementById('winner-score').textContent = `${(winner.score || 0).toLocaleString()} Points`;
  });

  // Errors
  sk.on('quiz:error', ({ message }) => {
    alert(`Quiz Error: ${message}`);
  });
}

// ==========================================
// 2. PLAYER GAMEPAD CONTROLLER
// ==========================================
function initPlayerApp() {
  const sk = getSocket();

  // Elements
  const formJoin = document.getElementById('form-player-join');
  const playerHandleDisplay = document.getElementById('player-handle-display');
  const playerScoreVal = document.getElementById('player-score-val');

  // Views
  const pViewJoin = document.getElementById('player-view-join');
  const pViewLobby = document.getElementById('player-view-lobby');
  const pViewGamepad = document.getElementById('player-view-gamepad');
  const pViewSubmitted = document.getElementById('player-view-submitted');
  const pViewResult = document.getElementById('player-view-result');
  const pViewEnd = document.getElementById('player-view-end');

  let myPin = '';
  let myScore = 0;
  let currentQNum = 1;

  function showPlayerView(viewToShow) {
    [pViewJoin, pViewLobby, pViewGamepad, pViewSubmitted, pViewResult, pViewEnd].forEach(v => {
      if (v) v.classList.add('hidden');
    });
    if (viewToShow) viewToShow.classList.remove('hidden');
  }

  // 1. Join Quiz Lobby
  formJoin.addEventListener('submit', (e) => {
    e.preventDefault();
    myPin = document.getElementById('input-pin').value.trim();
    const playerName = document.getElementById('input-player-name').value.trim();

    sk.emit('quiz:join', { pin: myPin, playerName });
  });

  sk.on('quiz:joined', ({ pin, playerName }) => {
    playerHandleDisplay.textContent = playerName;
    showPlayerView(pViewLobby);
  });

  // 2. Question Round Starts
  sk.on('question:start', (data) => {
    showPlayerView(pViewGamepad);
    questionStartTime = Date.now();
    currentQNum = data.questionIndex;
    document.getElementById('player-q-num').textContent = `Q ${data.questionIndex}`;
    document.getElementById('player-timer-val').textContent = data.timeLimitSeconds;

    // Set button labels
    data.options.forEach((opt, idx) => {
      const btnText = document.getElementById(`btn-text-${idx}`);
      if (btnText) btnText.textContent = opt;
      const btn = document.getElementById(`btn-opt-${idx}`);
      if (btn) btn.disabled = false;
    });
  });

  // 3. Timer Tick
  sk.on('timer:tick', ({ timeRemaining }) => {
    const timerVal = document.getElementById('player-timer-val');
    if (timerVal) timerVal.textContent = timeRemaining;
  });

  // 4. Submit Answer on Button Press
  [0, 1, 2, 3].forEach(idx => {
    const btn = document.getElementById(`btn-opt-${idx}`);
    if (btn) {
      btn.addEventListener('click', () => {
        const timeTakenMs = Date.now() - questionStartTime;
        // Disable all buttons
        [0, 1, 2, 3].forEach(i => {
          const b = document.getElementById(`btn-opt-${i}`);
          if (b) b.disabled = true;
        });

        sk.emit('answer:submit', {
          pin: myPin,
          selectedOption: idx,
          timeTakenMs
        });

        showPlayerView(pViewSubmitted);
      });
    }
  });

  // 5. Answer Result Received
  sk.on('answer:result', ({ isCorrect, pointsAwarded, totalScore }) => {
    myScore = totalScore;
    playerScoreVal.textContent = myScore.toLocaleString();

    const icon = document.getElementById('result-icon');
    const title = document.getElementById('result-title');
    const points = document.getElementById('result-points');
    const total = document.getElementById('result-total');
    const card = document.getElementById('result-feedback-card');

    if (isCorrect) {
      icon.textContent = '🎉';
      title.textContent = 'Correct!';
      title.style.color = '#10b981';
      points.textContent = `+${pointsAwarded} Points`;
      card.style.borderColor = '#10b981';
    } else {
      icon.textContent = '❌';
      title.textContent = 'Incorrect!';
      title.style.color = '#ef4444';
      points.textContent = '+0 Points';
      card.style.borderColor = '#ef4444';
    }

    total.textContent = `Total Score: ${myScore.toLocaleString()} pts`;
  });

  // 6. Question Time Up -> Show round result
  sk.on('question:time_up', () => {
    showPlayerView(pViewResult);
  });

  // 7. Quiz Ended
  sk.on('quiz:ended', ({ winner }) => {
    showPlayerView(pViewEnd);
    document.getElementById('player-final-score').textContent = `Final Score: ${myScore.toLocaleString()} Points`;
  });

  // Error feedback
  sk.on('quiz:error', ({ message }) => {
    alert(`Error: ${message}`);
  });
}
