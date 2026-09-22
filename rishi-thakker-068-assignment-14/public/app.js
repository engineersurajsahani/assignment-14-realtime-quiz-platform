(() => {
  const page = document.body.dataset.page;
  const socket = io();

  let countdownInterval = null;

  function startCountdown(seconds, displayEl) {
    clearInterval(countdownInterval);
    let remaining = seconds;
    displayEl.textContent = `${remaining}s`;
    countdownInterval = setInterval(() => {
      remaining -= 1;
      displayEl.textContent = `${Math.max(remaining, 0)}s`;
      if (remaining <= 0) clearInterval(countdownInterval);
    }, 1000);
  }

  function renderPlayerList(el, players) {
    el.innerHTML = "";
    players.forEach((p) => {
      const li = document.createElement("li");
      li.textContent = p.name;
      el.appendChild(li);
    });
  }

  function renderLeaderboard(el, leaderboard) {
    el.innerHTML = "";
    leaderboard.forEach((entry) => {
      const li = document.createElement("li");
      li.textContent = `${entry.name} — ${entry.score} pts`;
      el.appendChild(li);
    });
  }

  function showOnly(sectionEl, allSections) {
    allSections.forEach((s) => s.classList.add("hidden"));
    sectionEl.classList.remove("hidden");
  }

  if (page === "host") {
    const createSection = document.getElementById("createSection");
    const lobbySection = document.getElementById("lobbySection");
    const questionSection = document.getElementById("questionSection");
    const resultsSection = document.getElementById("resultsSection");
    const endedSection = document.getElementById("endedSection");
    const allSections = [createSection, lobbySection, questionSection, resultsSection, endedSection];

    const hostNameInput = document.getElementById("hostNameInput");
    const categoryInput = document.getElementById("categoryInput");
    const createButton = document.getElementById("createButton");

    const pinDisplay = document.getElementById("pinDisplay");
    const lobbyPlayerList = document.getElementById("lobbyPlayerList");
    const startButton = document.getElementById("startButton");

    const questionProgress = document.getElementById("questionProgress");
    const timerDisplay = document.getElementById("timerDisplay");
    const questionText = document.getElementById("questionText");
    const optionsList = document.getElementById("optionsList");

    const correctAnswerText = document.getElementById("correctAnswerText");
    const explanationText = document.getElementById("explanationText");
    const leaderboardList = document.getElementById("leaderboardList");

    const winnerText = document.getElementById("winnerText");
    const finalLeaderboardList = document.getElementById("finalLeaderboardList");

    let pin = null;
    let lastOptions = [];

    createButton.addEventListener("click", () => {
      socket.emit("quiz:create", {
        hostName: hostNameInput.value.trim() || "Host",
        category: categoryInput.value.trim() || "Tech",
      });
    });

    socket.on("quiz:created", (data) => {
      pin = data.pin;
      pinDisplay.textContent = pin;
      showOnly(lobbySection, allSections);
    });

    socket.on("lobby:update", ({ players }) => {
      renderPlayerList(lobbyPlayerList, players);
    });

    startButton.addEventListener("click", () => {
      socket.emit("quiz:start", { pin });
    });

    socket.on("question:start", (data) => {
      lastOptions = data.options;
      questionProgress.textContent = `Question ${data.questionIndex} / ${data.totalQuestions}`;
      questionText.textContent = data.question;

      optionsList.innerHTML = "";
      data.options.forEach((opt) => {
        const li = document.createElement("li");
        li.textContent = opt;
        optionsList.appendChild(li);
      });

      startCountdown(data.timeLimitSeconds, timerDisplay);
      showOnly(questionSection, allSections);
    });

    socket.on("question:time_up", ({ correctOption, explanation }) => {
      clearInterval(countdownInterval);
      correctAnswerText.textContent = lastOptions[correctOption];
      explanationText.textContent = explanation;
      showOnly(resultsSection, allSections);
    });

    socket.on("leaderboard:update", ({ leaderboard }) => {
      renderLeaderboard(leaderboardList, leaderboard);
    });

    socket.on("quiz:ended", ({ winner, finalRanks }) => {
      winnerText.textContent = winner
        ? `🏆 ${winner.name} wins with ${winner.score} points!`
        : "No players finished the quiz.";
      renderLeaderboard(finalLeaderboardList, finalRanks);
      showOnly(endedSection, allSections);
    });
  }

  if (page === "player") {
    const joinSection = document.getElementById("joinSection");
    const waitingSection = document.getElementById("waitingSection");
    const questionSection = document.getElementById("questionSection");
    const resultsSection = document.getElementById("resultsSection");
    const endedSection = document.getElementById("endedSection");
    const allSections = [joinSection, waitingSection, questionSection, resultsSection, endedSection];

    const pinInput = document.getElementById("pinInput");
    const playerNameInput = document.getElementById("playerNameInput");
    const joinButton = document.getElementById("joinButton");
    const joinError = document.getElementById("joinError");

    const lobbyPlayerList = document.getElementById("lobbyPlayerList");

    const questionProgress = document.getElementById("questionProgress");
    const timerDisplay = document.getElementById("timerDisplay");
    const questionText = document.getElementById("questionText");
    const answerButtons = Array.from(document.querySelectorAll(".answerButton"));
    const lockedInText = document.getElementById("lockedInText");

    const feedbackText = document.getElementById("feedbackText");
    const roundScoreText = document.getElementById("roundScoreText");
    const totalScoreText = document.getElementById("totalScoreText");
    const explanationText = document.getElementById("explanationText");

    const winnerText = document.getElementById("winnerText");
    const myFinalRankText = document.getElementById("myFinalRankText");

    let pin = null;
    let myName = "";
    let hasJoined = false;
    let questionStartedAt = null;
    let mySelectedOption = null;
    let myScore = 0;

    joinButton.addEventListener("click", () => {
      pin = pinInput.value.trim();
      myName = playerNameInput.value.trim();

      if (!pin || !myName) {
        joinError.textContent = "Enter both a PIN and your name.";
        return;
      }

      joinError.textContent = "";
      hasJoined = true;
      socket.emit("quiz:join", { pin, playerName: myName });
    });

    socket.on("quiz:error", ({ message }) => {
      hasJoined = false;
      joinError.textContent = message;
    });

    socket.on("lobby:update", ({ players }) => {
      if (hasJoined) {
        showOnly(waitingSection, allSections);
      }
      renderPlayerList(lobbyPlayerList, players);
    });

    socket.on("question:start", (data) => {
      questionProgress.textContent = `Question ${data.questionIndex} / ${data.totalQuestions}`;
      questionText.textContent = data.question;
      questionStartedAt = Date.now();
      mySelectedOption = null;

      answerButtons.forEach((btn, i) => {
        btn.textContent = data.options[i] || "";
        btn.disabled = false;
      });
      lockedInText.classList.add("hidden");

      startCountdown(data.timeLimitSeconds, timerDisplay);
      showOnly(questionSection, allSections);
    });

    answerButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (mySelectedOption !== null) return; // already answered

        mySelectedOption = Number(btn.dataset.index);
        const timeTakenMs = Date.now() - questionStartedAt;

        answerButtons.forEach((b) => (b.disabled = true));
        lockedInText.classList.remove("hidden");

        socket.emit("answer:submit", { pin, selectedOption: mySelectedOption, timeTakenMs });
      });
    });

    socket.on("question:time_up", ({ correctOption, explanation }) => {
      clearInterval(countdownInterval);

      if (mySelectedOption === null) {
        feedbackText.textContent = "⏱️ Time's up — you didn't answer";
      } else if (mySelectedOption === correctOption) {
        feedbackText.textContent = "✅ Correct!";
      } else {
        feedbackText.textContent = "❌ Wrong answer";
      }
      explanationText.textContent = explanation;
      roundScoreText.textContent = "";
      totalScoreText.textContent = "";
      showOnly(resultsSection, allSections);
    });

    socket.on("leaderboard:update", ({ leaderboard }) => {
      const me = leaderboard.find((entry) => entry.name === myName);
      if (!me) return;

      const roundGain = me.score - myScore;
      myScore = me.score;

      roundScoreText.textContent = `+${roundGain} points this round`;
      totalScoreText.textContent = `Total: ${myScore} points`;
    });

    socket.on("quiz:ended", ({ winner, finalRanks }) => {
      winnerText.textContent = winner
        ? `🏆 ${winner.name} wins with ${winner.score} points!`
        : "Quiz ended.";

      const mine = finalRanks.find((entry) => entry.name === myName);
      myFinalRankText.textContent = mine
        ? `You finished #${mine.rank} with ${mine.score} points`
        : "";

      showOnly(endedSection, allSections);
    });
  }
})();
