// ==========================================================================
// REAL-TIME MULTIPLAYER TRIVIA CLIENT (app.js)
// Author: Aryaa Bhadane
// ==========================================================================

const socket = io();

// Simple Web Audio API Synthesizer for Clean Sound Cues
const SoundFX = {
  ctx: null,
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  },
  playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.05) {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  },
  click() { this.playTone(800, 'sine', 0.04, 0.03); },
  correct() {
    this.playTone(523.25, 'sine', 0.1, 0.05);
    setTimeout(() => this.playTone(659.25, 'sine', 0.1, 0.05), 100);
    setTimeout(() => this.playTone(783.99, 'triangle', 0.25, 0.06), 200);
  },
  wrong() {
    this.playTone(220, 'sawtooth', 0.2, 0.04);
    setTimeout(() => this.playTone(180, 'sawtooth', 0.25, 0.04), 150);
  },
  tick() { this.playTone(600, 'sine', 0.02, 0.015); },
  fanfare() {
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'triangle', 0.3, 0.08), idx * 150);
    });
  }
};

// URL Query Helpers
function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    pin: params.get('pin'),
    name: params.get('name'),
    hostName: params.get('hostName'),
    category: params.get('category')
  };
}

// Global active timers
let countdownInterval = null;
let currentRoundData = null;
let lastAcknowledgedAnswer = null;

// ==========================================================================
// HOST CONTROLLER LOGIC
// ==========================================================================
function initHost() {
  const query = getQueryParams();
  let currentPin = null;

  // DOM Elements
  const hostLobbySection = document.getElementById('hostLobbySection');
  const hostQuestionSection = document.getElementById('hostQuestionSection');
  const hostReviewSection = document.getElementById('hostReviewSection');
  const hostEndedSection = document.getElementById('hostEndedSection');

  const displayPin = document.getElementById('displayPin');
  const hostNameLabel = document.getElementById('hostNameLabel');
  const hostCategoryBadge = document.getElementById('hostCategoryBadge');
  const rosterList = document.getElementById('rosterList');
  const playerCount = document.getElementById('playerCount');
  const startGameBtn = document.getElementById('startGameBtn');

  const hostQuestionCounter = document.getElementById('hostQuestionCounter');
  const hostTimerClock = document.getElementById('hostTimerClock');
  const hostTimerBar = document.getElementById('hostTimerBar');
  const hostQuestionText = document.getElementById('hostQuestionText');
  const hostOptionsGrid = document.getElementById('hostOptionsGrid');
  const hostSubmissionCounter = document.getElementById('hostSubmissionCounter');

  const revealedAnswerText = document.getElementById('revealedAnswerText');
  const revealedExplanationText = document.getElementById('revealedExplanationText');
  const hostLeaderboardBody = document.getElementById('hostLeaderboardBody');
  const nextRoundCountdown = document.getElementById('nextRoundCountdown');

  const winnerName = document.getElementById('winnerName');
  const winnerScore = document.getElementById('winnerScore');
  const hostFinalLeaderboardBody = document.getElementById('hostFinalLeaderboardBody');

  // Initialize room creation on connect
  socket.on('connect', () => {
    console.log('[HOST] Connected to server.');
    socket.emit('quiz:create', {
      hostName: query.hostName || 'Quiz Master',
      category: query.category || 'Tech & Architecture'
    });
  });

  // Room Created
  socket.on('quiz:created', (data) => {
    currentPin = data.pin;
    displayPin.textContent = data.pin;
    hostNameLabel.textContent = `Host: ${query.hostName || 'Quiz Master'}`;
    hostCategoryBadge.textContent = query.category || 'TECH';
    console.log(`[HOST] Room initialized with PIN: ${data.pin}`);
  });

  // Lobby Roster Update
  socket.on('lobby:update', (data) => {
    const players = data.players || [];
    playerCount.textContent = `${players.length} Player${players.length === 1 ? '' : 's'} Joined`;

    rosterList.innerHTML = '';
    if (players.length === 0) {
      rosterList.innerHTML = '<span style="color: var(--text-dim); font-size: 0.95rem; margin: auto;">Waiting for competitors to join...</span>';
      startGameBtn.disabled = true;
    } else {
      players.forEach((p) => {
        const chip = document.createElement('div');
        chip.className = 'player-chip';
        chip.innerHTML = `<div class="player-dot"></div><span>${escapeHtml(p.name)}</span>`;
        rosterList.appendChild(chip);
      });
      startGameBtn.disabled = false;
    }
  });

  // Start Game Button Handler
  startGameBtn.addEventListener('click', () => {
    if (!currentPin) return;
    SoundFX.click();
    socket.emit('quiz:start', { pin: currentPin });
  });

  // Question Start Broadcast
  socket.on('question:start', (data) => {
    SoundFX.tick();
    currentRoundData = data;

    // Switch view
    hostLobbySection.classList.add('hidden');
    hostReviewSection.classList.add('hidden');
    hostEndedSection.classList.add('hidden');
    hostQuestionSection.classList.remove('hidden');

    hostQuestionCounter.textContent = `Question ${data.questionIndex} of ${data.totalQuestions}`;
    hostQuestionText.textContent = data.question;
    hostSubmissionCounter.textContent = `0 Answers Received`;

    // Render Options
    const optionCards = hostOptionsGrid.querySelectorAll('.option-btn');
    const shapeSymbols = ['▲', '◆', '●', '■'];
    data.options.forEach((opt, idx) => {
      if (optionCards[idx]) {
        optionCards[idx].className = `option-btn opt-${idx}`;
        optionCards[idx].innerHTML = `
          <div class="option-shape">${shapeSymbols[idx]}</div>
          <span class="opt-text">${escapeHtml(opt)}</span>
        `;
      }
    });

    // Start Timer Display
    startTimer(data.timeLimitSeconds, hostTimerClock, hostTimerBar);
  });

  // Live Answer Submission Counter
  socket.on('host:answer_count_update', (data) => {
    hostSubmissionCounter.textContent = `${data.answeredCount} / ${data.totalPlayers} Answered`;
  });

  // Question Time Up / Answer Reveal
  socket.on('question:time_up', (data) => {
    clearInterval(countdownInterval);
    SoundFX.tick();

    hostQuestionSection.classList.add('hidden');
    hostReviewSection.classList.remove('hidden');

    const shapeSymbols = ['▲', '◆', '●', '■'];
    const correctIdx = data.correctOption;
    const correctText = currentRoundData && currentRoundData.options ? currentRoundData.options[correctIdx] : '';

    revealedAnswerText.textContent = `Correct Answer: [ ${shapeSymbols[correctIdx]} ] ${correctText}`;
    revealedExplanationText.textContent = data.explanation || '';

    // Auto next round indicator
    let reviewSecs = 5;
    nextRoundCountdown.textContent = `Next question in ${reviewSecs}s...`;
    const rInt = setInterval(() => {
      reviewSecs--;
      if (reviewSecs > 0) {
        nextRoundCountdown.textContent = `Next question in ${reviewSecs}s...`;
      } else {
        clearInterval(rInt);
      }
    }, 1000);
  });

  // Dynamic Leaderboard Update
  socket.on('leaderboard:update', (data) => {
    renderLeaderboard(data.leaderboard, hostLeaderboardBody);
  });

  // Quiz Ended / Winner Screen
  socket.on('quiz:ended', (data) => {
    clearInterval(countdownInterval);
    SoundFX.fanfare();

    hostLobbySection.classList.add('hidden');
    hostQuestionSection.classList.add('hidden');
    hostReviewSection.classList.add('hidden');
    hostEndedSection.classList.remove('hidden');

    winnerName.textContent = data.winner ? data.winner.name : 'Nobody';
    winnerScore.textContent = `${data.winner ? data.winner.score : 0} Points`;

    renderLeaderboard(data.finalRanks, hostFinalLeaderboardBody);
  });
}

