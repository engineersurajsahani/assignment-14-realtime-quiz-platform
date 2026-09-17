# ⚡ Real-Time Multiplayer Trivia & Quiz Battle Arena

An authoritative, low-latency, real-time multiplayer trivia platform (Kahoot/Quizizz style) designed with **Express.js**, **Socket.io**, and a **clean, classy black-and-white monochrome UI**.

---

## 🌟 Key Features & Learning Outcomes

1. **Asymmetric Real-Time Roles**: Dedicated **Host Command Center** (`host.html`) and responsive **Mobile-Friendly Player Gamepad** (`player.html`).
2. **Server-Authoritative Countdown Timers**: Synchronized 15-second round clocks driven exclusively by the server to prevent client-side timer drift.
3. **Anti-Cheat Validation Engine**:
   - Submissions after server round closure are automatically rejected.
   - Client response times (`timeTakenMs`) are strictly clamped to server elapsed time to prevent falsification.
   - Duplicate submissions for the same question are locked and rejected.
   - Correct answers and explanations are withheld on the server until round expiration (`question:time_up`).
4. **Dynamic Speed-Based Scoring**: Correct answers award a base score plus an elapsed millisecond speed bonus (up to 1,000 points per round).
5. **Live Dynamic Leaderboard**: Instant rank calculations with tie handling broadcasted after each round.
6. **Classy Monochrome Aesthetic**: High-contrast, minimalist UI with synthesized Web Audio cues and fluid micro-animations.

---

## 🛠️ Tech Stack & Dependencies

- **Backend**: Node.js, Express.js
- **Real-Time Layer**: Socket.io (WebSocket / Polling fallback)
- **State Management**: Authoritative in-memory state (zero external DB dependency required)
- **Question Store**: `data/questions.json`
- **Frontend**: Vanilla JavaScript (ES6+), Modern Semantic HTML5, Custom CSS3, Web Audio API

---

## 📂 Project Structure

```
Aryaa_Bhadane/
├── public/
│   ├── index.html        # Unified entry portal (Host vs. Player selection)
│   ├── host.html         # Host command center & real-time question projector
│   ├── player.html       # Mobile-responsive 4-choice player gamepad
│   ├── style.css         # Classy monochrome (Black & White) stylesheet
│   └── app.js            # Socket.io client controllers & sound synthesis
├── data/
│   └── questions.json    # Trivia question bank with explanations
├── sockets/
│   ├── lobbyHandler.js   # 4-Digit PIN generation, room creation & lobby roster
│   └── gameEngine.js     # Timers, round transitions, scoring & anti-cheat
├── server.js             # Express + HTTP + Socket.io server entry point
├── package.json          # Node dependencies & run scripts
├── .gitignore            # Git ignore rules (node_modules, .env)
└── README.md             # Documentation, protocol guide & deployment instructions
```

---

## 🔄 Game Flow & State Machine

```
[Host Creates Room (4-Digit PIN)]
               ⬇
[Players Join Lobby via PIN & Nickname]
               ⬇
[Host Clicks "Start Game"]
               ⬇
[Server Broadcasts Question & Starts 15s Timer]
               ⬇
[Players Submit Answers (Speed Bonus Calculated)]
               ⬇
[Timer Expires → Server Reveals Correct Answer & Explanations]
               ⬇
[Server Computes & Broadcasts Live Leaderboard]
               ⬇
[Next Question Round 🔁 OR Final Tournament Winner Podium 🏆]
```

---

## 📡 Real-Time Socket Event Protocol

### 🎪 Lobby & Room Management
| Event Name | Direction | Payload Schema | Description |
| :--- | :--- | :--- | :--- |
| `quiz:create` | Host → Server | `{ "hostName": "Professor X", "category": "Tech" }` | Host initializes a quiz room session. |
| `quiz:created` | Server → Host | `{ "pin": "8421", "roomId": "quiz_8421" }` | Sends unique 4-digit PIN to the host. |
| `quiz:join` | Player → Server | `{ "pin": "8421", "playerName": "Karan" }` | Player enters room lobby with PIN and nickname. |
| `lobby:update` | Server → Room | `{ "players": [{ "name": "Karan", "score": 0 }] }` | Broadcasts live roster as players join/leave. |
| `quiz:start` | Host → Server | `{ "pin": "8421" }` | Host initiates the quiz battle. |

