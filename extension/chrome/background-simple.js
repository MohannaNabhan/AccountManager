// Background script minimalista
const SERVER_URL = 'http://localhost:8765';

let connectionStatus = { connected: false };

async function checkStatus() {
  try {
    const res = await fetch(`${SERVER_URL}/status`);
    const connected = res.ok;
    connectionStatus = { connected };
    chrome.action.setBadgeText({ text: connected ? '✓' : '✗' });
    chrome.action.setBadgeBackgroundColor({ color: connected ? '#10b981' : '#ef4444' });
  } catch (e) {
    connectionStatus = { connected: false };
    chrome.action.setBadgeText({ text: '✗' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_CONNECTION_STATUS') {
    sendResponse({ success: true, data: connectionStatus });
  } else if (msg.type === 'CHECK_CONNECTION') {
    checkStatus().then(() => sendResponse({ success: true, data: connectionStatus }));
    return true;
  } else if (msg.type === 'GET_FORM_DATA') {
    fetch(`${SERVER_URL}/form-data`, { 
      method: 'POST', 
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' }
    })
      .then(res => res.json())
      .then(data => sendResponse(data))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  } else if (msg.type === 'SAVE_PASSWORD_SETTINGS') {
    fetch(`${SERVER_URL}/save-password-settings`, {
      method: 'POST',
      body: JSON.stringify(msg.data),
      headers: { 'Content-Type': 'application/json' }
    })
      .then(res => res.json())
      .then(data => sendResponse(data))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  checkStatus();
});

setInterval(checkStatus, 30000);
checkStatus();