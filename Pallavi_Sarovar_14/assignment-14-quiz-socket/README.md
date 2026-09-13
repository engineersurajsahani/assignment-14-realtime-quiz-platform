# 🧠 Assignment 14: Real-Time Multiplayer Live Quiz Battle (Socket.io)

A real-time multiplayer trivia arena built with **Node.js, Express.js and Socket.io**. It implements the assignment requirements: host/player roles, PIN-based rooms, server-controlled 15-second rounds, server-side speed scoring, anti-cheat validation, live leaderboard updates, and a final winner screen.

## ✨ What is included

- Host creates a quiz room and receives a 4-digit PIN.
- Players join the lobby with the PIN.
- Host cannot start until at least one player has joined.
- Server starts every question and owns the authoritative timer.
- Correct answers earn a base score plus a speed bonus.
- The server ignores the client's claimed response time and calculates elapsed time itself.
- Duplicate answers are rejected.
- Answers submitted after the server's 15-second limit are rejected.
- Leaderboard is sorted and broadcast after every answer.
- Correct answer is revealed when the round ends.
- Quiz automatically moves to the next question and ends with final rankings.
- Responsive host dashboard and mobile-friendly player answer pad.
- UI uses a soft editorial palette inspired by the supplied reference: dusty rose, lavender, coral, plum, warm white and deep ink — no traditional blue/green/orange dashboard styling.

## 🛠️ Tech Stack

- Node.js
- Express.js
- Socket.io
- CORS
- dotenv
- In-memory game state
- HTML / CSS / Vanilla JavaScript

## 📁 Directory Structure

```text
assignment-14-quiz-socket/
├── public/
│   ├── index.html
│   ├── host.html
│   ├── player.html
│   ├── styles.css
│   ├── host.js
│   └── player.js
├── data/
│   └── questions.json
├── sockets/
│   ├── gameEngine.js
│   └── lobbyHandler.js
├── server.js
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## 🚀 Setup

### 1. Install Node.js

Use a current LTS release of Node.js.

### 2. Open the project folder

```bash
cd assignment-14-quiz-socket
```

### 3. Install dependencies

```bash
npm install
```

### 4. Start the server

```bash
npm run dev
```

Or:

```bash
npm start
```

The application runs at:

```text
http://localhost:5000
```

## 🎮 Testing / Verification

1. Open `http://localhost:5000/host.html` in Tab 1.
2. Enter a host name and create a quiz.
3. Copy the 4-digit PIN shown in the host dashboard.
4. Open `http://localhost:5000/player.html` in Tab 2 and join with Player 1.
5. Open another player tab and join with Player 2.
6. Return to the host tab and click **Start Game**.
7. Answer quickly as Player 1.
8. Wait several seconds and answer as Player 2.
9. Confirm that a correct faster answer earns more points.
10. Leave a question unanswered until the timer reaches zero and confirm the server reveals the correct answer.
11. Confirm that the leaderboard changes live on the host screen.
12. Complete all five questions and confirm the final winner/ranking screen appears.

## 🧮 Scoring

```text
Base score = 500
Maximum speed bonus = 500
Maximum per question = 1000

speedBonus = round((timeRemaining / 15000) * 500)
score = 500 + speedBonus
```

An incorrect answer receives `0` points.

The client does **not** decide whether a submission is late. The server calculates:

```text
serverElapsedTime = Date.now() - questionStartedAt
```

and rejects submissions after 15 seconds.

## 📡 Socket Event Protocol

### Lobby & Game Control

| Event | Direction | Purpose |
|---|---|---|
| `quiz:create` | Host → Server | Creates a room and requests a PIN |
| `quiz:created` | Server → Host | Returns the 4-digit PIN and room ID |
| `quiz:join` | Player → Server | Joins a room using its PIN |
| `quiz:joined` | Server → Player | Confirms the player joined |
| `lobby:update` | Server → Room | Broadcasts the current roster |
| `quiz:start` | Host → Server | Starts the quiz |

### Gameplay

| Event | Direction | Purpose |
|---|---|---|
| `question:start` | Server → Room | Sends a question without the correct answer |
| `answer:submit` | Player → Server | Sends the selected option |
| `answer:result` | Server → Player | Returns correctness, points and server-measured response time |
| `player:answered` | Server → Room | Shows answer progress |
| `question:time_up` | Server → Room | Reveals the correct answer |
| `leaderboard:update` | Server → Room | Sends sorted rankings |
| `quiz:ended` | Server → Room | Sends the winner and final ranks |
| `quiz:error` | Server → Client | Sends validation or room errors |

## 🔐 Anti-Cheat Notes

The player UI never sends an authoritative `timeTakenMs`. It only sends the selected option. The server records the exact question start time and calculates elapsed time itself. This prevents a client from simply reporting a faster response time.

The server also rejects:

- answers after the timer expires;
- duplicate submissions for the same question;
- invalid option indexes;
- players attempting to start a quiz;
- starting a quiz with an empty lobby.

## 🎨 UI Direction

The interface intentionally avoids the typical Kahoot/Discord/Slack-style dashboard look. It uses:

- warm off-white surfaces;
- dusty rose and muted lavender panels;
- coral-to-plum gradients;
- deep ink typography;
- oversized editorial headings;
- rounded glass cards;
- minimal status pills;
- large, tactile answer buttons;
- responsive layouts for host and player screens.

## 📤 Submission

Repository name required by the assignment:

```text
itm-assignment-14-quiz-socket
```

Include:

- source code;
- `data/questions.json` sample question bank;
- a short video demonstrating a 3-player battle.
