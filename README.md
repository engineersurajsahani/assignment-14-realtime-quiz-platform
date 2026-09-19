# 🧠 Real-Time Multiplayer Live Quiz Battle (Socket.io)

**Student Name:** Prince Yadav  
**Student ID / Enrollment:** 150096725032  
**Live Render Deployment:** [https://assignment-14-realtime-quiz-platform-9912.onrender.com](https://assignment-14-realtime-quiz-platform-9912.onrender.com)  
**GitHub Repository:** [https://github.com/2025prince-control/assignment-14-realtime-quiz-platform](https://github.com/2025prince-control/assignment-14-realtime-quiz-platform)  
**Track:** Backend & Real-Time Web  
**Tech Stack:** Node.js, Express.js, Socket.io (4.x), In-Memory Game State Engine, CORS, Web Audio API  

---

## 📌 1. Project Overview & Architecture

This project delivers a high-stakes, interactive **Real-Time Multiplayer Trivia & Quiz Battle Arena** (similar to Kahoot / Quizizz) built using **Node.js**, **Express.js**, and **Socket.io**.

The system features an **authoritative backend game engine** that synchronizes question countdown clocks across all connected participants, validates player submissions with speed-based score bonuses, prevents cheating, and broadcasts live dynamic leaderboards round-by-round.

### 🌟 Core Capabilities
- **Authoritative In-Memory Game Engine**: State machine (`LOBBY` ➔ `QUESTION` ➔ `TIME_UP` ➔ `LEADERBOARD` ➔ `ENDED`) managing synchronized rounds without client-side clock drift.
- **PIN-Based Multi-Room Management**: Dynamic 4-digit numeric room PIN generation, room isolation, and live player roster broadcasting (`lobby:update`).
- **Strict Anti-Cheat Server Validation**:
  - Answers submitted after the 15-second timer concludes are rejected server-side.
  - `correctOption` and `explanation` are omitted from `question:start` broadcasts to prevent client inspection.
  - Authoritative elapsed time calculation prevents clients from forging response speeds.
- **Millisecond Speed-Based Scoring**: Correct answers dynamically reward up to 1,000 points ($500 \text{ base} + \text{up to } 500 \text{ speed bonus}$) based on server-verified reaction speed.
- **Dual High-Fidelity Responsive Interfaces**:
  - **Host Arena Dashboard (`host.html`)**: Big-screen Kahoot presentation view featuring large 4-digit PIN, live player roster chips, circular 15-second countdown timer, option response distribution bar chart, Top-3 podium, and victory confetti.
  - **Player Mobile Gamepad (`player.html`)**: Mobile-first 4-color geometric touch buttons (Red Triangle, Blue Diamond, Yellow Circle, Green Square), instant haptic feedback, speed badges, and personal round outcomes.
- **Synthesized Audio Engine**: Browser-native Web Audio API synthesizer for countdown ticks, warning pulses, answer locks, chimes, and winner fanfares.
- **Automated CLI Verification Suite (`test-socket.js`)**: End-to-end multi-client simulation verifying PIN generation, scoring formulas, anti-cheat validation, and ranking sorting.

---

## 🏗️ 2. Project Directory Structure

```text
assignment-14/
├── .git/                        # Git repository
├── .gitignore                   # Root gitignore
├── README.md                    # Root project documentation
└── prince yadav 150096725032/    # All Project Files
    ├── .env                     # Server environment variables (PORT=5000)
    ├── .env.example             # Template environment variables
    ├── .gitignore               # Subfolder gitignore
    ├── README.md                # Subfolder documentation
    ├── package.json             # Dependencies and test scripts
    ├── package-lock.json        # Deterministic lockfile
    ├── node_modules/            # Installed npm packages
    ├── server.js                # Express HTTP + Socket.io server entrypoint
    ├── test-socket.js           # CLI automated multi-player test suite
    ├── data/
    │   └── questions.json       # Categorized trivia question bank
    ├── sockets/
    │   ├── lobbyHandler.js      # Room PIN generation, player join/leave & roster updates
    │   └── gameEngine.js        # Timers, anti-cheat, speed scoring & leaderboard sorting
    └── public/
        ├── index.html           # Landing portal (Host vs Player selection & quick join)
        ├── host.html            # Big-screen Kahoot presentation screen
        ├── player.html          # Mobile-friendly 4-color geometric gamepad
        └── app.js               # Web Audio synthesizer, toasts, and confetti engine
```

---

## 🎮 3. Game Flow & State Machine

```mermaid
stateDiagram-v2
    [*] --> LOBBY : Host Emits quiz:create (Receives 4-digit PIN)
    LOBBY --> LOBBY : Players Join with PIN (lobby:update)
    LOBBY --> QUESTION : Host Clicks Start (quiz:start)
    
    state QUESTION {
        [*] --> BroadcastQuestion : Server omits correct answer
        BroadcastQuestion --> SynchronizedCountdown : 15s authoritative timer
        SynchronizedCountdown --> AnswerSubmission : Players submit 4-color options
        AnswerSubmission --> AntiCheatCheck : Verify timestamp < 15.5s
    }

    QUESTION --> TIME_UP : Timer Expires or All Players Answered
    
    state TIME_UP {
        [*] --> RevealAnswer : Reveal correct option & explanation
        RevealAnswer --> DistributionChart : Broadcast choice distribution
        DistributionChart --> ComputeScores : Apply Speed Scoring Formula
    }

    TIME_UP --> LEADERBOARD : Broadcast leaderboard:update (3s delay)
    
    state LEADERBOARD {
        [*] --> DisplayPodium : Top 3 podium + full standings
        DisplayPodium --> CheckMoreQuestions : Check currentQuestionIndex
    }

    LEADERBOARD --> QUESTION : More questions remaining
    LEADERBOARD --> ENDED : All rounds completed (quiz:ended)
    
    state ENDED {
        [*] --> GrandWinnerReveal : Confetti + Champion Trophy
    }
    
    ENDED --> [*]
```

---

## 📡 4. Real-Time Socket Event Protocol

### 🎪 Lobby & Game Control
| Event Name | Direction | Payload Schema | Description |
| :--- | :--- | :--- | :--- |
| `quiz:create` | Host ➔ Server | `{ "hostName": "Professor X", "category": "Tech" }` | Host initializes a quiz room, receives a unique 4-digit PIN |
| `quiz:created` | Server ➔ Host | `{ "pin": "8421", "roomId": "quiz_8421" }` | Sends 4-digit PIN and internal room ID to the host |
| `quiz:join` | Player ➔ Server | `{ "pin": "8421", "playerName": "Karan" }` | Player enters lobby using PIN & custom nickname |
| `quiz:joined` | Server ➔ Player | `{ "pin": "8421", "playerName": "Karan", ... }` | Confirms successful entrance to the player |
| `lobby:update` | Server ➔ Room | `{ "players": [{ "name": "Karan", "score": 0 }] }` | Broadcasts lobby roster as players connect/disconnect |
| `quiz:start` | Host ➔ Server | `{ "pin": "8421" }` | Host starts the live quiz battle |

### ⏱️ Question Round & Live Gameplay
| Event Name | Direction | Payload Schema | Description |
| :--- | :--- | :--- | :--- |
| `question:start` | Server ➔ Room | `{ "questionIndex": 1, "totalQuestions": 5, "question": "What is Node.js runtime based on?", "options": ["V8", "SpiderMonkey", "Chakra", "JVM"], "timeLimitSeconds": 15 }` | **Omits `correctOption` and `explanation`** to prevent client-side inspection / cheating |
| `answer:submit` | Player ➔ Server | `{ "pin": "8421", "selectedOption": 0, "timeTakenMs": 3200 }` | Player submits chosen option and client elapsed time |
| `answer:acknowledged`| Server ➔ Player | `{ "selectedOption": 0, "timeTakenMs": 3200 }` | Server acknowledges receipt and locks the gamepad |
| `answer:rejected` | Server ➔ Player | `{ "reason": "Time expired! Answer submitted after clock ran out." }` | Anti-cheat rejection for late submissions or non-active rounds |
| `answer:count_update`| Server ➔ Host | `{ "answeredCount": 2, "totalPlayers": 3 }` | Live answer progress counter for host dashboard |
| `question:time_up` | Server ➔ Room | `{ "correctOption": 0, "explanation": "...", "stats": { "optionCounts": [3, 0, 0, 1] } }` | Server reveals correct answer, explanation, and answer distribution |
| `answer:result` | Server ➔ Player | `{ "isCorrect": true, "scoreAdded": 920, "totalScore": 920, "streak": 1 }` | Targeted personal outcome sent to each participant |
| `leaderboard:update` | Server ➔ Room | `{ "leaderboard": [{ "rank": 1, "name": "Karan", "score": 1420 }] }` | Broadcasts sorted rankings and round point deltas |
| `quiz:ended` | Server ➔ Room | `{ "winner": { "name": "Karan", "score": 4850 }, "finalRanks": [...] }` | Emitted after last question round concludes |

---

## 🌐 5. RESTful API Reference

| Method | Endpoint | Description | Sample Response |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service health, uptime, and active rooms count | `{"status":"healthy","uptimeSeconds":120,"activeRooms":1}` |
| `GET` | `/api/rooms` | Inspect all active quiz rooms, host, and player count | `{"success":true,"count":1,"rooms":[{...}]}` |
| `GET` | `/api/questions/meta`| Returns total question count and available categories | `{"totalQuestions":8,"categories":["Backend", ...]}` |

---

## 🧮 6. Server-Side Scoring & Anti-Cheat Validation

### Dynamic Speed-Based Scoring Algorithm
```javascript
// Score = Base (500) + Speed Bonus (up to 500)
function calculateScore(isCorrect, timeTakenMs, totalTimeLimitMs = 15000) {
  if (!isCorrect) return 0;
  
  const timeRemaining = Math.max(0, totalTimeLimitMs - timeTakenMs);
  const speedBonus = Math.round((timeRemaining / totalTimeLimitMs) * 500);
  const baseScore = 500;
  
  return baseScore + speedBonus; // Total max 1000 points per question
}
```

- **Instant Correct Answer ($0\text{ ms}$)**: $500 + 500 = \mathbf{1,000 \text{ points}}$ (Max per question)
- **Mid-Speed Correct Answer ($7,500\text{ ms}$)**: $500 + 250 = \mathbf{750 \text{ points}}$
- **Slow Correct Answer ($15,000\text{ ms}$)**: $500 + 0 = \mathbf{500 \text{ points}}$
- **Incorrect Answer**: $\mathbf{0 \text{ points}}$

### Anti-Cheat Protections
1. **Server Timestamp Tracking**: The server stores `roundStartTime = Date.now()`. When a submission arrives, elapsed time is computed server-side:
   $$\text{serverElapsedMs} = \text{Date.now()} - \text{roundStartTime}$$
2. **Timer Expiry Enforcement**: Submissions received after $\text{timeLimit} + 500\text{ms}$ network grace period are rejected with `answer:rejected`.
3. **Anti-Spoofing Time Delta**: Verified elapsed time is used for scoring to prevent clients from forging `{ timeTakenMs: 1 }`.
4. **Duplicate Submission Shield**: Only one answer submission is permitted per socket per question round.
5. **Information Hiding**: Correct options and explanations are never sent during question broadcast.

---

## 🚀 7. Local Setup & Execution

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** (v9 or higher)

### Installation & Run
```bash
# 1. Navigate to the project folder
cd "prince yadav 150096725032"

# 2. Install dependencies
npm install

# 3. Start the server
npm start

# Or with automatic reload during development:
npm run dev
```

The server listens on `PORT` (default `5000`, with automatic fallback to `5001` if macOS AirPlay Receiver is active).

---

## 👨‍💻 Student Information
- **Name:** Prince Yadav
- **Student ID:** 150096725032
- **Live Deployment:** [https://assignment-14-realtime-quiz-platform-9912.onrender.com](https://assignment-14-realtime-quiz-platform-9912.onrender.com)
- **GitHub Repository:** [https://github.com/2025prince-control/assignment-14-realtime-quiz-platform](https://github.com/2025prince-control/assignment-14-realtime-quiz-platform)
