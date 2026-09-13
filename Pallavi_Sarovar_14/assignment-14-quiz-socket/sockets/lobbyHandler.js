function generatePin(rooms) {
  let pin;
  do {
    pin = String(Math.floor(1000 + Math.random() * 9000));
  } while (rooms.has(pin));
  return pin;
}

function sanitizeName(value, fallback) {
  const name = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 24);
  return name || fallback;
}

function createRoom(rooms, hostName, category) {
  const pin = generatePin(rooms);
  const room = {
    pin,
    roomId: `quiz_${pin}`,
    hostSocketId: null,
    hostName: sanitizeName(hostName, 'Quiz Host'),
    category: String(category || 'Tech').trim().slice(0, 40) || 'Tech',
    players: new Map(),
    status: 'lobby',
    currentQuestionIndex: -1,
    questionStartedAt: null,
    questionTimer: null,
    answers: new Map(),
    createdAt: Date.now()
  };
  rooms.set(pin, room);
  return room;
}

function addPlayer(room, socketId, playerName) {
  const base = sanitizeName(playerName, 'Player');
  let name = base;
  let counter = 2;
  const existing = new Set([...room.players.values()].map(p => p.name.toLowerCase()));
  while (existing.has(name.toLowerCase())) name = `${base} ${counter++}`;

  const player = { socketId, name, score: 0, answered: false, joinedAt: Date.now() };
  room.players.set(socketId, player);
  return player;
}

function roomRoster(room) {
  return [...room.players.values()]
    .sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt)
    .map(({ socketId, name, score, answered }) => ({ socketId, name, score, answered }));
}

module.exports = { createRoom, addPlayer, roomRoster, sanitizeName };
