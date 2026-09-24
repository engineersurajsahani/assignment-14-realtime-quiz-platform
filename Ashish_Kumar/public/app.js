// Client shared helper functions for QuizBattle

document.addEventListener("DOMContentLoaded", () => {
  // Focus PIN input on landing page if present
  const pinInput = document.getElementById("pin");
  if (pinInput) {
    pinInput.focus();
  }
});
