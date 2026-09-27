# 🧠 Real-Time Multiplayer Live Quiz Battle

A high-stakes, interactive Real-Time Multiplayer Trivia & Quiz Battle Arena using Socket.io and Express.js.

## 👨‍🎓 Student Details

**Name:** Harsh Kumar  
**Roll No.:** 150096725105  
**Course:** BTech CSE  
**Assignment:** 14 — Real-Time Multiplayer Live Quiz Battle (Socket.io)  

## ✨ Features

- **Multiplayer Quiz Arena:** Host creates a room (with a PIN), and players join to compete.
- **Synchronous Timers:** Synchronized server-driven countdown clocks for answering questions.
- **Dynamic Scoring:** Calculates score based on correct answers and the millisecond response speed.
- **Live Leaderboard:** Broadcasts live leaderboard rankings after every question round.
- **Anti-Cheat:** Server rejects any answers submitted after the timer has expired.

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js
- **Real-Time Engine:** Socket.io
- **Frontend:** Vanilla JS, HTML, CSS

## 📁 Project Structure

```text
Harsh-Assignment-14-Realtime-Quiz-Platform/
├── public/
│   ├── index.html           # Host / Player entry portal
│   ├── host.html            # Host control screen with live question display
│   ├── player.html          # Mobile-friendly 4-color button answer grid
│   └── app.js               # Socket handlers
├── data/
│   └── questions.json       # Question bank
├── sockets/
│   ├── gameEngine.js        # Timers, round transitions & leaderboard sorting
│   ├── gameStore.js         # Game state management and scoring logic
│   └── lobbyHandler.js      # PIN generation & player joining
├── .env.example
├── .gitignore
├── package.json
└── server.js
```

## 🚀 Getting Started

### Prerequisites

- Node.js installed on your machine

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/harsh4421/Harsh-Assignment-14-Realtime-Quiz-Platform.git
   ```

2. Navigate to the project directory:
   ```bash
   cd Harsh-Assignment-14-Realtime-Quiz-Platform
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the server:
   ```bash
   npm start
   ```

   For development with nodemon:
   ```bash
   npm run dev
   ```

5. **How to Play:**
   - Open a browser to `http://localhost:5000` and click **Create Game (Host)**. A PIN will be generated.
   - Open additional browser windows to `http://localhost:5000` and click **Join as Player**. Enter the PIN and a nickname.
   - On the Host screen, click **Start Game**.
   - Players must answer questions quickly on their screen. The faster you answer correctly, the more points you earn!
