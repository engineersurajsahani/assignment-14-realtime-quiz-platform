# Real-Time Multiplayer Live Quiz Battle (Socket.io)

An authoritative, real-time multiplayer Quiz Arena built with Node.js, Express.js, and Socket.io. Designed with a dual interface: a Host Admin Dashboard with live question timers and dynamic leaderboards, paired with mobile-responsive 4-color Player Gamepads featuring speed-based score bonuses and server-side anti-cheat validation.

---

## Features

- PIN-Based Multiplayer Lobbies: 4-digit PIN generation with real-time player roster updates.
- Synchronized Server Clocks: Server-driven 15s round countdown timers.
- Anti-Cheat Validation: Omits correct answers from question payloads to prevent DOM inspection, and rejects late submissions after timer expiry.
- Dynamic Speed Scoring: Base points + up to 500 bonus points based on millisecond response speed.
- Dynamic Live Leaderboards: Real-time ranking calculation broadcasted after every round.
- Dual UI: Views for Host (Admin View) and Players (Interactive Gamepad).

---

## Project Structure

```
assignment-14-quiz-socket/
├── public/
│   ├── index.html
│   ├── host.html
│   ├── player.html
│   ├── style.css
│   └── app.js
├── data/
│   └── questions.json
├── sockets/
│   ├── gameEngine.js
│   └── lobbyHandler.js
├── server.js
├── package.json
└── README.md
```

---

## Real-Time Socket Protocol

| Event Name | Direction | Payload Schema | Description |
| :--- | :--- | :--- | :--- |
| `quiz:create` | Host -> Server | `{ hostName, category }` | Host creates room, receives 4-digit PIN |
| `quiz:created` | Server -> Host | `{ pin, roomId }` | Returns generated PIN & room ID |
| `quiz:join` | Player -> Server | `{ pin, playerName }` | Player enters lobby via PIN |
| `lobby:update` | Server -> Room | `{ players: [{ name, score }] }` | Broadcasts lobby roster as players join |
| `quiz:start` | Host -> Server | `{ pin }` | Host starts the quiz battle |
| `question:start` | Server -> Room | `{ questionIndex, totalQuestions, question, options, timeLimitSeconds }` | Broadcasts question (omits correctOption for anti-cheat) |
| `answer:submit` | Player -> Server | `{ pin, selectedOption, timeTakenMs }` | Player submits option choice |
| `question:time_up` | Server -> Room | `{ correctOption, explanation }` | Reveals correct answer after round timer ends |
| `leaderboard:update` | Server -> Room | `{ leaderboard: [{ rank, name, score }] }` | Broadcasts updated rankings |
| `quiz:ended` | Server -> Room | `{ winner: { name, score }, finalRanks }` | Emitted after final question round |

---

## Server-Side Scoring Algorithm

Score calculation rewards both accuracy and speed:

```javascript
function calculateScore(isCorrect, timeTakenMs, totalTimeLimitMs = 15000) {
  if (!isCorrect) return 0;
  
  const timeRemaining = Math.max(0, totalTimeLimitMs - timeTakenMs);
  const speedBonus = Math.round((timeRemaining / totalTimeLimitMs) * 500);
  const baseScore = 500;
  
  return baseScore + speedBonus;
}
```

---

## Installation & Running

1. Install Dependencies:
   ```bash
   npm install
   ```

2. Start Server:
   ```bash
   npm start
   ```

3. Open Interfaces in Browser:
   - Host View: http://localhost:5001/host.html
   - Player View: http://localhost:5001/player.html
   - Portal Entry: http://localhost:5001/index.html
