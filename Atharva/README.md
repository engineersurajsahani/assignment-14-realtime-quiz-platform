# ⚡ Assignment 14: Real-Time Multiplayer Live Quiz Battle

A Kahoot/Quizizz-style real-time multiplayer quiz application built with Node.js, Express.js and Socket.IO.

## 🚀 Features

* Host creates a quiz with a unique 4-digit PIN
* Players join using the PIN
* Real-time lobby updates
* Host-controlled quiz start
* Server-authoritative 15-second question timer
* Players can answer only once per question
* Answers submitted after the server timer expires are rejected
* Speed-based scoring
* Live leaderboard
* Correct answer and explanation reveal
* Final leaderboard
* In-memory game state
* Render-ready deployment

## 🛠️ Tech Stack

* Node.js
* Express.js
* Socket.IO
* CORS
* dotenv
* HTML
* CSS
* JavaScript

## 📁 Project Structure

```text
assignment-14-quiz-socket/
├── public/
│   ├── index.html
│   ├── host.html
│   ├── player.html
│   └── style.css
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

## ▶️ Run Locally

```bash
npm install
npm start
```

Open:

```text
http://localhost:5001
```

Host:

```text
http://localhost:5001/host.html
```

Player:

```text
http://localhost:5001/player.html
```

## 🔢 Scoring

Correct answers receive:

```text
Base score = 500
Maximum speed bonus = 500
```

Therefore:

* Instant correct answer = 1000 points
* Correct answer at 15 seconds = 500 points
* Wrong answer = 0 points

Formula:

```text
timeRemaining = max(0, 15000 - timeTakenMs)
speedBonus = round((timeRemaining / 15000) * 500)
score = 500 + speedBonus
```

The server calculates the actual answer time using its own clock. The client-provided `timeTakenMs` is not trusted for scoring.

## 🌐 Live Deployment

### Frontend

```text
https://assignment-14-realtime-quiz-platfor.vercel.app/
```

### Backend

```text
https://assignment-14-realtime-quiz-platform-1-e30g.onrender.com
```

The frontend communicates with the deployed Socket.IO backend for real-time multiplayer functionality.

## 🚀 Render Deployment

Create a Web Service on Render.

Build Command:

```bash
npm install
```

Start Command:

```bash
npm start
```

Environment variable:

```text
CORS_ORIGIN=*
```

Do not hard-code the Render port. The application automatically uses Render's `PORT` environment variable.

## 🔌 Socket Events

### Host

```text
quiz:create
quiz:start
```

### Player

```text
quiz:join
answer:submit
```

### Server Broadcasts

```text
quiz:created
quiz:joined
lobby:update
quiz:started
question:start
answer:result
question:time_up
leaderboard:update
quiz:ended
quiz:error
```

## ⚠️ Important

Game state is stored in memory. Restarting the Node.js server removes all active quiz rooms.

For this assignment, this is intentional and no database is required.

