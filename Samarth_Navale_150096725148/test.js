const app = require('./server');
const server = app.server;
const { io: ioClient } = require('socket.io-client');
const request = require('supertest');

const PORT = 5077;

const runTests = async () => {
  let passed = 0;
  let total = 0;

  const assert = (condition, name) => {
    total++;
    if (condition) {
      console.log(`PASS: ${name}`);
      passed++;
    } else {
      console.error(`FAIL: ${name}`);
    }
  };

  await new Promise((resolve) => server.listen(PORT, resolve));

  const clientUrl = `http://localhost:${PORT}`;

  try {
    const statusRes = await request(app).get('/api/status');
    assert(statusRes.status === 200 && statusRes.body.success, 'HTTP - API status endpoint');

    const hostSocket = ioClient(clientUrl, { reconnection: false });
    const player1 = ioClient(clientUrl, { reconnection: false });
    const player2 = ioClient(clientUrl, { reconnection: false });

    await new Promise((resolve) => hostSocket.on('connect', resolve));
    await new Promise((resolve) => player1.on('connect', resolve));
    await new Promise((resolve) => player2.on('connect', resolve));
    assert(hostSocket.connected && player1.connected && player2.connected, 'Socket.io - Host and 2 players connected');

    const createPromise = new Promise((resolve) => {
      hostSocket.on('quiz:created', (data) => {
        resolve(data);
      });
    });

    hostSocket.emit('quiz:create', { hostName: 'Host Master', category: 'Tech' });
    const createdData = await createPromise;
    assert(createdData.pin && createdData.pin.length === 4, 'Lobby - Host creates quiz and receives 4-digit PIN');
    const pin = createdData.pin;

    const lobbyUpdatePromise = new Promise((resolve) => {
      hostSocket.on('lobby:update', (data) => {
        if (data.players && data.players.length === 2) {
          resolve(data);
        }
      });
    });

    player1.emit('quiz:join', { pin, playerName: 'Player 1' });
    player2.emit('quiz:join', { pin, playerName: 'Player 2' });

    const lobbyData = await lobbyUpdatePromise;
    assert(lobbyData.players.length === 2, 'Lobby - Players join via PIN and lobby roster updates');

    const questionPromise1 = new Promise((resolve) => {
      player1.on('question:start', (data) => {
        resolve(data);
      });
    });

    hostSocket.emit('quiz:start', { pin });
    const qData = await questionPromise1;
    assert(qData.questionIndex === 1 && Array.isArray(qData.options) && qData.correctOption === undefined, 'Game - Synchronized question broadcast (without revealing answer)');

    const resultPromise1 = new Promise((resolve) => {
      player1.on('answer:result', (data) => {
        resolve(data);
      });
    });
    const resultPromise2 = new Promise((resolve) => {
      player2.on('answer:result', (data) => {
        resolve(data);
      });
    });

    player1.emit('answer:submit', {
      pin,
      selectedOption: 0,
      timeTakenMs: 2000
    });

    player2.emit('answer:submit', {
      pin,
      selectedOption: 0,
      timeTakenMs: 10000
    });

    const res1 = await resultPromise1;
    const res2 = await resultPromise2;

    assert(res1.correct && res2.correct, 'Game - Answers evaluated correctly');
    assert(res1.scoreGained > res2.scoreGained, 'Scoring - Speed-based dynamic score bonus awarded');

    hostSocket.disconnect();
    player1.disconnect();
    player2.disconnect();
    server.close();

    console.log(`\nTests completed: ${passed}/${total} passed`);
    process.exit(passed === total ? 0 : 1);
  } catch (err) {
    console.error('Test error:', err);
    server.close();
    process.exit(1);
  }
};

runTests();
