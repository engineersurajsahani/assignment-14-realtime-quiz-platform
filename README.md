# 🎯 Real-Time Multiplayer Live Quiz Battle

A real-time multiplayer quiz application built with Node.js, Express.js, and Socket.io.

Players can join a quiz room using a unique PIN, answer questions in real time, compete based on correctness and response speed, and see the leaderboard update after every question.

The game is controlled by a server-side engine that manages rooms, timers, answers, scoring, and game progression.

---

## 🚀 Live Demo

https://assignment-14-quiz-socket.onrender.com/

---

## ✨ Features

- Real-time multiplayer quiz rooms
- Host and Player roles
- Unique 4-digit room PIN
- Real-time lobby updates
- Server-driven 15-second countdown
- Synchronized questions for all players
- Real-time answer submission
- Server-side answer validation
- Late-answer rejection
- Duplicate-answer prevention
- Speed-based scoring
- Live leaderboard updates
- Automatic question progression
- Final winner announcement
- Player connection and disconnection handling
- In-memory game state management
- Responsive user interface

---

## 🎮 How It Works

### Host

1. Open the application.
2. Create a quiz room.
3. Share the generated room PIN with the players.
4. Wait for players to join the lobby.
5. Start the quiz.

### Players

1. Open the application.
2. Enter the room PIN.
3. Enter a player name.
4. Join the lobby.
5. Wait for the host to start the quiz.
6. Answer each question before the timer expires.
7. View the leaderboard after every question.

The server controls the game state and keeps all connected clients synchronized throughout the quiz.

---

## 🏆 Scoring System

Each question can award a maximum of 1000 points.

### Correct Answer

- Base Score: 500 points
- Speed Bonus: Up to 500 points
- Maximum Score: 1000 points

### Incorrect Answer

- Score: 0 points

The faster a player answers correctly, the higher their speed bonus.

### Formula

Time Remaining = Total Time Limit − Time Taken

Speed Bonus = Round((Time Remaining / Total Time Limit) × 500)

Final Score = Base Score + Speed Bonus

---

## 🛡️ Anti-Cheat

The application performs validation on the server to maintain fair gameplay.

- The server controls the question timer.
- Response time is calculated using the server clock.
- Answers submitted after the timer expires are rejected.
- Players cannot submit multiple answers for the same question.
- Correct answers are kept on the server and are not exposed when questions are sent to players.
- Scores are calculated and validated on the server.

---

## 🔌 Socket.io Events

| Event | Purpose |
|---|---|
| quiz:create | Create a new quiz room |
| quiz:created | Return the generated room PIN |
| quiz:join | Join an existing quiz room |
| lobby:update | Update the room lobby |
| quiz:start | Start the quiz |
| question:start | Start and broadcast a question |
| answer:submit | Submit a player's answer |
| question:time_up | Notify clients that the timer has ended |
| leaderboard:update | Broadcast updated scores |
| quiz:ended | Announce final results |

---

## 🏗️ Project Structure

Pallavi_Sarovar_14/

└── assignment-14-quiz-socket/

    ├── public/

    │   ├── index.html

    │   ├── host.html

    │   ├── host.js

    │   ├── player.html

    │   ├── player.js

    │   └── styles.css

    ├── data/

    │   └── questions.json

    ├── docs/

    │   ├── quiz.png

    │   ├── quiz2.png

    │   ├── quiz3.png

    │   ├── quiz4.png

    │   └── quiz5.png

    ├── sockets/

    │   ├── gameEngine.js

    │   └── lobbyHandler.js

    ├── server.js

    ├── package.json

    ├── package-lock.json

    └── .gitignore

---

## ⚙️ Tech Stack

### Backend

- Node.js
- Express.js
- Socket.io
- CORS

### Frontend

- HTML5
- CSS3
- JavaScript
- Socket.io Client

### Storage

- In-memory game state
- JSON-based question bank

No external database is required.

---

## 🚀 Getting Started

### Prerequisites

- Node.js
- npm

### Installation

Navigate to the project directory and install the dependencies.

npm install

### Environment Variables

Create a .env file and configure the required environment variables.

PORT=5000

CLIENT_ORIGIN=http://localhost:5000

### Run the Application

Start the server:

npm start

For development:

npm run dev

The application will be available at:

http://localhost:5000

---

## 🧪 Testing

The application can be tested using multiple browser tabs or windows.

### Multiplayer Test

1. Open one tab as the Host.
2. Create a quiz room.
3. Open additional tabs as Players.
4. Join using the generated room PIN.
5. Start the quiz from the Host interface.
6. Submit answers from the Player interfaces.
7. Observe the synchronized timer and questions.
8. Verify the leaderboard after each question.

### Speed Scoring Test

Have two players answer the same question correctly at different speeds.

The player who answers faster should receive a higher score.

### Anti-Cheat Test

Wait until the 15-second timer expires and attempt to submit an answer.

The server should reject the late submission.

---


## 📚 Learning Outcomes

This project demonstrates:

- Real-time communication using Socket.io
- Multiplayer room management
- Server-side game state management
- Synchronized server timers
- Real-time event broadcasting
- Server-side validation
- Anti-cheat implementation
- Dynamic scoring
- Speed-based scoring
- Live leaderboard management
- Client-server communication
- Real-time game progression

---

## 📄 Assignment

**Assignment 14 — Real-Time Multiplayer Live Quiz Battle**

Built using Node.js, Express.js, and Socket.io as part of the Backend & Real-Time Web track.
