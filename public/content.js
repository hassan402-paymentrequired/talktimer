// WakaTimer Content Script — Overlay + Drag + Tab Title (flicker-free)

(function () {
  if (document.getElementById('wakatimer-overlay')) return;

  // ── Font ──────────────────────────────────────────────────────────────────
  var fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&display=swap';
  document.head.appendChild(fontLink);

  // ── Styles ────────────────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = `
    #wakatimer-overlay {
      position: fixed;
      bottom: 28px;
      right: 28px;
      top: auto;
      left: auto;
      z-index: 2147483647;
      pointer-events: auto;
      font-family: 'DM Mono', monospace;
      display: none;
      user-select: none;
      -webkit-user-select: none;
    }
    #wakatimer-overlay.waka-on { display: block; }

    #waka-card {
      background: #0a0a0a;
      border: 1.5px solid #2a2a2a;
      border-radius: 16px;
      padding: 20px 22px 14px 22px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04);
      min-width: 180px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      position: relative;
      overflow: hidden;
      cursor: grab;
      transition: box-shadow 0.2s, border-color 0.2s;
    }
    #waka-card:hover { border-color: #333; }
    #waka-card.waka-dragging {
      cursor: grabbing;
      box-shadow: 0 20px 70px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1);
      border-color: #404040;
      transform: scale(1.02);
    }
    #waka-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
    }
    #waka-drag-handle {
      position: absolute;
      top: 8px;
      left: 50%;
      transform: translateX(-50%);
      width: 32px;
      height: 3px;
      background: #252525;
      border-radius: 2px;
      transition: background 0.2s, width 0.2s;
      pointer-events: none;
    }
    #waka-card:hover #waka-drag-handle { background: #3a3a3a; width: 40px; }
    #waka-card.waka-dragging #waka-drag-handle { background: #555; width: 40px; }

    #waka-label {
      font-size: 9px;
      letter-spacing: 3px;
      color: #555;
      text-transform: uppercase;
      margin-bottom: 2px;
      pointer-events: none;
    }
    #waka-time {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 52px;
      letter-spacing: 2px;
      line-height: 1;
      color: #fff;
      transition: color 0.4s;
      pointer-events: none;
    }
    #waka-time.wk-warn     { color: #f59e0b; }
    #waka-time.wk-danger   { color: #ef4444; animation: wk-pulse 1s ease-in-out infinite; }
    #waka-time.wk-finished { color: #ef4444; }
    @keyframes wk-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

    #waka-bar-track {
      width: 100%;
      height: 3px;
      background: #1e1e1e;
      border-radius: 2px;
      margin-top: 6px;
      overflow: hidden;
      pointer-events: none;
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
      pointer-events: none;
    }
    #waka-done-lbl {
      font-size: 9px;
      letter-spacing: 3px;
      color: #ef4444;
      text-transform: uppercase;
      animation: wk-pulse 1s ease-in-out infinite;
      margin-top: 2px;
      display: none;
      pointer-events: none;
    }
    #waka-done-lbl.wk-show { display: block; }
    #waka-close {
      position: absolute;
      top: 6px;
      right: 10px;
      background: none;
      border: none;
      color: #2e2e2e;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 4px;
      transition: color 0.2s;
      z-index: 10;
    }
    #waka-close:hover { color: #888; }
  `;
  document.head.appendChild(style);

  // ── DOM ───────────────────────────────────────────────────────────────────
  var overlay = document.createElement('div');
  overlay.id = 'wakatimer-overlay';
  overlay.innerHTML = `
    <div id="waka-card">
      <div id="waka-drag-handle"></div>
      <button id="waka-close" title="Hide">✕</button>
      <div id="waka-label">WakaTimer</div>
      <div id="waka-time">00:00</div>
      <div id="waka-bar-track"><div id="waka-bar" style="width:100%"></div></div>
      <div id="waka-status">Ready</div>
      <div id="waka-done-lbl">Time's Up!</div>
    </div>
  `;
  document.body.appendChild(overlay);

  var card      = document.getElementById('waka-card');
  var timeEl    = document.getElementById('waka-time');
  var barEl     = document.getElementById('waka-bar');
  var statusEl  = document.getElementById('waka-status');
  var doneLbl   = document.getElementById('waka-done-lbl');
  var userClosed = false;

  document.getElementById('waka-close').addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    userClosed = true;
    overlay.classList.remove('waka-on');
  });

  // ── Drag ─────────────────────────────────────────────────────────────────
  var isDragging = false, didDrag = false;
  var pointerStartX = 0, pointerStartY = 0;
  var overlayStartX = 0, overlayStartY = 0;

  function switchToAbsolute() {
    if (overlay.style.top && overlay.style.top !== 'auto') return;
    var rect = overlay.getBoundingClientRect();
    overlay.style.top    = rect.top  + 'px';
    overlay.style.left   = rect.left + 'px';
    overlay.style.bottom = 'auto';
    overlay.style.right  = 'auto';
  }

  card.addEventListener('mousedown', function(e) {
    if (e.target.id === 'waka-close') return;
    e.preventDefault();
    switchToAbsolute();
    isDragging = true; didDrag = false;
    pointerStartX = e.clientX; pointerStartY = e.clientY;
    overlayStartX = parseFloat(overlay.style.left) || 0;
    overlayStartY = parseFloat(overlay.style.top)  || 0;
    card.classList.add('waka-dragging');
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    var dx = e.clientX - pointerStartX;
    var dy = e.clientY - pointerStartY;
    if (!didDrag && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    didDrag = true;
    var w = overlay.offsetWidth || 200, h = overlay.offsetHeight || 140;
    overlay.style.left = Math.max(8, Math.min(overlayStartX + dx, window.innerWidth  - w - 8)) + 'px';
    overlay.style.top  = Math.max(8, Math.min(overlayStartY + dy, window.innerHeight - h - 8)) + 'px';
  });

  document.addEventListener('mouseup', function() {
    if (!isDragging) return;
    isDragging = false;
    card.classList.remove('waka-dragging');
    document.body.style.userSelect = '';
  });

  card.addEventListener('touchstart', function(e) {
    if (e.target.id === 'waka-close') return;
    var t = e.touches[0];
    switchToAbsolute();
    isDragging = true; didDrag = false;
    pointerStartX = t.clientX; pointerStartY = t.clientY;
    overlayStartX = parseFloat(overlay.style.left) || 0;
    overlayStartY = parseFloat(overlay.style.top)  || 0;
    card.classList.add('waka-dragging');
  }, { passive: true });

  document.addEventListener('touchmove', function(e) {
    if (!isDragging) return;
    var t = e.touches[0];
    var dx = t.clientX - pointerStartX, dy = t.clientY - pointerStartY;
    if (!didDrag && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    didDrag = true;
    e.preventDefault();
    var w = overlay.offsetWidth || 200, h = overlay.offsetHeight || 140;
    overlay.style.left = Math.max(8, Math.min(overlayStartX + dx, window.innerWidth  - w - 8)) + 'px';
    overlay.style.top  = Math.max(8, Math.min(overlayStartY + dy, window.innerHeight - h - 8)) + 'px';
  }, { passive: false });

  document.addEventListener('touchend', function() {
    if (!isDragging) return;
    isDragging = false;
    card.classList.remove('waka-dragging');
  });

  // ── Timer state ───────────────────────────────────────────────────────────
  // Single source of truth kept in memory.
  // background.js writes: { timerState, totalSeconds, remainingSeconds, startedAt, pausedAt }
  // We read raw storage and compute live remaining ourselves — never trust
  // pre-computed remainingSeconds from a message (it was computed at send time,
  // not render time, so it's already stale by the time we use it).

  var _timerState    = 'idle';
  var _totalSeconds  = 0;
  var _startedAt     = null;   // epoch ms of last start/resume
  var _snapshotSecs  = 0;      // remainingSeconds at the time of last start/resume

  // Pull raw storage into our local state
  function absorbStorage(data) {
    _timerState   = data.timerState   || 'idle';
    _totalSeconds = data.totalSeconds || 0;
    _startedAt    = data.startedAt    || null;
    _snapshotSecs = data.remainingSeconds || 0;
  }

  // Compute the live remaining right now from our local state
  function computeRemaining() {
    if (_timerState === 'running' && _startedAt) {
      var elapsed = Math.floor((Date.now() - _startedAt) / 1000);
      return Math.max(0, _snapshotSecs - elapsed);
    }
    return _snapshotSecs;
  }

  // ── Diff-based render ─────────────────────────────────────────────────────
  // Track what's currently painted so we only touch the DOM when needed.
  var _drawnSec    = -1;   // last second value painted
  var _drawnClass  = null;
  var _drawnStatus = null;
  var _drawnBarPct = -1;   // integer percent (0-100) — avoids float noise
  var _drawnBarBg  = null;
  var _drawnDone   = null;
  var _drawnTitle  = null;
  var _drawnVisible = null;

  function fmt(s) {
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  function paint() {
    // ── hidden / idle ───────────────────────────────────────────────────────
    if (_timerState === 'idle') {
      if (_drawnTitle !== '') { document.title = _drawnTitle = ''; document.title = document.querySelector('title') ? document.querySelector('title').dataset.orig || '' : ''; }
      if (_drawnTitle !== originalTitle) { document.title = originalTitle; _drawnTitle = originalTitle; }
      if (_drawnVisible !== false) { overlay.classList.remove('waka-on'); _drawnVisible = false; userClosed = false; }
      return;
    }

    // ── compute what SHOULD be shown ────────────────────────────────────────
    var rem   = computeRemaining();
    var total = _totalSeconds;
    var ratio = total > 0 ? rem / total : 1;

    // Clamp state to finished if time ran out
    if (rem === 0 && _timerState === 'running') _timerState = 'finished';

    var isFinished = (_timerState === 'finished');
    var isPaused   = (_timerState === 'paused');

    // Values we want painted
    var wantSec    = rem;  // integer seconds
    var wantClass  = isFinished ? 'wk-finished' : ratio <= 0.1 ? 'wk-danger' : ratio <= 0.25 ? 'wk-warn' : '';
    var wantStatus = isFinished ? 'Finished' : isPaused ? 'Paused' : 'Presenting';
    var wantBarPct = isFinished ? 0 : Math.round(ratio * 100);   // integer, kills float noise
    var wantBarBg  = (isFinished || ratio <= 0.1) ? '#ef4444' : ratio <= 0.25 ? '#f59e0b' : '#fff';
    var wantDone   = isFinished;
    var wantTitle  = isFinished
      ? '\u23F1 TIME\'S UP \u2014 WakaTimer'
      : isPaused
        ? '\u23F8 ' + fmt(rem) + ' \u2014 WakaTimer'
        : '\u23F1 ' + fmt(rem) + ' \u2014 WakaTimer';

    // ── only write DOM when value actually changed ───────────────────────────
    if (_drawnVisible !== true && (!userClosed || isFinished)) {
      overlay.classList.add('waka-on');
      _drawnVisible = true;
    }

    if (_drawnSec !== wantSec) {
      timeEl.textContent = fmt(wantSec);
      _drawnSec = wantSec;
    }

    if (_drawnClass !== wantClass) {
      timeEl.className = wantClass;
      _drawnClass = wantClass;
    }

    if (_drawnStatus !== wantStatus) {
      statusEl.textContent = wantStatus;
      _drawnStatus = wantStatus;
    }

    if (_drawnBarPct !== wantBarPct) {
      barEl.style.width = wantBarPct + '%';
      _drawnBarPct = wantBarPct;
    }

    if (_drawnBarBg !== wantBarBg) {
      barEl.style.background = wantBarBg;
      _drawnBarBg = wantBarBg;
    }

    if (_drawnDone !== wantDone) {
      if (wantDone) { doneLbl.classList.add('wk-show'); overlay.classList.add('waka-on'); _drawnVisible = true; }
      else          { doneLbl.classList.remove('wk-show'); }
      _drawnDone = wantDone;
    }

    if (_drawnTitle !== wantTitle) {
      document.title = wantTitle;
      _drawnTitle = wantTitle;
    }
  }

  // ── Data layer ────────────────────────────────────────────────────────────
  var KEYS = ['timerState', 'totalSeconds', 'remainingSeconds', 'startedAt', 'pausedAt'];
  var originalTitle = document.title;

  // One pending-fetch flag prevents multiple simultaneous storage reads
  var fetchPending = false;
  function scheduleFetch() {
    if (fetchPending) return;
    fetchPending = true;
    setTimeout(function() {
      fetchPending = false;
      chrome.storage.local.get(KEYS, function(data) {
        absorbStorage(data);
        paint();
      });
    }, 0);
  }

  // 1. Immediate read on injection
  scheduleFetch();

  // 2. Storage watcher — triggers whenever background writes anything
  //    (including lastBroadcast on every alarm tick)
  chrome.storage.onChanged.addListener(function(changes, area) {
    if (area !== 'local') return;
    var watched = KEYS.concat(['lastBroadcast']);
    if (watched.some(function(k) { return k in changes; })) {
      scheduleFetch();
    }
  });

  // 3. Self-correcting 1-second tick — drives the visible countdown
  //    independently of storage events (handles Chrome alarm throttling)
  setInterval(paint, 1000);

})();