# Real-Time Multiplayer Live Quiz Battle (Socket.io)

An authoritative Kahoot/Quizizz-style real-time multiplayer live trivia battle arena built with **Node.js**, **Express.js**, **Socket.io**, and modern glassmorphic web UIs.

---

## 🚀 Features & Architecture

- **Authoritative Server Timers**: Server controls question timers to eliminate client-side clock drift.
- **Asymmetric Dual Interfaces**:
  - **Host Screen (`/host.html`)**: Big screen presentation dashboard with PIN code, live player roster, question displays, reveal animations, and live round leaderboards.
  - **Player Game Pad (`/player.html`)**: Mobile-first 4-color option grid (Red ▲, Blue ◆, Yellow ●, Green ■) with instant client-side submission locks and live score feedback.
- **Dynamic Speed-Based Scoring**: Correct answers earn a base score of 500 points plus up to 500 additional speed bonus points (maximum 1000 points per question).
- **Anti-Cheat Validation**:
  - Answers submitted after timer expiration are strictly rejected server-side.
  - Duplicate answer submissions per round are blocked.
  - Correct answer indices and explanations are never sent to clients until the server timer expires.
- **Real-Time Leaderboards**: Automatically sorted descending by total score and broadcast across all connected devices after each round.

---

## 📁 Required Directory Structure

```
assignment-14-realtime-quiz-platform/
└── Janmesh_Rohida/
    ├── public/
    │   ├── index.html        # Entry portal: choose Host or Player
    │   ├── host.html         # Host control screen with live question display & leaderboard
    │   ├── player.html       # Mobile-friendly 4-color button answer grid
    │   ├── styles.css        # Shared glassmorphic design system
    │   └── app.js            # Socket handlers & UI timer helpers
    ├── data/
    │   └── questions.json    # Question bank
    ├── sockets/
    │   ├── gameEngine.js     # Timers, round transitions, speed scoring & leaderboard
    │   └── lobbyHandler.js   # PIN generation & player joining logic
    ├── server.js             # Express + Socket.io server setup
    ├── package.json          # Node dependencies
    ├── .env.example          # Environment variable template
    ├── .gitignore            # Git exclusions
    └── README.md             # Documentation & verification guide
```

---

## 🛠️ Installation & Setup

1. **Navigate to the project root directory**:
   ```bash
   cd assignment-14-realtime-quiz-platform/Janmesh_Rohida
   ```

2. **Install Node dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables** (Optional):
   Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   *or for production mode:*
   ```bash
   npm start
   ```

5. **Access the Web Interfaces**:
   - **Entry Portal**: `http://localhost:5000`
   - **Host Screen**: `http://localhost:5000/host.html`
   - **Player Screen**: `http://localhost:5000/player.html`

---

## 📡 Socket Event Protocol

### 1. Lobby & Game Control

| Event | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `quiz:create` | Host ➔ Server | `{ hostName, category }` | Host initializes a new room; server generates a unique 4-digit PIN. |
| `quiz:created` | Server ➔ Host | `{ pin, roomId, category, totalQuestions }` | Confirms room creation and sends PIN to the Host. |
| `quiz:join` | Player ➔ Server | `{ pin, playerName }` | Player attempts to enter lobby using 4-digit PIN. |
| `quiz:joined` | Server ➔ Player | `{ pin, playerName, hostName, category }` | Private confirmation sent to player upon successful join. |
| `lobby:update` | Server ➔ Room | `{ players: [{ name, score }] }` | Broadcasts updated player roster to all room participants. |
| `quiz:start` | Host ➔ Server | `{ pin }` | Host starts the quiz battle (requires Host socket authorization). |

### 2. Question Round & Live Gameplay

| Event | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `question:start` | Server ➔ Room | `{ questionIndex, totalQuestions, question, options, timeLimitSeconds, category }` | Broadcasts new question; **omits correct answer & explanation**. |
| `answer:submit` | Player ➔ Server | `{ pin, selectedOption, timeTakenMs }` | Player submits selected option index. |
| `answer:ack` | Server ➔ Player | `{ isCorrect, pointsGained, totalScore }` | Private acknowledgment sent to submitting player. |
| `question:time_up` | Server ➔ Room | `{ correctOption, explanation }` | Reveals correct answer index and explanation when timer expires. |
| `leaderboard:update` | Server ➔ Room | `{ leaderboard: [{ rank, name, score, lastPointsGained }] }` | Broadcasts sorted player rankings after round reveal. |
| `quiz:ended` | Server ➔ Room | `{ winner: { name, score }, finalRanks: [...] }` | Emitted after the last question; announces champion and final standings. |

---

## 🧮 Server-Side Scoring Algorithm

Implemented in `sockets/gameEngine.js`:

```javascript
function calculateScore(isCorrect, timeTakenMs, totalTimeLimitMs = 15000) {
  if (!isCorrect) return 0;
  
  const timeRemaining = Math.max(0, totalTimeLimitMs - timeTakenMs);
  const speedBonus = Math.round((timeRemaining / totalTimeLimitMs) * 500); // up to 500 speed bonus
  const baseScore = 500;
  
  return baseScore + speedBonus; // Maximum 1000 points per question
}
```

---

## 🧪 Testing & Verification Walkthrough

Follow these steps to test all requirements:

1. **Start the Server**:
   ```bash
   npm start
   ```
   Verify console output confirms server is listening at `http://localhost:5000`.

2. **Create Room as Host**:
   - Open `http://localhost:5000` in Browser Window 1, select **Host a Quiz**, and click **Initialize New Game Room**.
   - Note the generated 4-digit PIN (e.g. `8421`).

3. **Join as Players**:
   - Open `http://localhost:5000` in Browser Window 2 (or Tab 2), enter PIN `8421`, name **"Player 1"**, click **Enter Battle Arena**.
   - Open `http://localhost:5000` in Browser Window 3 (or Tab 3), enter PIN `8421`, name **"Player 2"**, click **Enter Battle Arena**.
   - Verify Host Screen updates the live roster with both players and enables the **Start Game** button.

4. **Verify Speed-Based Scoring**:
   - Host clicks **Start Game**.
   - Question 1 appears.
   - **Player 1** clicks correct option immediately (~1–2 seconds).
   - **Player 2** waits ~10 seconds before clicking the correct option.
   - Observe after reveal: **Player 1** scores ~933–965 points, whereas **Player 2** scores ~666 points due to the speed bonus algorithm.

5. **Verify Anti-Cheat Validation**:
   - Try clicking another answer on Player 1's screen — buttons are locked immediately upon submission.
   - Wait 15 seconds without answering on another question — verify submissions attempted after timer expiration are rejected by the server.

6. **Verify Leaderboard & Winner Screen**:
   - Progress through all 5 questions.
   - Observe live leaderboard sorting after each round.
   - Verify `quiz:ended` emits at the end of question 5, displaying the final Winner Podium screen.
  

Deployment link of my project https://assignment-14-realtime-quiz-platform-gcsn.onrender.com
