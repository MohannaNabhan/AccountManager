// Background script principal (simplificado)
importScripts('config.js');

let connectionStatus = { connected: false };

async function checkStatus() {
  try {
    const res = await fetch(`${CONFIG.SERVER_URL}${CONFIG.ENDPOINTS.STATUS}`);
    connectionStatus = { connected: res.ok };
  } catch (e) {
    connectionStatus = { connected: false };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_CONNECTION_STATUS') {
    sendResponse({ success: true, data: connectionStatus });
  } else if (msg.action === 'openApp') {
    fetch(`${CONFIG.SERVER_URL}${CONFIG.ENDPOINTS.SHOW_APP}`, { method: 'POST' });
  }
});

setInterval(checkStatus, 30000);
checkStatus();