### ⏱️ Question Round & Live Gameplay
| Event Name | Direction | Payload Schema | Description |
| :--- | :--- | :--- | :--- |
| `question:start` | Server → Room | `{ "questionIndex": 1, "totalQuestions": 5, "question": "...", "options": [...], "timeLimitSeconds": 15 }` | Server starts round (omits correct answer). |
| `answer:submit` | Player → Server | `{ "pin": "8421", "selectedOption": 0, "timeTakenMs": 3200 }` | Player submits selected choice. |
| `question:time_up` | Server → Room | `{ "correctOption": 0, "explanation": "..." }` | Server reveals correct answer & explanation. |
| `leaderboard:update` | Server → Room | `{ "leaderboard": [{ "rank": 1, "name": "Karan", "score": 1420 }] }` | Broadcasts sorted rankings after each round. |
| `quiz:ended` | Server → Room | `{ "winner": { "name": "Karan", "score": 4850 }, "finalRanks": [...] }` | Emitted after last question with podium results. |

---

## 🧮 Server-Side Scoring Algorithm

Score evaluation is strictly executed on the server using the formula:

$$\text{Score} = \text{Base Score (500)} + \text{Speed Bonus (up to 500)}$$

```javascript
function calculateScore(isCorrect, timeTakenMs, totalTimeLimitMs = 15000) {
  if (!isCorrect) return 0;
  const timeRemaining = Math.max(0, totalTimeLimitMs - timeTakenMs);
  const speedBonus = Math.round((timeRemaining / totalTimeLimitMs) * 500); // Up to 500 bonus points
  const baseScore = 500;
  return baseScore + speedBonus; // Total max 1000 points per question
}
```

---

## 🛡️ Anti-Cheat & Authority Mechanisms

- **Authoritative Timer**: The countdown is driven by a server `setTimeout`. When the server timer triggers, the round is marked closed (`isQuestionOpen = false`).
- **Late Submission Rejection**: Any submission arriving after round closure or exceeding `(timeLimitMs + 500ms network grace)` is rejected with `answer:rejected`.
- **Duplicate Answer Locking**: Players can only submit one choice per round. Secondary submissions are ignored.
- **Client Time Verification**: Server bounds `timeTakenMs` to `Date.now() - questionStartTime` so modified client timestamps cannot inflate scores.
- **Answer Secrecy**: The `question:start` broadcast excludes `correctOption` and `explanation`; they are only sent upon `question:time_up`.

---

## 🔌 Disconnect Handling Strategy

- **Host Disconnects Mid-Game**:
  - The server immediately stops all active timers (`timer` and `reviewTimer`).
  - Emits `quiz:host_disconnected` to all connected players with an alert notification.
  - The room memory state is cleared to free resources.
- **Player Disconnects**:
  - If in **Lobby state**, the player is removed from the roster and an updated `lobby:update` is broadcasted.
  - If during **Live Gameplay**, the player's connection is safely removed; remaining participants continue uninterrupted, and the leaderboard reflects active standings.

---

## 🚀 Local Installation & Setup

### 1. Prerequisites
- Node.js (v16.x or higher)
- npm

### 2. Navigate to project folder
```bash
cd Desktop/assignment-14-realtime-quiz-platform/Aryaa_Bhadane
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Start Server
For development with auto-reload:
```bash
npm run dev
```

For standard production run:
```bash
npm start
```

Open in your browser:
- **Landing Portal**: `http://localhost:5000`
- **Host Dashboard**: `http://localhost:5000/host.html`
- **Player Gamepad**: `http://localhost:5000/player.html`

---

## 🧪 Step-by-Step Testing & Verification Plan

1. Open **Tab 1 (Host)**: Navigate to `http://localhost:5000/host.html`. Note the generated 4-digit PIN (e.g. `4821`).
2. Open **Tab 2 (Player 1)**: Navigate to `http://localhost:5000/player.html`, enter PIN `4821` and Nickname `Karan`.
3. Open **Tab 3 (Player 2)**: Navigate to `http://localhost:5000/player.html`, enter PIN `4821` and Nickname `Aryaa`.
4. Check Host Tab: Verify both players appear in the **Connected Players** roster and "Start Game" is enabled.
5. Click **"Start Game"** on the Host screen.
6. On **Player 1**, submit the correct answer within **2 seconds** (~930 pts).
7. On **Player 2**, submit the correct answer after **10 seconds** (~660 pts).
8. Verify **Player 1** receives a higher score due to the speed bonus.
9. Verify that after the 15s timer expires, no further answers can be submitted.
10. Confirm dynamic leaderboard displays correct rank order, transitions smoothly to the next question, and concludes with the winner podium.

---
DEPLOYMENT LINK: https://realtime-quiz-platform-9mui.onrender.com/