// ==========================================================================
// PLAYER CONTROLLER LOGIC
// ==========================================================================
function initPlayer() {
  const query = getQueryParams();
  let currentPin = query.pin ? String(query.pin).trim() : null;
  let currentPlayerName = query.name ? String(query.name).trim() : null;
  let questionStartTime = 0;
  let hasAnswered = false;

  // DOM Elements
  const playerStatusBadge = document.getElementById('playerStatusBadge');
  const playerJoinSection = document.getElementById('playerJoinSection');
  const playerLobbySection = document.getElementById('playerLobbySection');
  const playerQuestionSection = document.getElementById('playerQuestionSection');
  const playerReviewSection = document.getElementById('playerReviewSection');
  const playerEndedSection = document.getElementById('playerEndedSection');

  const manualPin = document.getElementById('manualPin');
  const manualName = document.getElementById('manualName');
  const manualJoinBtn = document.getElementById('manualJoinBtn');
  const manualError = document.getElementById('manualError');

  const lobbyPlayerName = document.getElementById('lobbyPlayerName');
  const lobbyPinDisplay = document.getElementById('lobbyPinDisplay');

  const playerQuestionCounter = document.getElementById('playerQuestionCounter');
  const playerTimerClock = document.getElementById('playerTimerClock');
  const playerTimerBar = document.getElementById('playerTimerBar');
  const playerQuestionText = document.getElementById('playerQuestionText');
  const playerOptionsGrid = document.getElementById('playerOptionsGrid');
  const playerLockedStatus = document.getElementById('playerLockedStatus');

  const playerFeedbackBanner = document.getElementById('playerFeedbackBanner');
  const playerFeedbackTitle = document.getElementById('playerFeedbackTitle');
  const playerFeedbackSub = document.getElementById('playerFeedbackSub');
  const playerScoreBadge = document.getElementById('playerScoreBadge');
  const playerExplanationText = document.getElementById('playerExplanationText');
  const playerLeaderboardBody = document.getElementById('playerLeaderboardBody');

  const playerFinalWinner = document.getElementById('playerFinalWinner');
  const playerFinalScore = document.getElementById('playerFinalScore');
  const playerOwnResult = document.getElementById('playerOwnResult');
  const playerFinalLeaderboardBody = document.getElementById('playerFinalLeaderboardBody');

  // Attempt auto-join if params exist
  function joinRoom(pin, name) {
    if (!pin || !name) return;
    currentPin = pin;
    currentPlayerName = name;
    socket.emit('quiz:join', { pin, playerName: name });
  }

  socket.on('connect', () => {
    playerStatusBadge.textContent = 'CONNECTED';
    if (currentPin && currentPlayerName) {
      joinRoom(currentPin, currentPlayerName);
    } else {
      playerJoinSection.classList.remove('hidden');
    }
  });

  // Manual Join fallback
  manualJoinBtn.addEventListener('click', () => {
    const pin = manualPin.value.trim();
    const name = manualName.value.trim();
    if (!pin || pin.length < 4) {
      manualError.textContent = 'Please enter a valid 4-digit PIN.';
      manualError.classList.remove('hidden');
      return;
    }
    if (!name) {
      manualError.textContent = 'Please enter your name.';
      manualError.classList.remove('hidden');
      return;
    }
    SoundFX.click();
    joinRoom(pin, name);
  });

  // Join Success
  socket.on('quiz:joined', (data) => {
    playerJoinSection.classList.add('hidden');
    playerLobbySection.classList.remove('hidden');
    lobbyPlayerName.textContent = currentPlayerName;
    lobbyPinDisplay.textContent = currentPin;
  });

  // Error Handler
  socket.on('quiz:error', (data) => {
    if (manualError) {
      manualError.textContent = data.message || 'An error occurred.';
      manualError.classList.remove('hidden');
      playerJoinSection.classList.remove('hidden');
    } else {
      alert(data.message);
    }
  });

  // Question Start
  socket.on('question:start', (data) => {
    SoundFX.tick();
    currentRoundData = data;
    hasAnswered = false;
    lastAcknowledgedAnswer = null;
    questionStartTime = Date.now();

    // View switch
    playerJoinSection.classList.add('hidden');
    playerLobbySection.classList.add('hidden');
    playerReviewSection.classList.add('hidden');
    playerEndedSection.classList.add('hidden');
    playerQuestionSection.classList.remove('hidden');
    playerLockedStatus.classList.add('hidden');

    playerQuestionCounter.textContent = `Question ${data.questionIndex} of ${data.totalQuestions}`;
    playerQuestionText.textContent = data.question;

    // Render Options & enable clicks
    const optionBtns = playerOptionsGrid.querySelectorAll('.option-btn');
    const shapeSymbols = ['▲', '◆', '●', '■'];
    data.options.forEach((opt, idx) => {
      if (optionBtns[idx]) {
        optionBtns[idx].className = `option-btn opt-${idx}`;
        optionBtns[idx].disabled = false;
        optionBtns[idx].innerHTML = `
          <div class="option-shape">${shapeSymbols[idx]}</div>
          <span class="opt-text">${escapeHtml(opt)}</span>
        `;
      }
    });

    startTimer(data.timeLimitSeconds, playerTimerClock, playerTimerBar);
  });

  // Option Click Handler (Anti-Cheat: single submission, timer check)
  playerOptionsGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.option-btn');
    if (!btn || hasAnswered || btn.disabled) return;

    SoundFX.click();
    hasAnswered = true;

    const selectedOption = parseInt(btn.dataset.index, 10);
    const timeTakenMs = Date.now() - questionStartTime;

    // Disable all buttons immediately
    const optionBtns = playerOptionsGrid.querySelectorAll('.option-btn');
    optionBtns.forEach((b) => {
      b.disabled = true;
      if (b === btn) {
        b.classList.add('selected');
      } else {
        b.style.opacity = '0.4';
      }
    });

    playerLockedStatus.classList.remove('hidden');

    // Emit answer to server
    socket.emit('answer:submit', {
      pin: currentPin,
      selectedOption,
      timeTakenMs
    });
  });

  // Answer Acknowledged
  socket.on('answer:acknowledged', (data) => {
    lastAcknowledgedAnswer = data;
  });

  // Answer Rejected (Anti-Cheat Server Rejection)
  socket.on('answer:rejected', (data) => {
    console.warn('[REJECTED]', data.reason);
  });

  // Question Time Up / Round Review
  socket.on('question:time_up', (data) => {
    clearInterval(countdownInterval);

    playerQuestionSection.classList.add('hidden');
    playerReviewSection.classList.remove('hidden');

    const correctIdx = data.correctOption;
    playerExplanationText.textContent = data.explanation || '';

    if (lastAcknowledgedAnswer && lastAcknowledgedAnswer.isCorrect) {
      SoundFX.correct();
      playerFeedbackBanner.className = 'feedback-banner correct';
      playerFeedbackTitle.textContent = '✓ Correct Answer!';
      playerFeedbackSub.textContent = `+${lastAcknowledgedAnswer.scoreGained} Points (Speed Bonus Included)`;
      playerScoreBadge.textContent = `Total Score: ${lastAcknowledgedAnswer.totalScore}`;
    } else {
      SoundFX.wrong();
      playerFeedbackBanner.className = 'feedback-banner wrong';
      playerFeedbackTitle.textContent = '✕ Incorrect / Missed';
      playerFeedbackSub.textContent = '+0 Points';
      playerScoreBadge.textContent = `Total Score: ${lastAcknowledgedAnswer ? lastAcknowledgedAnswer.totalScore : 0}`;
    }
  });

  // Leaderboard Update
  socket.on('leaderboard:update', (data) => {
    renderLeaderboard(data.leaderboard, playerLeaderboardBody, currentPlayerName);
  });

  // Quiz Ended
  socket.on('quiz:ended', (data) => {
    clearInterval(countdownInterval);

    playerQuestionSection.classList.add('hidden');
    playerReviewSection.classList.add('hidden');
    playerEndedSection.classList.remove('hidden');

    const winner = data.winner;
    playerFinalWinner.textContent = winner ? winner.name : 'Unknown';
    playerFinalScore.textContent = `${winner ? winner.score : 0} Points`;

    if (winner && winner.name.toLowerCase() === (currentPlayerName || '').toLowerCase()) {
      SoundFX.fanfare();
      playerOwnResult.textContent = '🏆 Victory! You won 1st Place!';
    } else {
      playerOwnResult.textContent = 'Well played! Check your final ranking below.';
    }

    renderLeaderboard(data.finalRanks, playerFinalLeaderboardBody, currentPlayerName);
  });

  // Host Disconnected
  socket.on('quiz:host_disconnected', (data) => {
    clearInterval(countdownInterval);
    alert(data.message || 'Host disconnected.');
    window.location.href = 'index.html';
  });
}

