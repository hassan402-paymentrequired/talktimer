// WakaTimer Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    timerState: 'idle', // idle | running | paused | finished
    totalSeconds: 0,
    remainingSeconds: 0,
    startedAt: null,
    pausedAt: null,
  });
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'START_TIMER') {
    startTimer(msg.seconds);
    sendResponse({ ok: true });
  } else if (msg.action === 'PAUSE_TIMER') {
    pauseTimer();
    sendResponse({ ok: true });
  } else if (msg.action === 'RESUME_TIMER') {
    resumeTimer();
    sendResponse({ ok: true });
  } else if (msg.action === 'STOP_TIMER') {
    stopTimer();
    sendResponse({ ok: true });
  } else if (msg.action === 'GET_STATE') {
    getState().then(sendResponse);
    return true; // async
  }
  return true;
});

async function startTimer(seconds) {
  const now = Date.now();
  await chrome.storage.local.set({
    timerState: 'running',
    totalSeconds: seconds,
    remainingSeconds: seconds,
    startedAt: now,
    pausedAt: null,
  });
  // Create a repeating alarm every second
  chrome.alarms.clear('wakatimer-tick');
  chrome.alarms.create('wakatimer-tick', { periodInMinutes: 1 / 60 });
  broadcastState();
}

async function pauseTimer() {
  const data = await chrome.storage.local.get(['timerState', 'startedAt', 'remainingSeconds']);
  if (data.timerState !== 'running') return;
  const elapsed = Math.floor((Date.now() - data.startedAt) / 1000);
  const remaining = Math.max(0, data.remainingSeconds - elapsed);
  await chrome.storage.local.set({
    timerState: 'paused',
    remainingSeconds: remaining,
    pausedAt: Date.now(),
  });
  chrome.alarms.clear('wakatimer-tick');
  broadcastState();
}

async function resumeTimer() {
  const data = await chrome.storage.local.get(['timerState', 'remainingSeconds']);
  if (data.timerState !== 'paused') return;
  await chrome.storage.local.set({
    timerState: 'running',
    startedAt: Date.now(),
    remainingSeconds: data.remainingSeconds,
    pausedAt: null,
  });
  chrome.alarms.create('wakatimer-tick', { periodInMinutes: 1 / 60 });
  broadcastState();
}

async function stopTimer() {
  await chrome.storage.local.set({
    timerState: 'idle',
    totalSeconds: 0,
    remainingSeconds: 0,
    startedAt: null,
    pausedAt: null,
  });
  chrome.alarms.clear('wakatimer-tick');
  broadcastState();
}

async function getState() {
  const data = await chrome.storage.local.get([
    'timerState', 'totalSeconds', 'remainingSeconds', 'startedAt', 'pausedAt'
  ]);
  if (data.timerState === 'running') {
    const elapsed = Math.floor((Date.now() - data.startedAt) / 1000);
    data.remainingSeconds = Math.max(0, data.remainingSeconds - elapsed);
    if (data.remainingSeconds === 0) {
      data.timerState = 'finished';
    }
  }
  return data;
}

async function broadcastState() {
  const state = await getState();

  // Always write to storage — content scripts watch this as a reliable fallback
  await chrome.storage.local.set({ lastBroadcast: Date.now() });

  // Inject content script into any tab that doesn't have it, then message all tabs
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    // Skip chrome:// and other restricted pages
    if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) continue;

    // Try sending a message first; if it fails (no content script), inject it
    chrome.tabs.sendMessage(tab.id, { action: 'TIMER_UPDATE', state }, (response) => {
      if (chrome.runtime.lastError) {
        // Content script not present — inject it now
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        }).then(() => {
          // Small delay to let the script initialize, then send state
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { action: 'TIMER_UPDATE', state }).catch(() => {});
          }, 150);
        }).catch(() => {});
      }
    });
  }

  // Also notify popup if open
  chrome.runtime.sendMessage({ action: 'TIMER_UPDATE', state }).catch(() => {});
}

// Alarm tick handler
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'wakatimer-tick') return;
  const state = await getState();

  if (state.timerState === 'finished') {
    chrome.alarms.clear('wakatimer-tick');
    await chrome.storage.local.set({ timerState: 'finished', remainingSeconds: 0 });
  }

  broadcastState();
});