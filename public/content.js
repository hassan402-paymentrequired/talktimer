// WakaTimer Content Script - Floating Overlay + Tab Title

(function () {
  if (document.getElementById('wakatimer-overlay')) return;

  // ── Font ──────────────────────────────────────────────────────────────────
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&display=swap';
  document.head.appendChild(fontLink);

  // ── Styles ────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #wakatimer-overlay {
      position: fixed;
      bottom: 28px;
      right: 28px;
      z-index: 2147483647;
      pointer-events: auto;
      font-family: 'DM Mono', monospace;
      display: none;
    }
    #wakatimer-overlay.waka-visible {
      display: block;
    }
    #waka-card {
      background: #0a0a0a;
      border: 1.5px solid #2a2a2a;
      border-radius: 16px;
      padding: 16px 22px 14px 22px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04);
      min-width: 180px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      position: relative;
      overflow: hidden;
    }
    #waka-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
    }
    #waka-label {
      font-size: 9px;
      letter-spacing: 3px;
      color: #555;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    #waka-time {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 52px;
      letter-spacing: 2px;
      line-height: 1;
      color: #fff;
      transition: color 0.4s;
    }
    #waka-time.waka-warn     { color: #f59e0b; }
    #waka-time.waka-danger   { color: #ef4444; animation: waka-pulse 1s ease-in-out infinite; }
    #waka-time.waka-finished { color: #ef4444; }
    @keyframes waka-pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
    #waka-bar-track {
      width: 100%;
      height: 3px;
      background: #1e1e1e;
      border-radius: 2px;
      margin-top: 6px;
      overflow: hidden;
    }
    #waka-bar {
      height: 100%;
      background: #fff;
      border-radius: 2px;
      transition: width 1s linear, background 0.4s;
    }
    #waka-status {
      font-size: 9px;
      letter-spacing: 2px;
      color: #444;
      text-transform: uppercase;
      margin-top: 4px;
    }
    #waka-done-lbl {
      font-size: 9px;
      letter-spacing: 3px;
      color: #ef4444;
      text-transform: uppercase;
      animation: waka-pulse 1s ease-in-out infinite;
      margin-top: 2px;
      display: none;
    }
    #waka-done-lbl.waka-show { display: block; }
    #waka-close {
      position: absolute;
      top: 8px; right: 10px;
      background: none;
      border: none;
      color: #2e2e2e;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 2px;
      transition: color 0.2s;
    }
    #waka-close:hover { color: #777; }
  `;
  document.head.appendChild(style);

  // ── DOM ───────────────────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'wakatimer-overlay';
  overlay.innerHTML = `
    <div id="waka-card">
      <button id="waka-close" title="Hide">✕</button>
      <div id="waka-label">WakaTimer</div>
      <div id="waka-time">00:00</div>
      <div id="waka-bar-track"><div id="waka-bar" style="width:100%"></div></div>
      <div id="waka-status">Ready</div>
      <div id="waka-done-lbl">Time's Up!</div>
    </div>
  `;
  document.body.appendChild(overlay);

  const timeEl   = document.getElementById('waka-time');
  const barEl    = document.getElementById('waka-bar');
  const statusEl = document.getElementById('waka-status');
  const doneLbl  = document.getElementById('waka-done-lbl');
  let userClosed = false;

  document.getElementById('waka-close').addEventListener('click', () => {
    userClosed = true;
    overlay.classList.remove('waka-visible');
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const originalTitle = document.title;

  function fmt(s) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  // Compute live remaining from raw storage snapshot
  function liveState(data) {
    if (data.timerState === 'running' && data.startedAt) {
      const elapsed = Math.floor((Date.now() - data.startedAt) / 1000);
      const rem = Math.max(0, data.remainingSeconds - elapsed);
      return { ...data, remainingSeconds: rem, timerState: rem === 0 ? 'finished' : 'running' };
    }
    return data;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render(state) {
    if (!state || state.timerState === 'idle') {
      document.title = originalTitle;
      overlay.classList.remove('waka-visible');
      userClosed = false; // reset so next timer session shows again
      return;
    }

    // Tab title
    if (state.timerState === 'finished') {
      document.title = `\u23F1 TIME'S UP \u2014 WakaTimer`;
    } else if (state.timerState === 'paused') {
      document.title = `\u23F8 ${fmt(state.remainingSeconds)} \u2014 WakaTimer`;
    } else {
      document.title = `\u23F1 ${fmt(state.remainingSeconds)} \u2014 WakaTimer`;
    }

    // Show overlay unless user explicitly closed it
    if (!userClosed) overlay.classList.add('waka-visible');

    const rem   = state.remainingSeconds;
    const total = state.totalSeconds;
    const pct   = total > 0 ? (rem / total) * 100 : 0;
    const ratio = total > 0 ? rem / total : 1;

    timeEl.textContent = fmt(rem);
    timeEl.className = '';

    if (state.timerState === 'finished' || rem === 0) {
      timeEl.className     = 'waka-finished';
      barEl.style.width    = '0%';
      barEl.style.background = '#ef4444';
      statusEl.textContent = 'Finished';
      doneLbl.classList.add('waka-show');
      // Force show overlay on finish even if user had closed it
      overlay.classList.add('waka-visible');
    } else {
      doneLbl.classList.remove('waka-show');
      barEl.style.width = pct + '%';
      if (ratio <= 0.1) {
        timeEl.className = 'waka-danger';
        barEl.style.background = '#ef4444';
      } else if (ratio <= 0.25) {
        timeEl.className = 'waka-warn';
        barEl.style.background = '#f59e0b';
      } else {
        barEl.style.background = '#fff';
      }
      statusEl.textContent = state.timerState === 'paused' ? 'Paused' : 'Presenting';
    }
  }

  // ── Data layer ────────────────────────────────────────────────────────────
  const KEYS = ['timerState', 'totalSeconds', 'remainingSeconds', 'startedAt', 'pausedAt'];

  function fetchAndRender() {
    chrome.storage.local.get(KEYS, (data) => render(liveState(data)));
  }

  // 1. Initial load — runs immediately when script is injected
  fetchAndRender();

  // 2. Direct push from background (fastest — used for action responses)
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'TIMER_UPDATE') render(liveState(msg.state));
  });

  // 3. Storage change watcher — fires in EVERY tab on every pushState() call.
  //    This is the key mechanism that makes the overlay appear without reload.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    // lastBroadcast is written every tick — use it as the trigger
    if ('lastBroadcast' in changes) {
      // Small delay ensures all other storage keys are flushed before we read
      setTimeout(fetchAndRender, 20);
    } else if (KEYS.some(k => k in changes)) {
      fetchAndRender();
    }
  });

  // 4. Self-correcting 1s poll — backstop if storage events are delayed
  setInterval(fetchAndRender, 1000);
})();