// ==========================================================================
// COMMON HELPERS
// ==========================================================================

function startTimer(seconds, clockEl, barEl) {
  if (countdownInterval) clearInterval(countdownInterval);

  let remaining = seconds;
  const total = seconds;

  clockEl.textContent = `${remaining}s`;
  barEl.style.width = '100%';

  const startTime = Date.now();

  countdownInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    remaining = Math.max(0, total - elapsed);

    clockEl.textContent = `${Math.ceil(remaining)}s`;
    const percentage = Math.max(0, (remaining / total) * 100);
    barEl.style.width = `${percentage}%`;

    if (remaining <= 0) {
      clearInterval(countdownInterval);
      clockEl.textContent = '0s';
      barEl.style.width = '0%';
    }
  }, 50);
}

function renderLeaderboard(leaderboard, tableBodyEl, highlightName = null) {
  if (!tableBodyEl) return;
  tableBodyEl.innerHTML = '';

  if (!leaderboard || leaderboard.length === 0) {
    tableBodyEl.innerHTML = '<tr><td colspan="3" style="text-align:center; color: var(--text-muted);">No standings recorded yet</td></tr>';
    return;
  }

  leaderboard.forEach((item) => {
    const isCurrentUser = highlightName && item.name.toLowerCase() === highlightName.toLowerCase();
    const tr = document.createElement('tr');
    tr.className = `leaderboard-row ${item.rank === 1 ? 'rank-1' : ''}`;
    if (isCurrentUser) {
      tr.style.outline = '2px solid #ffffff';
    }

    tr.innerHTML = `
      <td><span class="rank-badge">${item.rank}</span></td>
      <td><strong>${escapeHtml(item.name)}</strong> ${isCurrentUser ? '(You)' : ''}</td>
      <td>${item.score} pts</td>
    `;
    tableBodyEl.appendChild(tr);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================================================
// ROUTE DETECTOR & INITIALIZER
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  const pathname = window.location.pathname;
  if (pathname.includes('host.html')) {
    initHost();
  } else if (pathname.includes('player.html')) {
    initPlayer();
  }
});
