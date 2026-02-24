/// <reference types="chrome" />
import { useState, useEffect, useCallback } from 'react'
import './App.css'

type TimerState = 'idle' | 'running' | 'paused' | 'finished'

interface State {
  timerState: TimerState
  totalSeconds: number
  remainingSeconds: number
  startedAt: number | null
  pausedAt: number | null
}

const PRESETS = [
  { label: '5 min', seconds: 300 },
  { label: '10 min', seconds: 600 },
  { label: '15 min', seconds: 900 },
  { label: '20 min', seconds: 1200 },
  { label: '30 min', seconds: 1800 },
]

function formatTime(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0')
  const sec = (s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
}

function App() {
  const [state, setState] = useState<State>({
    timerState: 'idle',
    totalSeconds: 0,
    remainingSeconds: 0,
    startedAt: null,
    pausedAt: null,
  })
  const [displaySeconds, setDisplaySeconds] = useState(0)
  const [minutes, setMinutes] = useState('10')
  const [seconds, setSeconds] = useState('00')

  const fetchState = useCallback(() => {
    chrome.runtime.sendMessage({ action: 'GET_STATE' }, (res) => {
      if (res) {
        setState(res)
        setDisplaySeconds(res.remainingSeconds)
      }
    })
  }, [])

  useEffect(() => {
    fetchState()
    const listener = (msg: { action: string; state: State }) => {
      if (msg.action === 'TIMER_UPDATE') {
        setState(msg.state)
        setDisplaySeconds(msg.state.remainingSeconds)
      }
    }
    chrome.runtime.onMessage.addListener(listener)

    const interval = setInterval(() => {
      if (state.timerState === 'running') {
        fetchState()
      }
    }, 500)

    return () => {
      chrome.runtime.onMessage.removeListener(listener)
      clearInterval(interval)
    }
  }, [fetchState, state.timerState])

  const handleStart = () => {
    const totalSecs = parseInt(minutes || '0') * 60 + parseInt(seconds || '0')
    if (totalSecs <= 0) return
    chrome.runtime.sendMessage({ action: 'START_TIMER', seconds: totalSecs }, fetchState)
  }

  const handlePause = () => {
    chrome.runtime.sendMessage({ action: 'PAUSE_TIMER' }, fetchState)
  }

  const handleResume = () => {
    chrome.runtime.sendMessage({ action: 'RESUME_TIMER' }, fetchState)
  }

  const handleStop = () => {
    chrome.runtime.sendMessage({ action: 'STOP_TIMER' }, fetchState)
  }

  const applyPreset = (secs: number) => {
    setMinutes(String(Math.floor(secs / 60)).padStart(2, '0'))
    setSeconds('00')
  }

  const pct = state.totalSeconds > 0 ? (displaySeconds / state.totalSeconds) * 100 : 100
  const ratio = state.totalSeconds > 0 ? displaySeconds / state.totalSeconds : 1
  const isRunning = state.timerState === 'running'
  const isPaused = state.timerState === 'paused'
  const isFinished = state.timerState === 'finished'
  const isActive = isRunning || isPaused || isFinished

  const ringColor = isFinished ? '#ef4444' : ratio <= 0.1 ? '#ef4444' : ratio <= 0.25 ? '#f59e0b' : '#ffffff'
  const timeColor = isFinished ? '#ef4444' : ratio <= 0.1 ? '#ef4444' : ratio <= 0.25 ? '#f59e0b' : '#ffffff'

  const circumference = 2 * Math.PI * 54
  const strokeDash = circumference
  const strokeOffset = circumference * (1 - pct / 100)

  return (
    <div className="waka-root">
      <div className="waka-header">
        <div className="waka-logo">
          <span className="waka-dot" />
          WakaTimer
        </div>
        <div className={`waka-status-badge ${state.timerState}`}>
          {isRunning ? 'Live' : isPaused ? 'Paused' : isFinished ? "Time's Up" : 'Ready'}
        </div>
      </div>

      <div className="waka-ring-wrap">
        <svg className="waka-ring" viewBox="0 0 120 120" width="160" height="160">
          <circle cx="60" cy="60" r="54" fill="none" stroke="#1a1a1a" strokeWidth="6" />
          <circle
            cx="60" cy="60" r="54"
            fill="none"
            stroke={ringColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={strokeDash}
            strokeDashoffset={strokeOffset}
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.4s' }}
          />
        </svg>
        <div className="waka-ring-inner">
          <div className="waka-time" style={{ color: timeColor, animation: (isFinished || ratio <= 0.1) && isRunning ? 'waka-blink 1s ease-in-out infinite' : 'none' }}>
            {formatTime(displaySeconds)}
          </div>
          {isActive && (
            <div className="waka-of">
              of {formatTime(state.totalSeconds)}
            </div>
          )}
        </div>
      </div>

      {!isActive && (
        <div className="waka-setup">
          <div className="waka-presets">
            {PRESETS.map((p) => (
              <button key={p.seconds} className="waka-preset-btn" onClick={() => applyPreset(p.seconds)}>
                {p.label}
              </button>
            ))}
          </div>

          <div className="waka-manual-input">
            <div className="waka-input-group">
              <input
                type="number"
                min="0"
                max="99"
                value={minutes}
                onChange={e => setMinutes(e.target.value)}
                className="waka-input"
                placeholder="00"
              />
              <label>min</label>
            </div>
            <div className="waka-colon">:</div>
            <div className="waka-input-group">
              <input
                type="number"
                min="0"
                max="59"
                value={seconds}
                onChange={e => setSeconds(e.target.value)}
                className="waka-input"
                placeholder="00"
              />
              <label>sec</label>
            </div>
          </div>

          <button className="waka-btn-primary" onClick={handleStart}>
            <span className="waka-play-icon">▶</span>
            Start Presentation
          </button>
        </div>
      )}

      {isActive && (
        <div className="waka-controls">
          {isRunning && (
            <button className="waka-btn-secondary" onClick={handlePause}>⏸ Pause</button>
          )}
          {isPaused && (
            <button className="waka-btn-primary" onClick={handleResume}>▶ Resume</button>
          )}
          {isFinished && (
            <div className="waka-finished-msg">🎉 Presentation complete!</div>
          )}
          <button className="waka-btn-ghost" onClick={handleStop}>✕ Reset</button>
        </div>
      )}

      <div className="waka-footer">
        Timer visible on all tabs via overlay
      </div>
    </div>
  )
}

export default App