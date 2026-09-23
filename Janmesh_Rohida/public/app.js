/**
 * app.js - Shared Socket.io initialization & UI client utilities.
 */

// Initialize Socket.io connection (auto-connects to host origin)
const socket = io();

socket.on('connect', () => {
  console.log('[SOCKET] Connected to Quiz Server with ID:', socket.id);
});

socket.on('connect_error', (err) => {
  console.error('[SOCKET] Connection Error:', err.message);
});

/**
 * Toast Notification Utility
 * Displays non-intrusive alert messages on top right of screen.
 * @param {string} message 
 * @param {'info'|'error'|'success'} type 
 */
function showNotification(message, type = 'info') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  const bgColors = {
    info: 'rgba(56, 189, 248, 0.9)',
    error: 'rgba(239, 68, 68, 0.9)',
    success: 'rgba(34, 197, 94, 0.9)'
  };

  toast.style.cssText = `
    background: ${bgColors[type] || bgColors.info};
    color: #fff;
    padding: 12px 20px;
    border-radius: 8px;
    font-weight: 600;
    font-family: 'Inter', sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: popIn 0.3s ease;
  `;
  toast.innerText = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/**
 * Smooth Timer Bar Renderer
 * @param {HTMLElement} timerBarElem 
 * @param {HTMLElement} timerTextElem 
 * @param {number} totalSeconds 
 * @param {function} onComplete 
 * @returns {number} Interval ID
 */
function startClientTimer(timerBarElem, timerTextElem, totalSeconds = 15, onComplete = null) {
  let secondsRemaining = totalSeconds;
  const startTime = Date.now();
  const totalMs = totalSeconds * 1000;

  if (timerTextElem) timerTextElem.innerText = `${secondsRemaining}s`;
  if (timerBarElem) {
    timerBarElem.style.width = '100%';
    timerBarElem.classList.remove('warning');
  }

  const intervalId = setInterval(() => {
    const elapsedMs = Date.now() - startTime;
    const remainingMs = Math.max(0, totalMs - elapsedMs);
    secondsRemaining = Math.ceil(remainingMs / 1000);

    if (timerTextElem) timerTextElem.innerText = `${secondsRemaining}s`;

    if (timerBarElem) {
      const pct = (remainingMs / totalMs) * 100;
      timerBarElem.style.width = `${pct}%`;
      if (pct <= 30) {
        timerBarElem.classList.add('warning');
      }
    }

    if (remainingMs <= 0) {
      clearInterval(intervalId);
      if (onComplete) onComplete();
    }
  }, 100);

  return intervalId;
}

// Export functions to global scope for host.html and player.html inline scripts
window.socket = socket;
window.showNotification = showNotification;
window.startClientTimer = startClientTimer;
