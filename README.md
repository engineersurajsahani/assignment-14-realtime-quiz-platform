# 🧠 Assignment 14: Real-Time Multiplayer Live Quiz Battle (Socket.io)

**Name:** Rishi Thakker
**Roll No:** 150096725068
**Cohort:** Sam Altman

**Deployed Link:** https://assignment-14-realtime-quiz-platform-v3nx.onrender.com/

A Kahoot-style live multiplayer quiz built with **Node.js, Express, and Socket.io**. One host creates a room and gets a 4-digit PIN, players join with it, and the server runs the whole game authoritatively — questions, countdown, scoring, and anti-cheat all live server-side so a client can't fake a faster answer or a higher score.

## Features
- PIN-based lobby: host creates a room, players join with the PIN
- Server-driven 15-second question timer — the countdown shown to players is just a visual clock; the server enforces the real cutoff independently, so client-side drift or tampering can't extend it
- Anti-cheat: answers submitted after the timer fires, or a second answer in the same round, are silently rejected
- Speed-based scoring exactly per the spec's formula (500 base + up to 500 speed bonus, 0 if wrong)
- Live leaderboard after every round, final standings + winner at the end
- Separate host dashboard and player answer-grid views

## Implementation notes
- **Question flow between rounds isn't ticking clients live during the pause** — after a round ends, the server waits 5 seconds (showing the correct answer + leaderboard) before auto-starting the next question. The spec's state machine implies this pause but doesn't name an event for it or specify its length, so this is a reasonable default, not a literal spec event.
- **Category matching** on `quiz:create` falls back to the full question bank if no questions match the given category, so testing with any category string always works rather than silently returning zero questions.
- `data/questions.json` ships with 6 sample "Tech" questions, matching the assignment's own example question.

## Real-Time Event Protocol
Matches the spec's protocol tables exactly — `quiz:create`, `quiz:created`, `quiz:join`, `lobby:update`,
`quiz:start`, `question:start`, `answer:submit`, `question:time_up`, `leaderboard:update`, `quiz:ended`.
One addition: `quiz:error` (Server → Client), `{ message }` — used only to tell a player their PIN was
invalid or the quiz already started, since the spec's `quiz:join` has no built-in rejection path.

## Folder Structure
```text
rishi-thakker-068-assignment-14/
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
├── package.json
├── server.js
└── README.md
```
