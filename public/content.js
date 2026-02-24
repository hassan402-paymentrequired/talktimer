// WakaTimer Content Script - Floating Overlay

(function () {
  if (document.getElementById('wakatimer-overlay')) return;

  // Inject Google Font
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&display=swap';
  document.head.appendChild(fontLink);

  // Create overlay element
  const overlay = document.createElement('div');
  overlay.id = 'wakatimer-overlay';

  const style = document.createElement('style');
  style.textContent = `
    #wakatimer-overlay {
      position: fixed;
      bottom: 28px;
      right: 28px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0;
      pointer-events: auto;
      font-family: 'DM Mono', monospace;
    }

    #wakatimer-overlay.hidden {
      display: none;
    }

    #waka-card {
      background: #0a0a0a;
      border: 1.5px solid #2a2a2a;
      border-radius: 16px;
      padding: 16px 22px 14px 22px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04);
      min-width: 180px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      backdrop-filter: blur(12px);
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
      font-family: 'DM Mono', monospace;
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

    #waka-time.warning {
      color: #f59e0b;
    }

    #waka-time.danger {
      color: #ef4444;
      animation: waka-pulse 1s ease-in-out infinite;
    }

    #waka-time.finished {
      color: #ef4444;
    }

    @keyframes waka-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    #waka-progress-track {
      width: 100%;
      height: 3px;
      background: #1e1e1e;
      border-radius: 2px;
      margin-top: 6px;
      overflow: hidden;
    }

    #waka-progress-bar {
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

    #waka-close {
      position: absolute;
      top: 8px;
      right: 10px;
      background: none;
      border: none;
      color: #333;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 2px;
      transition: color 0.2s;
    }

    #waka-close:hover {
      color: #888;
    }

    #waka-finished-label {
      font-size: 9px;
      letter-spacing: 3px;
      color: #ef4444;
      text-transform: uppercase;
      animation: waka-pulse 1s ease-in-out infinite;
      margin-top: 2px;
      display: none;
    }

    #waka-finished-label.show {
      display: block;
    }
  `;
  document.head.appendChild(style);

  overlay.innerHTML = `
    <div id="waka-card">
      <button id="waka-close" title="Hide overlay">✕</button>
      <div id="waka-label">WakaTimer</div>
      <div id="waka-time">00:00</div>
      <div id="waka-progress-track">
        <div id="waka-progress-bar" style="width:100%"></div>
      </div>
      <div id="waka-status">Ready</div>
      <div id="waka-finished-label">Time's Up!</div>
    </div>
  `;

  document.body.appendChild(overlay);

  const timeEl = document.getElementById('waka-time');
  const statusEl = document.getElementById('waka-status');
  const progressBar = document.getElementById('waka-progress-bar');
  const finishedLabel = document.getElementById('waka-finished-label');
  const closeBtn = document.getElementById('waka-close');

  closeBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
  });

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function updateOverlay(state) {
    if (!state || state.timerState === 'idle') {
      overlay.classList.add('hidden');
      return;
    }

    overlay.classList.remove('hidden');

    const remaining = state.remainingSeconds;
    const total = state.totalSeconds;
    const pct = total > 0 ? (remaining / total) * 100 : 0;

    timeEl.textContent = formatTime(remaining);

    // Color states
    timeEl.classList.remove('warning', 'danger', 'finished');
    if (state.timerState === 'finished' || remaining === 0) {
      timeEl.classList.add('finished');
      progressBar.style.background = '#ef4444';
      progressBar.style.width = '0%';
      statusEl.textContent = 'Finished';
      finishedLabel.classList.add('show');
    } else {
      finishedLabel.classList.remove('show');
      const ratio = remaining / total;
      if (ratio <= 0.1) {
        timeEl.classList.add('danger');
        progressBar.style.background = '#ef4444';
      } else if (ratio <= 0.25) {
        timeEl.classList.add('warning');
        progressBar.style.background = '#f59e0b';
      } else {
        progressBar.style.background = '#ffffff';
      }
      progressBar.style.width = pct + '%';
      statusEl.textContent = state.timerState === 'paused' ? 'Paused' : 'Presenting';
    }
  }

  // ── Compute real remaining time directly from storage data ──────────────
  function computeRemaining(data) {
    if (data.timerState === 'running') {
      const elapsed = Math.floor((Date.now() - data.startedAt) / 1000);
      const remaining = Math.max(0, data.remainingSeconds - elapsed);
      return { ...data, remainingSeconds: remaining, timerState: remaining === 0 ? 'finished' : 'running' };
    }
    return data;
  }

  // ── Initial state: read directly from storage (most reliable) ────────────
  chrome.storage.local.get(
    ['timerState', 'totalSeconds', 'remainingSeconds', 'startedAt', 'pausedAt'],
    (data) => { updateOverlay(computeRemaining(data)); }
  );

  // ── Listen for push updates from background service worker ───────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'TIMER_UPDATE') {
      updateOverlay(msg.state);
    }
  });

  // ── Watch storage directly — fires even if sendMessage fails ─────────────
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const timerKeys = ['timerState', 'totalSeconds', 'remainingSeconds', 'startedAt', 'pausedAt', 'lastBroadcast'];
    if (timerKeys.some(k => k in changes)) {
      chrome.storage.local.get(
        ['timerState', 'totalSeconds', 'remainingSeconds', 'startedAt', 'pausedAt'],
        (data) => { updateOverlay(computeRemaining(data)); }
      );
    }
  });

  // ── Active polling every second while running — self-correcting clock ────
  setInterval(() => {
    chrome.storage.local.get(
      ['timerState', 'totalSeconds', 'remainingSeconds', 'startedAt', 'pausedAt'],
      (data) => {
        if (data.timerState === 'running' || data.timerState === 'paused') {
          updateOverlay(computeRemaining(data));
        }
      }
    );
  }, 1000);
})();