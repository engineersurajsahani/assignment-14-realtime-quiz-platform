const socket = io();
const isHost = location.pathname.endsWith('host.html');
let pin = '';
let timerInterval = null;
let myScore = 0;
let answered = false;

const $ = (id) => document.getElementById(id);
const show = (id) => $(id)?.classList.remove('hidden');
const hide = (id) => $(id)?.classList.add('hidden');

function toast(message) {
  const el = $('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

function renderPlayers(targetId, players) {
  const el = $(targetId);
  if (!el) return;
  if (!players.length) {
    el.innerHTML = '<p class="muted">No players have joined yet.</p>';
    return;
  }
  el.innerHTML = players.map((p, i) => `<div class="player-row"><span>👤 ${escapeHtml(p.name)}</span><strong>${p.score}</strong></div>`).join('');
  if ($('playerCount')) $('playerCount').textContent = players.length;
}

function renderLeaderboard(targetId, leaderboard) {
  const el = $(targetId);
  if (!el) return;
  el.innerHTML = leaderboard.map((p) => `<div class="rank-row ${p.rank === 1 ? 'winner-row' : ''}"><span><b>#${p.rank}</b> ${escapeHtml(p.name)}</span><strong>${p.score}</strong></div>`).join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function startTimer(startedAt, seconds, targetId) {
  clearInterval(timerInterval);
  const target = $(targetId);
  const end = Number(startedAt) + seconds * 1000;
  const tick = () => {
    const remaining = Math.max(0, end - Date.now());
    if (target) target.textContent = Math.ceil(remaining / 1000);
    if (remaining <= 0) clearInterval(timerInterval);
  };
  tick();
  timerInterval = setInterval(tick, 100);
}

if (isHost) {
  $('createForm').addEventListener('submit', (e) => {
    e.preventDefault();
    socket.emit('quiz:create', { hostName: $('hostName').value, category: $('category').value });
  });

  $('startButton').addEventListener('click', () => socket.emit('quiz:start', { pin }));

  socket.on('quiz:created', (data) => {
    pin = data.pin;
    $('pin').textContent = pin;
    hide('createPanel');
    show('hostGame');
    toast(`Quiz created. Share PIN ${pin}`);
  });

  socket.on('lobby:update', ({ players }) => {
    renderPlayers('players', players);
    if ($('startButton')) $('startButton').disabled = players.length === 0;
    if ($('roomStatus')) $('roomStatus').textContent = `${players.length} player${players.length === 1 ? '' : 's'} joined`;
  });

  socket.on('question:start', (data) => {
    $('questionNumber').textContent = `Question ${data.questionIndex}/${data.totalQuestions}`;
    $('questionText').textContent = data.question;
    $('explanation').textContent = '';
    $('hostOptions').innerHTML = data.options.map((option, i) => `<div class="host-option"><span>${String.fromCharCode(65 + i)}</span>${escapeHtml(option)}</div>`).join('');
    startTimer(data.startedAt, data.timeLimitSeconds, 'timer');
    $('startButton').disabled = true;
  });

  socket.on('question:time_up', ({ correctOption, explanation }) => {
    const options = document.querySelectorAll('.host-option');
    options.forEach((el, i) => { if (i === correctOption) el.classList.add('correct'); });
    $('explanation').textContent = `Correct answer: ${String.fromCharCode(65 + correctOption)} • ${explanation}`;
  });

  socket.on('leaderboard:update', ({ leaderboard }) => renderLeaderboard('leaderboard', leaderboard));
  socket.on('quiz:ended', ({ winner, finalRanks }) => {
    clearInterval(timerInterval);
    $('questionText').textContent = `🏆 Winner: ${winner.name} — ${winner.score} points`;
    renderLeaderboard('leaderboard', finalRanks);
    $('roomStatus').textContent = 'Quiz complete';
  });
} else {
  $('joinForm').addEventListener('submit', (e) => {
    e.preventDefault();
    socket.emit('quiz:join', { pin: $('joinPin').value, playerName: $('playerName').value });
  });

  socket.on('quiz:joined', (data) => {
    pin = data.pin;
    $('playerPin').textContent = pin;
    $('myName').textContent = data.player.name;
    hide('joinPanel');
    show('playerGame');
    toast('Joined the quiz lobby!');
  });

  socket.on('lobby:update', ({ players }) => renderPlayers('lobbyPlayers', players));

  socket.on('question:start', (data) => {
    hide('lobbyPanel');
    show('playPanel');
    answered = false;
    $('answerStatus').textContent = '';
    $('playerQuestionNumber').textContent = `Question ${data.questionIndex}/${data.totalQuestions}`;
    $('playerQuestion').textContent = data.question;
    $('answerGrid').innerHTML = data.options.map((option, i) => `<button class="answer-button answer-${i}" data-option="${i}"><span>${String.fromCharCode(65 + i)}</span>${escapeHtml(option)}</button>`).join('');
    document.querySelectorAll('.answer-button').forEach((button) => {
      button.addEventListener('click', () => submitAnswer(Number(button.dataset.option)));
    });
    startTimer(data.startedAt, data.timeLimitSeconds, 'playerTimer');
  });

  function submitAnswer(option) {
    if (answered) return;
    answered = true;
    document.querySelectorAll('.answer-button').forEach((button) => button.disabled = true);
    socket.emit('answer:submit', { pin, selectedOption: option, timeTakenMs: 0 });
  }

  socket.on('answer:result', (data) => {
    if (!data.accepted) {
      $('answerStatus').textContent = data.message;
      return;
    }
    if (data.isCorrect) {
      myScore += data.scoreAwarded;
      $('myScore').textContent = myScore;
      $('answerStatus').textContent = `✅ Correct! +${data.scoreAwarded} points`;
    } else {
      $('answerStatus').textContent = '❌ Incorrect. Better luck next round!';
    }
  });

  socket.on('question:time_up', ({ correctOption, explanation }) => {
    document.querySelectorAll('.answer-button').forEach((button, i) => {
      if (i === correctOption) button.classList.add('correct');
      button.disabled = true;
    });
    $('answerStatus').textContent = `Answer: ${String.fromCharCode(65 + correctOption)} • ${explanation}`;
  });

  socket.on('leaderboard:update', ({ leaderboard }) => renderLeaderboard('playerLeaderboard', leaderboard));

  socket.on('quiz:ended', ({ winner, finalRanks }) => {
    clearInterval(timerInterval);
    hide('playPanel');
    show('lobbyPanel');
    $('lobbyPanel').innerHTML = `<div class="final"><div class="trophy">🏆</div><h1>Quiz Complete!</h1><h2>${escapeHtml(winner.name)} wins with ${winner.score} points</h2><div id="finalPlayerBoard" class="leaderboard"></div></div>`;
    renderLeaderboard('finalPlayerBoard', finalRanks);
  });
}

socket.on('quiz:error', ({ message }) => toast(message));
