# 🧠 Assignment 14: Real-Time Multiplayer Live Quiz Battle (Socket.io)

A full working solution for the assignment spec: a Kahoot/Quizizz-style live
trivia battle built with **Node.js, Express, Socket.io** and an in-memory
authoritative game engine.

## Run it

```bash
npm install
npm start        # or: npm run dev  (nodemon)
```

Server runs at `http://localhost:5000`.

- Host: `http://localhost:5000/host.html` — create a room, get a 4-digit PIN, start the game.
- Player: `http://localhost:5000/player.html` — join with the PIN, answer questions on the colored button grid.
- Portal: `http://localhost:5000/` — links to both.

## How it works

- **Rooms** are keyed by a 4-digit PIN and live only in server memory (`GameEngine.rooms`).
- **Timers** for each question are server-side `setTimeout`s — the client only
  renders a local countdown for UX; the server is the single source of truth
  for when a round ends.
- **Anti-cheat**: `answer:submit` is rejected if it arrives after the
  server-side deadline, or if the player already answered that round.
- **Scoring**: `500` base points + up to `500` speed bonus, scaled by how much
  time was left when the answer was submitted (see `calculateScore` in
  `sockets/gameEngine.js`).
- **Leaderboard** is recalculated and broadcast after every question, then a
  final `quiz:ended` event fires after the last question with the winner and
  full rankings.

## Socket event protocol

Matches the assignment spec exactly:

| Event | Direction | Payload |
|---|---|---|
| `quiz:create` | Host → Server | `{ hostName, category }` |
| `quiz:created` | Server → Host | `{ pin, roomId }` |
| `quiz:join` | Player → Server | `{ pin, playerName }` |
| `lobby:update` | Server → Room | `{ players: [{ name, score }] }` |
| `quiz:start` | Host → Server | `{ pin }` |
| `question:start` | Server → Room | `{ questionIndex, totalQuestions, question, options, timeLimitSeconds }` |
| `answer:submit` | Player → Server | `{ pin, selectedOption, timeTakenMs }` |
| `question:time_up` | Server → Room | `{ correctOption, explanation }` |
| `leaderboard:update` | Server → Room | `{ leaderboard: [{ rank, name, score }] }` |
| `quiz:ended` | Server → Room | `{ winner, finalRanks }` |

Two extra convenience events not in the original spec, used only for UX:
`quiz:joined` (confirms a player's join) and `answer:result` (private
per-player correctness + points feedback), plus `error:join` /
`quiz:host_left` for error handling.

## Directory structure

```
assignment-14-quiz-socket/
├── public/
│   ├── index.html
│   ├── host.html
│   ├── player.html
│   ├── app.js
│   └── style.css
├── data/
│   └── questions.json
├── sockets/
│   ├── gameEngine.js
│   └── lobbyHandler.js
├── server.js
├── package.json
└── README.md
```

## Testing per the assignment's verification guide

1. `npm start`, open `host.html` on tab 1 → Create Quiz → note the PIN.
2. Open `player.html` on tabs 2 and 3 → join with the PIN as "Player 1" / "Player 2".
3. On the host tab, click **Start Game**.
4. Answer fast on Player 1, wait ~10s before answering on Player 2.
5. Player 1 should score higher due to the speed bonus.
6. After the 15s timer, late submissions are silently rejected server-side.
