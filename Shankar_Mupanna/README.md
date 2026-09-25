# Real-Time Multiplayer Live Quiz Battle (Socket.io)

An authoritative, real-time interactive quiz battle arena server built with **Node.js**, **Express.js**, and **Socket.io**. Designed for high-stakes, synchronous multiplayer quiz competitions (similar to Kahoot / Quizizz).

---

## 📌 Features & Key Capabilities
- **Asymmetric Role Management**: Distinct interactive views for **Quiz Host** dashboard and mobile-friendly **Player Game Pad**.
- **PIN-Based Lobby System**: Random 4-digit PIN generation with live lobby roster broadcasts (`lobby:update`).
- **Synchronous Countdown Clocks**: Server-driven countdown timers broadcasting tick updates (`timer:tick`) without client-side drift.
- **Anti-Cheat Validation**:
  - Question options sent to client **omit correct answers & explanations** during active countdowns.
  - Answers submitted after timer expiry or duplicate submissions per question are rejected on the server.
- **Speed-Based Dynamic Scoring**: Speed bonus points (up to 500 points) awarded based on response time down to milliseconds.
- **Live Dynamic Leaderboard**: Instant rank calculations and sorted leaderboards broadcasted after every round.

---

## 🛠️ Tech Stack
- **Runtime**: Node.js
- **Server Framework**: Express.js
- **Real-Time Engine**: Socket.io
- **Utilities**: CORS, dotenv, Nodemon (Dev)

---

## 🏗️ Directory Structure
```
assignment-14-quiz-socket/
├── public/
│   ├── index.html           # Host / Player entry portal
│   ├── host.html            # Host control screen with live question display
│   ├── player.html          # Mobile-friendly 4-color button answer grid
│   └── app.js               # Socket handlers & UI state machine
├── data/
│   └── questions.json       # Question bank
├── sockets/
│   ├── gameEngine.js        # Timers, round transitions & leaderboard sorting
│   └── lobbyHandler.js      # PIN generation & player joining
├── server.js                # Main Express & Socket.io server entry point
├── package.json
└── README.md
```

---

## 📡 Real-Time Socket Event Protocol

### 🎪 Lobby & Game Control
| Event Name | Direction | Payload Schema | Description |
| :--- | :--- | :--- | :--- |
| `quiz:create` | Host -> Server | `{ "hostName": "Professor X", "category": "Tech" }` | Host initializes a quiz room, receives a 4-digit PIN |
| `quiz:created` | Server -> Host | `{ "pin": "8421", "roomId": "quiz_8421" }` | Sends PIN to the host |
| `quiz:join` | Player -> Server | `{ "pin": "8421", "playerName": "Karan" }` | Player enters lobby with PIN |
| `lobby:update` | Server -> Room | `{ "players": [{ "name": "Karan", "score": 0 }] }` | Broadcasts lobby roster as players join |
| `quiz:start` | Host -> Server | `{ "pin": "8421" }` | Host starts the quiz battle |

### ⏱️ Question Round & Live Gameplay
| Event Name | Direction | Payload Schema | Description |
| :--- | :--- | :--- | :--- |
| `question:start` | Server -> Room | `{ "questionIndex": 1, "totalQuestions": 5, "question": "What is Node.js runtime based on?", "options": ["V8", "SpiderMonkey", "Chakra", "JVM"], "timeLimitSeconds": 15 }` | Broadcasted by server. Omits correct answer to prevent cheating! |
| `answer:submit` | Player -> Server | `{ "pin": "8421", "selectedOption": 0, "timeTakenMs": 3200 }` | Player submits chosen option |
| `question:time_up` | Server -> Room | `{ "correctOption": 0, "explanation": "Node.js is built on Google Chrome's V8 engine." }` | Server reveals correct answer |
| `leaderboard:update` | Server -> Room | `{ "leaderboard": [{ "rank": 1, "name": "Karan", "score": 1420 }] }` | Broadcasts sorted rankings |
| `quiz:ended` | Server -> Room | `{ "winner": { "name": "Karan", "score": 4850 }, "finalRanks": [...] }` | Emitted after last question |

---

## 🧮 Server-Side Scoring Algorithm
```js
function calculateScore(isCorrect, timeTakenMs, totalTimeLimitMs = 15000) {
  if (!isCorrect) return 0;
  
  const timeRemaining = Math.max(0, totalTimeLimitMs - timeTakenMs);
  const speedBonus = Math.round((timeRemaining / totalTimeLimitMs) * 500); // Up to 500 bonus points
  const baseScore = 500;
  
  return baseScore + speedBonus; // Total max 1000 points per question
}
```

---

## 🚀 Setup & Execution Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start the Server**:
   ```bash
   npm start
   # Or for development with nodemon:
   npm run dev
   ```

3. **Access Application**:
   - **Entry Portal**: [http://localhost:5000](http://localhost:5000)
   - **Host Dashboard**: [http://localhost:5000/host.html](http://localhost:5000/host.html)
   - **Player Controller**: [http://localhost:5000/player.html](http://localhost:5000/player.html)

---

## 🧪 Testing & Verification Guide

1. Start server on `http://localhost:5000`.
2. Open Host View on Tab 1 (`http://localhost:5000/host.html`). Click **Create Quiz Room** and note the 4-digit PIN.
3. Open Player View on Tab 2 and Tab 3 (`http://localhost:5000/player.html`). Enter PIN and join as **Player 1** and **Player 2**.
4. Verify that Host View lobby updates dynamically as players join.
5. Click **Start Game** on Host screen.
6. Answer immediately on Player 1 (~2s), and wait 10s on Player 2 before submitting.
7. Verify Player 1 receives a higher score due to response speed bonus.
8. Verify neither player can submit an answer after the 15-second timer runs out.
9. Verify server-controlled timer countdown and reveal screen with live sorted leaderboard.
