# Assignment 14: Real-Time Multiplayer Live Quiz Battle (Socket.io)

**Student Name:** Aditya Kumbhar  
**Roll No:** 187  
**Track:** Backend & Real-Time Web  
**Tech Stack:** Node.js, Express.js, Socket.io, In-Memory Game State Engine, CORS, Dotenv  
Live Link: https://assignment-14-realtime-quiz-platform-faaq.onrender.com/
---

## 📌 1. Project Overview

This project is an interactive **Real-Time Multiplayer Trivia & Quiz Battle Arena** (similar to Kahoot & Quizizz) built with **Node.js, Express.js, and Socket.io**. It features an authoritative game server that manages room PIN generation, synchronous question countdown clocks, speed-based dynamic scoring, anti-cheat time validations, and live leaderboard rankings broadcasted in real time across hosts and players.

---

## 🎮 2. Game Flow & State Machine

```
[Host Creates Room (PIN)] 
        ⬇
[Players Join Lobby via PIN] 
        ⬇
[Host Clicks "Start Game"] 
        ⬇
[Server Broadcasts Question & Starts 15s Timer] 
        ⬇
[Players Submit Answers (Calculates Speed Score)] 
        ⬇
[Timer Expires ➔ Server Reveals Correct Answer & Broadcasts Live Leaderboard] 
        ⬇
[Next Question or Final Winner Screen]
```

---

## 📡 3. Real-Time Socket Event Protocol

### 🎪 Lobby & Game Control

| Event Name | Direction | Payload Schema | Description |
|---|:---:|---|---|
| `quiz:create` | `Host -> Server` | `{ "hostName": "Host Admin", "category": "Tech" }` | Host initializes a quiz room, receives a 4-digit PIN |
| `quiz:created` | `Server -> Host` | `{ "pin": "8421", "roomId": "quiz_8421" }` | Sends generated PIN to the host |
| `quiz:join` | `Player -> Server` | `{ "pin": "8421", "playerName": "Karan" }` | Player enters lobby with PIN |
| `lobby:update` | `Server -> Room` | `{ "players": [{ "name": "Karan", "score": 0 }] }` | Broadcasts lobby roster as players join |
| `quiz:start` | `Host -> Server` | `{ "pin": "8421" }` | Host starts the quiz battle |

### ⏱️ Question Round & Live Gameplay

| Event Name | Direction | Payload Schema | Description |
|---|:---:|---|---|
| `question:start` | `Server -> Room` | `{ "questionIndex": 1, "totalQuestions": 6, "question": "...", "options": [...], "timeLimitSeconds": 15 }` | Server broadcasts question (omits correct answer to prevent cheating) |
| `answer:submit` | `Player -> Server` | `{ "pin": "8421", "selectedOption": 0, "timeTakenMs": 3200 }` | Player submits selected option |
| `question:time_up` | `Server -> Room` | `{ "correctOption": 0, "explanation": "..." }` | Server reveals correct answer |
| `leaderboard:update`| `Server -> Room` | `{ "leaderboard": [{ "rank": 1, "name": "Karan", "score": 1420 }] }` | Broadcasts live sorted rankings |
| `quiz:ended` | `Server -> Room` | `{ "winner": { "name": "Karan", "score": 4850 }, "finalRanks": [...] }` | Broadcasts champion & podium standings |

---

## 🧮 4. Server-Side Scoring Algorithm

Score consists of a base score plus a response speed bonus:

$$\text{Total Score} = \text{Base Score (500)} + \left(\frac{\text{Time Remaining}}{\text{Total Time (15s)}} \times 500\right)$$

- Correct answer within 0s: **1000 points** (max)
- Correct answer with 5s remaining: **667 points**
- Incorrect answer: **0 points**

---

## 📁 5. Directory Structure

```text
Aditya Kumbhar 187, assignment 14/
├── public/
│   ├── index.html           # Host / Player entry portal
│   ├── host.html            # Host control screen with live question display & leaderboard
│   ├── player.html          # Mobile-friendly 4-color button answer pad
│   ├── style.css            # Kahoot-inspired colorful styles
│   └── app.js               # Client shared utilities
├── data/
│   └── questions.json       # Question bank
├── sockets/
│   ├── gameEngine.js        # Timers, round transitions & leaderboard sorting
│   └── lobbyHandler.js      # PIN generation & player joining
├── server.js                # Express & Socket.io server bootstrap
├── package.json
├── .env
├── .env.example
├── .gitignore
└── README.md
```

---

## 🚀 6. Setup & Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file (or copy from `.env.example`):
```env
PORT=5001
```

### 3. Start Server
```bash
# Start server with node
npm start

# Or with nodemon in development mode
npm run dev
```

---

## 🧪 7. Testing & Verification

1. Start server and open `http://localhost:5001/host.html` on Tab 1. Note the 4-digit PIN generated on the Host screen.
2. Open Player View on Tab 2 and Tab 3 (`http://localhost:5001/player.html`). Enter the PIN and join as "Player 1" and "Player 2".
3. Verify both player names appear in real time on the Host screen roster.
4. Click **Start Game** on the Host screen.
5. Answer quickly on Player 1 and wait 10 seconds before answering on Player 2.
6. Verify Player 1 receives higher points due to the speed bonus.
7. Verify answers cannot be submitted after the 15-second clock expires.
