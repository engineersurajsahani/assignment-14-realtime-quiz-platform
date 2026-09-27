const socket = io();

// Shared logic and specific logic depending on page
const path = window.location.pathname;

let gamePin = '';
let countdownInterval;

if (path.includes('host.html')) {
  // HOST LOGIC
  document.getElementById('createBtn').addEventListener('click', () => {
    socket.emit('quiz:create', { hostName: 'Host', category: 'General' });
  });

  socket.on('quiz:created', ({ pin }) => {
    gamePin = pin;
    document.getElementById('createBtn').style.display = 'none';
    document.getElementById('pinDisplay').innerText = `Game PIN: ${pin}`;
    document.getElementById('startBtn').style.display = 'inline-block';
  });

  socket.on('lobby:update', ({ players }) => {
    document.getElementById('playerList').innerHTML = players.map(p => `<li>${p.name}</li>`).join('');
  });

  document.getElementById('startBtn').addEventListener('click', () => {
    socket.emit('quiz:start', { pin: gamePin });
    document.getElementById('lobby').style.display = 'none';
  });

  socket.on('question:start', ({ question, options, timeLimitSeconds }) => {
    document.getElementById('leaderboardArea').style.display = 'none';
    document.getElementById('questionArea').style.display = 'block';
    document.getElementById('questionText').innerText = question;
    document.getElementById('optionsGrid').innerHTML = options.map((opt, i) => `<div class="option">${['A','B','C','D'][i]}: ${opt}</div>`).join('');
    
    let timeLeft = timeLimitSeconds;
    document.getElementById('timerDisplay').innerText = timeLeft;
    clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
      timeLeft--;
      document.getElementById('timerDisplay').innerText = timeLeft;
      if (timeLeft <= 0) clearInterval(countdownInterval);
    }, 1000);
  });

  socket.on('question:time_up', ({ correctOption, explanation }) => {
    clearInterval(countdownInterval);
    document.getElementById('explanation').innerText = `Correct Option: ${['A','B','C','D'][correctOption]} - ${explanation}`;
  });

  socket.on('leaderboard:update', ({ leaderboard }) => {
    document.getElementById('questionArea').style.display = 'none';
    document.getElementById('leaderboardArea').style.display = 'block';
    document.getElementById('leaderboardBody').innerHTML = leaderboard.map(l => `<tr><td>#${l.rank}</td><td>${l.name}</td><td>${l.score}</td></tr>`).join('');
  });

  socket.on('quiz:ended', ({ winner }) => {
    document.getElementById('leaderboardArea').innerHTML = `<h2>Game Over! Winner: ${winner.name} (${winner.score} pts)</h2>`;
  });

} else if (path.includes('player.html')) {
  // PLAYER LOGIC
  document.getElementById('joinBtn').addEventListener('click', () => {
    const pin = document.getElementById('pinInput').value;
    const name = document.getElementById('nameInput').value;
    if (pin && name) {
      gamePin = pin;
      socket.emit('quiz:join', { pin, playerName: name });
      document.getElementById('joinArea').style.display = 'none';
      document.getElementById('waitArea').style.display = 'block';
    }
  });

  socket.on('question:start', ({ timeLimitSeconds }) => {
    document.getElementById('waitArea').style.display = 'none';
    document.getElementById('gameArea').style.display = 'block';
    
    let timeLeft = timeLimitSeconds;
    document.getElementById('playerTimer').innerText = timeLeft;
    clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
      timeLeft--;
      document.getElementById('playerTimer').innerText = timeLeft;
      if (timeLeft <= 0) clearInterval(countdownInterval);
    }, 1000);
  });

  window.submitAnswer = (index) => {
    socket.emit('answer:submit', { pin: gamePin, selectedOption: index });
    document.getElementById('gameArea').style.display = 'none';
    document.getElementById('waitArea').style.display = 'block';
    document.querySelector('#waitArea h2').innerText = 'Answer submitted! Waiting...';
  };

  socket.on('leaderboard:update', ({ leaderboard }) => {
    document.getElementById('gameArea').style.display = 'none';
    document.getElementById('waitArea').style.display = 'block';
    document.querySelector('#waitArea h2').innerText = 'Look at the screen for leaderboard!';
  });

  socket.on('quiz:ended', () => {
    document.getElementById('gameArea').style.display = 'none';
    document.getElementById('waitArea').style.display = 'block';
    document.querySelector('#waitArea h2').innerText = 'Game Over!';
  });
}
