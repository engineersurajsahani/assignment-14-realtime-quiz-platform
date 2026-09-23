# Assignment 14 - Real-Time Multiplayer Live Quiz Battle

A real-time multiplayer trivia battle built with Node.js, Express.js, Socket.io, CORS and an in-memory game state engine.

Live link: https://quiz-socket-57r2.onrender.com


## Features

- Host and player roles
- 4-digit PIN-based quiz rooms
- Multi-player lobby with live roster updates
- Server-authoritative 15-second question timers
- Server-side answer validation and anti-cheat expiry checks
- Speed-based scoring from 500 to 1000 points
- Live leaderboard with rank sorting
- Correct answer and explanation reveal after each round
- Final winner screen
- Sample question bank in `data/questions.json`
- Responsive host dashboard and mobile-friendly player answer grid

## Project Structure

```text
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
├── .env.example
├── .gitignore
└── README.md
```

## Installation

```bash
npm install
```

Create a `.env` file if required:

```env
PORT=5000
```

## Run

Development mode:

```bash
npm run dev
```

Normal mode:

```bash
npm start
```

Open the entry portal:

```text
http://localhost:5000
```

Host view:

```text
http://localhost:5000/host.html
```

Player view:

```text
http://localhost:5000/player.html
```

## Game Flow

1. Host creates a quiz and receives a 4-digit PIN.
2. Players enter the PIN and join the lobby.
3. Host starts the quiz.
4. Server broadcasts each question and starts a 15-second timer.
5. Players submit answers through Socket.io.
6. The server calculates elapsed time and awards speed-based points.
7. Answers after the server timer expires are rejected.
8. Correct answers and explanations are revealed.
9. The leaderboard is sorted and broadcast after every round.
10. After the final question, the winner and final rankings are displayed.

## Scoring

Correct answers receive a base score of 500 plus a speed bonus of up to 500 points.

```text
Score = 500 + round((15000 - timeTakenMs) / 15000 * 500)
```

Incorrect answers receive 0 points.

The server uses its own question start time and receipt time rather than trusting the client's `timeTakenMs` value for scoring.

## Testing

1. Open `host.html` in Tab 1.
2. Create a Tech quiz and note the PIN.
3. Open `player.html` in Tab 2 and Tab 3.
4. Join as Player 1 and Player 2 using the PIN.
5. Start the quiz from the host dashboard.
6. Answer quickly as Player 1.
7. Wait several seconds before answering as Player 2.
8. Verify the faster correct answer receives a higher score.
9. Let a question expire and verify late answers are rejected.
10. Verify the leaderboard updates after each question.
11. Complete the quiz and verify the final winner screen.

## Socket Event Protocol

The implementation supports the assignment event protocol:

- `quiz:create`
- `quiz:created`
- `quiz:join`
- `quiz:joined`
- `lobby:update`
- `quiz:start`
- `question:start`
- `answer:submit`
- `answer:result`
- `question:time_up`
- `leaderboard:update`
- `quiz:ended`
- `quiz:error`

## Notes

Game rooms, players, scores and timers are stored in memory. Restarting the server clears all active quizzes and scores.

## Submission

Repository name:

```text
itm-assignment-14-quiz-socket
```

Include:

- Source code
- `data/questions.json` with sample questions
- README documentation
- A short demo video showing a 3-player quiz battle
