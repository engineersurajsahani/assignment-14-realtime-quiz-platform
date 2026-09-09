const socket = io();

function showNotification(message, type = 'info', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      top: 15px;
      right: 15px;
      z-index: 9999;
      max-width: 320px;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `alert alert-${type}`;
  toast.style.cssText += `
    margin-bottom: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  `;
  toast.innerText = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, duration);
}

socket.on('error', (data) => {
  const msg = typeof data === 'string' ? data : (data.message || 'An error occurred.');
  showNotification(msg, 'error');
});

socket.on('connect', () => {
  console.log('[SOCKET] Connected to server ID:', socket.id);
});

socket.on('disconnect', () => {
  showNotification('Disconnected from server.', 'error');
});
