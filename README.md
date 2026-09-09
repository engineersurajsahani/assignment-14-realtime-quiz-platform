# Assignment 14 - Real-Time Multiplayer Live Quiz Battle


## Overview

A real-time multiplayer trivia and quiz battle application built using Node.js, Express.js and Socket.io.

The application provides a host-controlled quiz environment where multiple players can join using a PIN, answer questions in real time, receive speed-based scores and compete on a live leaderboard.

## Features

- Real-time multiplayer quiz battles
- Host and player roles
- PIN-based quiz room creation
- Multiple players in a quiz room
- Server-controlled question timers
- Synchronized question rounds
- Real-time answer submission
- Server-side answer validation
- Anti-cheat timer validation
- Speed-based scoring
- Live leaderboard updates
- Automatic question transitions
- Final winner calculation
- Host dashboard
- Player-friendly quiz interface
- In-memory game state management
- Question bank using JSON

## Tech Stack

- Node.js
- Express.js
- Socket.io
- CORS
- dotenv
- HTML5
- CSS3
- JavaScript

## Game Flow

```text
Host Creates Quiz
        |
        v
Quiz Room PIN Generated
        |
        v
Players Join Using PIN
        |
        v
Host Starts Game
        |
        v
Server Broadcasts Question
        |
        v
15-Second Countdown
        |
        v
Players Submit Answers
        |
        v
Server Validates Answers
        |
        v
Speed-Based Score Calculation
        |
        v
Leaderboard Updated
        |
        v
Next Question
        |
        v
Final Winner
