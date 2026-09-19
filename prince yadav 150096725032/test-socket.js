/**
 * Assignment 14: Real-Time Multiplayer Live Quiz Battle
 * Automated Socket.io Verification Test Suite
 * Author: Prince Yadav (150096725032)
 */

const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const ioClient = require('socket.io-client');
const assert = require('assert');

const questionsData = require('./data/questions.json');
const { registerLobbyHandlers } = require('./sockets/lobbyHandler');
const { registerGameHandlers, calculateScore } = require('./sockets/gameEngine');

console.log('===============================================================');
console.log('🧪 RUNNING ASSIGNMENT 14 SOCKET.IO MULTIPLAYER TEST SUITE');
console.log('===============================================================\n');

async function runTests() {
  // 1. Setup Isolated Test Server on dynamic port
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    registerLobbyHandlers(io, socket, questionsData);
    registerGameHandlers(io, socket);
  });

  const TEST_PORT = 5055;
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const SERVER_URL = `http://localhost:${TEST_PORT}`;
  console.log(`[TEST SERVER] Running on ${SERVER_URL}`);

  let hostSocket, player1Socket, player2Socket, player3Socket;
  let roomPin = null;

  try {
    // -------------------------------------------------------------
    // TEST 1: Math unit tests for speed-based scoring algorithm
    // -------------------------------------------------------------
    console.log('▶ [TEST 1] Verifying Server-Side Scoring Algorithm Formula...');
    const maxScore = calculateScore(true, 0, 15000);
    assert.strictEqual(maxScore, 1000, 'Instant correct answer should yield 1000 points');

    const halfSpeedScore = calculateScore(true, 7500, 15000);
    assert.strictEqual(halfSpeedScore, 750, 'Answer at 7.5s should yield 750 points (500 base + 250 bonus)');

    const slowScore = calculateScore(true, 15000, 15000);
    assert.strictEqual(slowScore, 500, 'Answer at 15s should yield base 500 points');

    const wrongScore = calculateScore(false, 500, 15000);
    assert.strictEqual(wrongScore, 0, 'Incorrect answer must yield 0 points');
    console.log('  ✔ Scoring formula passed: 1000 max, 750 mid, 500 slow, 0 wrong.\n');

    // -------------------------------------------------------------
    // TEST 2: Host Creates Room & receives 4-digit PIN
    // -------------------------------------------------------------
    console.log('▶ [TEST 2] Host creates room (quiz:create) and obtains PIN...');
    hostSocket = ioClient(SERVER_URL);
    await new Promise((resolve) => hostSocket.on('connect', resolve));

    const createPromise = new Promise((resolve) => {
      hostSocket.on('quiz:created', (data) => {
        resolve(data);
      });
    });

    hostSocket.emit('quiz:create', { hostName: 'Professor X', category: 'Backend' });
    const createData = await createPromise;

    assert.ok(createData.pin, 'Should return a room PIN');
    assert.strictEqual(createData.pin.length, 4, 'PIN must be exactly 4 digits');
    assert.ok(/^\d{4}$/.test(createData.pin), 'PIN must be numeric');
    roomPin = createData.pin;
    console.log(`  ✔ Host created room successfully with 4-digit PIN: ${roomPin}\n`);

    // -------------------------------------------------------------
    // TEST 3: Multiple Players Join Lobby & Roster Broadcasts
    // -------------------------------------------------------------
    console.log('▶ [TEST 3] Connecting 3 Players (Player 1, Player 2, Player 3)...');
    player1Socket = ioClient(SERVER_URL);
    player2Socket = ioClient(SERVER_URL);
    player3Socket = ioClient(SERVER_URL);

    await Promise.all([
      new Promise((res) => player1Socket.on('connect', res)),
      new Promise((res) => player2Socket.on('connect', res)),
      new Promise((res) => player3Socket.on('connect', res))
    ]);

    // Player 1 joins
    const p1JoinPromise = new Promise((resolve) => {
      player1Socket.on('quiz:joined', resolve);
    });
    player1Socket.emit('quiz:join', { pin: roomPin, playerName: 'Karan (Speed Demon)' });
    const p1JoinData = await p1JoinPromise;
    assert.strictEqual(p1JoinData.playerName, 'Karan (Speed Demon)');

    // Player 2 joins
    const p2JoinPromise = new Promise((resolve) => {
      player2Socket.on('quiz:joined', resolve);
    });
    player2Socket.emit('quiz:join', { pin: roomPin, playerName: 'Aman (Careful)' });
    await p2JoinPromise;

    // Player 3 joins & check lobby:update has all 3
    const lobbyUpdatePromise = new Promise((resolve) => {
      player1Socket.on('lobby:update', (data) => {
        if (data.players.length === 3) resolve(data);
      });
    });

    player3Socket.emit('quiz:join', { pin: roomPin, playerName: 'Rohan (Wrong)' });
    const lobbyData = await lobbyUpdatePromise;
    assert.strictEqual(lobbyData.players.length, 3, 'Lobby must have 3 registered players');
    console.log(`  ✔ All 3 players joined. Lobby updated with: ${lobbyData.players.map(p => p.name).join(', ')}\n`);

    // -------------------------------------------------------------
    // TEST 4: Anti-Cheat Question Stripping on quiz:start
    // -------------------------------------------------------------
    console.log('▶ [TEST 4] Host starts quiz; verifying anti-cheat question payload...');
    const qStartPromise = new Promise((resolve) => {
      player1Socket.on('question:start', resolve);
    });

    hostSocket.emit('quiz:start', { pin: roomPin });
    const questionPayload = await qStartPromise;

    assert.ok(questionPayload.question, 'Question text must be provided');
    assert.strictEqual(questionPayload.options.length, 4, 'Must provide 4 options');
    assert.strictEqual(questionPayload.correctOption, undefined, 'Anti-Cheat: correctOption MUST be omitted from question:start');
    assert.strictEqual(questionPayload.explanation, undefined, 'Anti-Cheat: explanation MUST be omitted from question:start');
    assert.strictEqual(questionPayload.timeLimitSeconds, 15, 'Time limit must be 15s');
    console.log('  ✔ Server broadcasted question without revealing correct answer to clients!\n');

    // -------------------------------------------------------------
    // TEST 5: Speed-Based Scoring & Answer Submission
    // -------------------------------------------------------------
    console.log('▶ [TEST 5] Submitting answers at different speeds and correctness...');
    const currentQInDb = questionsData.find((q) => q.question === questionPayload.question);
    const correctOpt = currentQInDb ? currentQInDb.correctOption : 0;
    const wrongOpt = (correctOpt + 1) % 4;

    // P1 answers fast and correctly (100ms)
    await new Promise((r) => setTimeout(r, 100));
    player1Socket.emit('answer:submit', { pin: roomPin, selectedOption: correctOpt, timeTakenMs: 100 });

    // P2 answers correctly but slower (700ms)
    await new Promise((r) => setTimeout(r, 600));
    player2Socket.emit('answer:submit', { pin: roomPin, selectedOption: correctOpt, timeTakenMs: 700 });

    // P3 answers incorrectly
    player3Socket.emit('answer:submit', { pin: roomPin, selectedOption: wrongOpt, timeTakenMs: 300 });

    // Wait for round conclusion and individual results
    const [p1Result, p2Result, p3Result] = await Promise.all([
      new Promise((resolve) => player1Socket.on('answer:result', resolve)),
      new Promise((resolve) => player2Socket.on('answer:result', resolve)),
      new Promise((resolve) => player3Socket.on('answer:result', resolve))
    ]);

    assert.strictEqual(p1Result.isCorrect, true, 'P1 should be marked correct');
    assert.strictEqual(p2Result.isCorrect, true, 'P2 should be marked correct');
    assert.strictEqual(p3Result.isCorrect, false, 'P3 should be marked incorrect');

    console.log(`  📊 Player 1 (Fast) Score: ${p1Result.scoreAdded} pts`);
    console.log(`  📊 Player 2 (Slow) Score: ${p2Result.scoreAdded} pts`);
    console.log(`  📊 Player 3 (Wrong) Score: ${p3Result.scoreAdded} pts`);

    assert.ok(
      p1Result.scoreAdded > p2Result.scoreAdded,
      'Speed bonus assertion: Player 1 (faster) MUST receive a higher score than Player 2 (slower)'
    );
    assert.strictEqual(p3Result.scoreAdded, 0, 'Wrong answer must result in 0 scoreAdded');
    console.log('  ✔ Speed-based dynamic scoring verified successfully!\n');

    // -------------------------------------------------------------
    // TEST 6: Anti-Cheat Expiry Rejection
    // -------------------------------------------------------------
    console.log('▶ [TEST 6] Testing Anti-Cheat rejection after timer expiry...');
    const lateSubmitPromise = new Promise((resolve) => {
      player1Socket.on('answer:rejected', resolve);
    });

    // Attempt to submit an answer after the round has already concluded
    player1Socket.emit('answer:submit', { pin: roomPin, selectedOption: 0, timeTakenMs: 16000 });
    const rejection = await lateSubmitPromise;
    assert.ok(rejection.reason, 'Server must reject late submission with reason');
    console.log(`  ✔ Anti-Cheat rejected late submission: "${rejection.reason}"\n`);

    // -------------------------------------------------------------
    // TEST 7: Leaderboard Sorting & Rank Calculation
    // -------------------------------------------------------------
    console.log('▶ [TEST 7] Verifying live leaderboard ranking...');
    const lbPromise = new Promise((resolve) => {
      hostSocket.on('leaderboard:update', resolve);
    });

    const lbData = await lbPromise;
    assert.ok(lbData.leaderboard.length >= 3, 'Leaderboard must contain all 3 participants');
    assert.strictEqual(lbData.leaderboard[0].name, 'Karan (Speed Demon)', 'Rank 1 must be Karan');
    assert.strictEqual(lbData.leaderboard[0].rank, 1);
    assert.strictEqual(lbData.leaderboard[1].name, 'Aman (Careful)', 'Rank 2 must be Aman');
    assert.strictEqual(lbData.leaderboard[1].rank, 2);
    assert.strictEqual(lbData.leaderboard[2].name, 'Rohan (Wrong)', 'Rank 3 must be Rohan');
    assert.strictEqual(lbData.leaderboard[2].rank, 3);
    console.log('  ✔ Dynamic leaderboard correctly calculated and sorted:\n', lbData.leaderboard.map(r => `     #${r.rank} ${r.name} - ${r.score} pts`).join('\n'));

    console.log('\n===============================================================');
    console.log('🎉 ALL ASSIGNMENT 14 TEST SUITES PASSED FLAWLESSLY! (100/100)');
    console.log('===============================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err);
    process.exit(1);
  } finally {
    // Teardown connections
    if (hostSocket) hostSocket.disconnect();
    if (player1Socket) player1Socket.disconnect();
    if (player2Socket) player2Socket.disconnect();
    if (player3Socket) player3Socket.disconnect();
    server.close();
  }
}

runTests();
