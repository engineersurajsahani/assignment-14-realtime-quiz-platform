# 🧠 Real-Time Multiplayer Live Quiz Battle (Assignment 14)

🚀 **Live Deployment Links:**
- **Render:** [https://samarth-assignment-14-realtime-quiz-platform.onrender.com](https://samarth-assignment-14-realtime-quiz-platform.onrender.com)
- **Vercel:** [https://samarth-assignment-14-quiz-app.vercel.app](https://samarth-assignment-14-quiz-app.vercel.app)

---

- **Name:** Samarth Navale
- **Roll No:** 150096725148
- **Cohort:** Sam Altman

---

An interactive **Real-Time Multiplayer Trivia & Quiz Battle Arena** built with **Socket.io** and **Express.js**. Features an authoritative game server with 4-digit PIN lobby management, synchronized question countdown clocks, speed-based dynamic scoring, and live ranked leaderboards.

---

## 🚀 Features

- 🎪 **PIN-Based Lobby Management**: Hosts create rooms generating a 4-digit PIN; players join live via PIN.
- ⏱️ **Synchronous Server Timers**: Server-controlled 15-second countdowns avoiding client clock drift.
- 🛡️ **Anti-Cheat Validation**: Questions broadcast without answers; late answer submissions rejected.
- ⚡ **Dynamic Speed Scoring**: Base points plus millisecond-level speed bonus for fastest correct answers.
- 🏆 **Live Real-Time Leaderboards**: Instant recalculation and broadcasting of rankings after each round.
- 📱 **Dual Interface**: Dedicated Host Screen and mobile-friendly Player Answer Gamepad.

---

## 🛠️ Tech Stack & Dependencies

- **Runtime:** Node.js
- **Framework:** Express.js
- **Real-Time Protocol:** Socket.io
- **Frontend UI:** Vanilla HTML5 & JavaScript

---

## ⚙️ Environment Variables

```env
PORT=5000
NODE_ENV=development
```

---

## 🧪 Testing

```bash
npm install
npm test
```
