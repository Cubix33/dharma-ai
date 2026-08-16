import React from "react";
import { supabase } from "./supabaseClient.js";

// SadhanaTracker.jsx — Daily spiritual habit tracker for Dharma AI
// Backed by Supabase (sadhana_days, sadhana_audio_selections,
// gratitude_entries), keyed on user_id. Requires a logged-in user —
// render a login prompt from the parent if `user` is null.
//
// v2 changes:
// - Reflection removed entirely; gratitude is the only free-text field.
// - Each practice checkbox toggles check-in independently (tap to check,
//   tap again to uncheck) — no separate "check in" button.
// - Gratitude: type/edit text, then check the box to lock it in (textarea
//   greys out). Uncheck to edit again. Only the latest text is stored.
// - Audio: a row of circular dials (echoes the meditation timer's
//   .timer-circle) is a pure picker — tap to select/deselect, no
//   playback on the dial itself. Selecting one reveals a separate
//   now-playing strip below (scrub bar, restart, play/pause, repeat).
//   Deselecting the dial closes the strip.
// - Calendar: past 2 days + today are editable (3-day rolling window).
// - Single shared practices list driven by calendar selection: clicking a
//   day (any non-future day) just repoints the existing list at that date;
//   outside the 3-day window it renders read-only (checkboxes/pills/box
//   disabled) instead of opening a separate panel.

const Icon = {
  om: (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" width="26" height="26">
      <text x="18" y="27" textAnchor="middle" fontSize="28"
        fontFamily="'Noto Sans Devanagari', serif" fill="currentColor">ॐ</text>
    </svg>
  ),
  lotus: (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" width="26" height="26">
      <ellipse cx="18" cy="21" rx="3.5" ry="6.5" fill="currentColor" opacity="0.95"/>
      <ellipse cx="11.5" cy="23.5" rx="3" ry="5.5" transform="rotate(-28 11.5 23.5)" fill="currentColor" opacity="0.78"/>
      <ellipse cx="24.5" cy="23.5" rx="3" ry="5.5" transform="rotate(28 24.5 23.5)"  fill="currentColor" opacity="0.78"/>
      <ellipse cx="6.5"  cy="27"   rx="2.6" ry="5" transform="rotate(-52 6.5 27)"    fill="currentColor" opacity="0.52"/>
      <ellipse cx="29.5" cy="27"   rx="2.6" ry="5" transform="rotate(52 29.5 27)"    fill="currentColor" opacity="0.52"/>
      <line x1="18" y1="28" x2="18" y2="34" stroke="currentColor" strokeWidth="1.4" opacity="0.55"/>
      <line x1="18" y1="33" x2="11" y2="36" stroke="currentColor" strokeWidth="1.1" opacity="0.42"/>
      <line x1="18" y1="33" x2="25" y2="36" stroke="currentColor" strokeWidth="1.1" opacity="0.42"/>
    </svg>
  ),
  diya: (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" width="26" height="26">
      <path d="M18 21 C16 17,12 13,15.5 7 C16.5 11,19.5 11,19.5 7 C23 13,20 17,18 21Z"
            fill="currentColor" opacity="0.95"/>
      <path d="M18 19 C17 16,14.5 13.5,16.5 9.5 C17.2 12,18.8 12,18.8 9.5 C21 13.5,19 16,18 19Z"
            fill="white" opacity="0.30"/>
      <path d="M8 26 Q18 22 28 26 Q26 32 10 32 Z" fill="currentColor" opacity="0.70"/>
      <ellipse cx="18" cy="26" rx="10" ry="2.2" fill="currentColor" opacity="0.45"/>
    </svg>
  ),
  meditation: (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" width="26" height="26">
      <circle cx="18" cy="9" r="4" fill="currentColor" opacity="0.85"/>
      <path d="M18 14 L18 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.80"/>
      <path d="M18 22 Q12 24 8 28" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.75"/>
      <path d="M18 22 Q24 24 28 28" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.75"/>
      <path d="M18 17 Q13 19 9 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.60"/>
      <path d="M18 17 Q23 19 27 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.60"/>
      <line x1="6" y1="29" x2="30" y2="29" stroke="currentColor" strokeWidth="1" opacity="0.30"/>
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
      <path d="M6 4.5v15l13-7.5-13-7.5z" fill="currentColor"/>
    </svg>
  ),
  pause: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
      <rect x="6" y="4.5" width="4" height="15" fill="currentColor"/>
      <rect x="14" y="4.5" width="4" height="15" fill="currentColor"/>
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="13" height="13">
      <rect x="5" y="10.5" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6" fill="none"/>
    </svg>
  ),
  restart: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="17" height="17">
      <path d="M12 5a7 7 0 1 1-6.32 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M4.5 4.5v4.2h4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
  repeat: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="17" height="17">
      <path d="M6 4.5h9a3.5 3.5 0 0 1 3.5 3.5v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M9.5 2 6 4.5l3.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M18 19.5H9a3.5 3.5 0 0 1-3.5-3.5v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M14.5 22 18 19.5 14.5 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
};

const PRACTICE_ICONS = {
  meditation: Icon.meditation,
  shloka:     Icon.om,
  pranayama:  Icon.lotus,
  gratitude:  Icon.diya,
};

const SADHANA_STYLES = `
  .sd-hero { text-align: center; padding: 12px 0 24px; }
  .sd-streak-ring {
    width: 110px; height: 110px; border-radius: 50%;
    border: 3px solid rgba(200,140,60,0.2);
    margin: 0 auto 12px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  }
  .sd-streak-ring.active { border-color: #c88c3c; box-shadow: 0 0 24px rgba(200,140,60,0.20); }
  .sd-streak-num { font-family: 'Crimson Pro', serif; font-size: 40px; font-weight: 300; color: #e8dcc8; line-height: 1; }
  .sd-streak-label { font-size: 10px; color: rgba(255,255,255,0.45); letter-spacing: 1px; text-transform: uppercase; }
  .sd-checkin-sub { font-size: 11px; color: rgba(255,255,255,0.38); }

  .sd-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 8px; }
  .sd-stat {
    background: rgba(0,0,0,0.38); border: 1px solid rgba(255,255,255,0.09);
    border-radius: 12px; padding: 12px 10px; text-align: center; backdrop-filter: blur(10px);
  }
  .sd-stat-num { font-family: 'Crimson Pro', serif; font-size: 26px; color: #c88c3c; line-height: 1.1; }
  .sd-stat-label { font-size: 10px; color: rgba(255,255,255,0.42); letter-spacing: 0.5px; }

  .sd-section-label {
    font-size: 11px; letter-spacing: 2px; color: rgba(255,255,255,0.38);
    text-transform: uppercase; margin: 20px 0 12px; font-family: 'Inter', sans-serif;
  }

  .sd-practices { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
  .sd-practice {
    background: rgba(0,0,0,0.42); border: 1px solid rgba(255,255,255,0.10);
    border-radius: 14px; padding: 14px 16px 14px 14px;
    display: flex; align-items: flex-start; gap: 14px;
    transition: all 0.18s; backdrop-filter: blur(12px);
  }
  .sd-practice.checked { border-color: rgba(29,158,117,0.38); background: rgba(0,0,0,0.48); }
  .sd-practice.disabled { opacity: 0.5; }

  .sd-checkbox-btn {
    flex-shrink: 0; width: 24px; height: 24px; border-radius: 7px;
    border: 1.5px solid rgba(255,255,255,0.22); background: transparent;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: all 0.15s; margin-top: 2px; padding: 0;
    color: transparent; font-size: 13px;
  }
  .sd-checkbox-btn.checked { background: #1D9E75; border-color: #1D9E75; color: white; }
  .sd-checkbox-btn:disabled { cursor: not-allowed; opacity: 0.5; }
  .sd-checkbox-btn:not(:disabled):hover { border-color: rgba(200,140,60,0.5); }

  .sd-practice-icon {
    flex-shrink: 0; color: #c88c3c; width: 26px; height: 26px; margin-top: 1px;
    display: flex; align-items: center; justify-content: center; opacity: 0.92;
  }
  .sd-practice.checked .sd-practice-icon { color: #1D9E75; }
  .sd-practice-body { flex: 1; min-width: 0; }
  .sd-practice-name { font-size: 14px; color: #ffffff; font-weight: 600; margin-bottom: 2px; font-family: 'Inter', sans-serif; }
  .sd-practice-desc { font-size: 11px; color: rgba(255,255,255,0.52); margin-bottom: 10px; }

  .sd-audio-row-wrap {
    position: relative;
  }

  .sd-audio-row {
    display: flex;
    gap: 18px;
    margin: 4px 0 2px;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 4px;
    scroll-snap-type: x proximity;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;      /* Firefox */
    -ms-overflow-style: none;   /* legacy Edge/IE, harmless elsewhere */
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .sd-audio-row::-webkit-scrollbar {
    display: none;              /* Chrome, Safari, modern Edge */
  }

  .sd-audio-row-fade {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 32px;
    pointer-events: none;
    background: linear-gradient(to right, transparent, rgba(0,0,0,0.55));
    opacity: 0;
    transition: opacity 0.2s;
  }
  .sd-audio-row-fade.visible { opacity: 1; }

  .sd-audio-dial {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    width: 62px;
    scroll-snap-align: start;
    flex-shrink: 0;
  }

  .sd-audio-dial-ring {
    position: relative;
    width: 46px;
    height: 46px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.14);
    overflow: hidden;
    transition: border-color 0.25s;
    background: rgba(255,255,255,0.04);
  }
  .sd-audio-dial.selected .sd-audio-dial-ring {
    border-color: rgba(200,140,60,0.55);
  }
  .sd-audio-dial:not(:disabled):hover .sd-audio-dial-ring {
    border-color: rgba(200,140,60,0.35);
  }

  .sd-audio-dial-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.7;
    transition: opacity 0.25s;
  }
  .sd-audio-dial.selected .sd-audio-dial-thumb { opacity: 1; }

  .sd-audio-dial-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255,255,255,0.25);
    font-family: 'Crimson Pro', serif;
    font-size: 16px;
  }
  .sd-audio-dial.selected .sd-audio-dial-fallback { color: rgba(232,184,116,0.7); }

  .sd-audio-dial-label {
    font-size: 10.5px;
    color: rgba(255,255,255,0.4);
    font-family: 'Inter', sans-serif;
    text-align: center;
    line-height: 1.3;
    transition: color 0.25s;
    max-width: 62px;
  }
  .sd-audio-dial.selected .sd-audio-dial-label { color: rgba(232,184,116,0.85); }

  .sd-audio-dial:disabled { opacity: 0.4; cursor: not-allowed; }

  .sd-audio-now-playing {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 0.5px solid rgba(255,255,255,0.08);
  }

  .sd-audio-track-label {
    font-size: 11px;
    color: rgba(232,184,116,0.75);
    font-family: 'Inter', sans-serif;
    margin-bottom: 10px;
    letter-spacing: 0.3px;
  }

  .sd-audio-scrub-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
  }

  .sd-audio-time {
    font-size: 10.5px;
    color: rgba(255,255,255,0.35);
    font-family: 'Inter', sans-serif;
    min-width: 30px;
    font-variant-numeric: tabular-nums;
  }
  .sd-audio-time.elapsed { text-align: right; }
  .sd-audio-time.remaining { text-align: left; }

  .sd-audio-scrub-track {
    flex: 1;
    position: relative;
    height: 16px;
    display: flex;
    align-items: center;
    cursor: pointer;
    touch-action: none;
  }
  .sd-audio-scrub-bg {
    position: absolute;
    left: 0; right: 0;
    height: 2px;
    background: rgba(255,255,255,0.12);
    border-radius: 2px;
  }
  .sd-audio-scrub-fill {
    position: absolute;
    left: 0;
    height: 2px;
    background: rgba(200,140,60,0.75);
    border-radius: 2px;
    pointer-events: none;
  }
  .sd-audio-scrub-handle {
    position: absolute;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: #e8b874;
    transform: translateX(-50%);
    pointer-events: none;
    box-shadow: 0 0 0 3px rgba(200,140,60,0.15);
  }
  .sd-audio-scrub-handle::before {
    content: '';
    position: absolute;
    inset: -10px;
  }

  .sd-audio-transport {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 28px;
  }

  .sd-audio-transport-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: rgba(255,255,255,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    transition: color 0.2s;
  }
  .sd-audio-transport-btn:hover { color: rgba(255,255,255,0.75); }
  .sd-audio-transport-btn.active { color: #e8b874; }

  .sd-audio-play-main {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: rgba(200,140,60,0.16);
    border: 1px solid rgba(200,140,60,0.5);
    color: #e8b874;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s;
  }
  .sd-audio-play-main:hover { background: rgba(200,140,60,0.26); }

  .sd-gratitude-box {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.14);
    border-radius: 10px; padding: 10px 12px; color: #e8dcc8; font-size: 13px;
    font-family: 'Inter', sans-serif; width: 100%; resize: none; outline: none;
    line-height: 1.6; box-sizing: border-box;
  }
  .sd-gratitude-box::placeholder { color: rgba(255,255,255,0.28); }
  .sd-gratitude-box.locked {
    background: rgba(255,255,255,0.02); color: rgba(255,255,255,0.45);
    cursor: not-allowed; border-color: rgba(255,255,255,0.08);
  }
  .sd-gratitude-locked-tag {
    display: inline-flex; align-items: center; gap: 5px; margin-top: 6px;
    font-size: 10px; color: rgba(29,158,117,0.85); letter-spacing: 0.5px;
    text-transform: uppercase; font-family: 'Inter', sans-serif;
  }

  .sd-calendar {
    background: rgba(0,0,0,0.38); border: 1px solid rgba(255,255,255,0.09);
    border-radius: 16px; padding: 20px; margin-bottom: 24px; backdrop-filter: blur(12px);
  }
  .sd-cal-month {
    text-align: center; font-size: 11px; letter-spacing: 2px;
    color: rgba(255,255,255,0.45); text-transform: uppercase;
    margin-bottom: 16px; font-family: 'Inter', sans-serif;
  }
  .sd-cal-dow { display: grid; grid-template-columns: repeat(7,1fr); gap: 4px; margin-bottom: 6px; }
  .sd-cal-dow-cell {
    text-align: center; font-size: 10px; color: rgba(255,255,255,0.32);
    font-family: 'Inter', sans-serif; font-weight: 600; padding-bottom: 2px;
  }
  .sd-cal-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 4px; }
  .sd-cal-day {
    aspect-ratio: 1; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-family: 'Inter', sans-serif;
    background: rgba(255,255,255,0.04); border: 1px solid transparent;
    color: rgba(255,255,255,0.55); transition: all 0.15s; cursor: default;
  }
  .sd-cal-day.done { background: rgba(200,140,60,0.26); border-color: rgba(200,140,60,0.40); color: #ffd080; cursor: pointer; }
  .sd-cal-day.done:hover { background: rgba(200,140,60,0.38); }
  .sd-cal-day.today { border-color: rgba(255,255,255,0.32); color: #ffffff; font-weight: 700; }
  .sd-cal-day.today.done { background: rgba(200,140,60,0.36); border-color: rgba(200,140,60,0.60); }
  .sd-cal-day.selected { background: rgba(200,140,60,0.52) !important; border-color: rgba(200,140,60,0.80) !important; color: #ffffff !important; }
  .sd-cal-day.future { color: rgba(255,255,255,0.18); cursor: default; }
  .sd-cal-day.empty { background: transparent; border-color: transparent; }
  .sd-cal-day:not(.future):not(.empty) { cursor: pointer; }
  .sd-cal-day:not(.future):not(.empty):not(.done):hover { border-color: rgba(255,255,255,0.16); }

  .sd-loading { text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.4); font-family: 'Inter', sans-serif; font-size: 13px; }
`;

const AUDIO_CATEGORIES = ["meditation", "shloka", "pranayama"];
const EDITABLE_WINDOW_DAYS = 3; // today + 2 prior days

const PRACTICES = [
  { id: "meditation", icon: "meditation", name: "Meditation",   desc: "Any form of seated practice" },
  { id: "shloka",     icon: "shloka",     name: "Daily shloka", desc: "Listen to or recite today's verse" },
  { id: "pranayama",  icon: "pranayama",  name: "Pranayama",    desc: "Breathing practice" },
  { id: "gratitude",  icon: "gratitude",  name: "Gratitude",    desc: "Write what you're thankful for" },
];

function dateStrFromDate(d) { return d.toISOString().split("T")[0]; }
function getToday() { return dateStrFromDate(new Date()); }

function isEditable(dateKey) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateKey + "T00:00:00");
  const diffDays = Math.round((today - target) / 86400000);
  return diffDays >= 0 && diffDays < EDITABLE_WINDOW_DAYS;
}

function AudioDial({ option, selected, onSelect, disabled }) {
  return (
    <button
      className={`sd-audio-dial ${selected ? "selected" : ""}`}
      onClick={onSelect}
      disabled={disabled}
      aria-label={option.label}
      aria-pressed={selected}
    >
      <span className="sd-audio-dial-ring">
        {option.thumbnail_url ? (
          <img className="sd-audio-dial-thumb" src={option.thumbnail_url} alt="" />
        ) : (
          <span className="sd-audio-dial-fallback">{option.category?.[0]?.toUpperCase() || "•"}</span>
        )}
      </span>
      <span className="sd-audio-dial-label">{option.label}</span>
    </button>
  );
}

// Scrollable row of AudioDials: hides its native scrollbar, shows an
// edge fade when more tiles overflow offscreen, and rubber-bands a
// few px past either end on drag to make the boundary tangible.
function AudioDialRow({ options, selectedId, editable, onSelect }) {
  const audioRowRef = React.useRef(null);
  const [showFade, setShowFade] = React.useState(false);
  const [stretch, setStretch] = React.useState(0); // px, signed
  const dragStartRef = React.useRef(null);

  const RESISTANCE = 0.35; // lower = more resistance
  const MAX_STRETCH = 28;  // px cap so it can't stretch indefinitely

  const updateFadeVisibility = React.useCallback(() => {
    const el = audioRowRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 1;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    setShowFade(hasOverflow && !atEnd);
  }, []);

  const handleAudioRowScroll = () => updateFadeVisibility();

  React.useEffect(() => {
    updateFadeVisibility();
    window.addEventListener("resize", updateFadeVisibility);
    return () => window.removeEventListener("resize", updateFadeVisibility);
  }, [updateFadeVisibility, options]);

  const handleRowPointerDown = (e) => {
    const el = audioRowRef.current;
    if (!el) return;
    dragStartRef.current = { x: e.clientX ?? e.touches?.[0]?.clientX, scrollLeft: el.scrollLeft };
  };

  const handleRowPointerMove = (e) => {
    const el = audioRowRef.current;
    if (!el || !dragStartRef.current) return;
    const x = e.clientX ?? e.touches?.[0]?.clientX;
    const dx = x - dragStartRef.current.x;
    const atStart = el.scrollLeft <= 0;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;

    if (atEnd && dx < 0) {
      const raw = Math.min(MAX_STRETCH, -dx * RESISTANCE);
      setStretch(-raw);
    } else if (atStart && dx > 0) {
      const raw = Math.min(MAX_STRETCH, dx * RESISTANCE);
      setStretch(raw);
    } else {
      setStretch(0);
    }
  };

  const handleRowPointerUp = () => {
    dragStartRef.current = null;
    setStretch(0); // CSS transition animates the snap-back
  };

  if (!options.length) return null;

  return (
    <div className="sd-audio-row-wrap">
      <div
        className="sd-audio-row"
        ref={audioRowRef}
        onScroll={handleAudioRowScroll}
        onPointerDown={handleRowPointerDown}
        onPointerMove={handleRowPointerMove}
        onPointerUp={handleRowPointerUp}
        onPointerLeave={handleRowPointerUp}
        style={{ transform: `translateX(${stretch}px)` }}
      >
        {options.map(o => (
          <AudioDial
            key={o.id}
            option={o}
            selected={selectedId === o.id}
            onSelect={() => onSelect(selectedId === o.id ? null : o.id)}
            disabled={!editable}
          />
        ))}
      </div>
      <div className={`sd-audio-row-fade ${showFade ? "visible" : ""}`} />
    </div>
  );
}

function AudioPlayer({ src, label }) {
  const audioRef = React.useRef(null);
  const scrubTrackRef = React.useRef(null);
  const [playing, setPlaying] = React.useState(false);
  const [progress, setProgress] = React.useState(0); // 0-100
  const [duration, setDuration] = React.useState(0);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [repeat, setRepeat] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [dragProgress, setDragProgress] = React.useState(null); // 0-100 while dragging, else null

  const fmt = (s) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) el.pause(); else el.play().catch(() => {});
  };

  const restart = () => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = 0;
    if (!playing) el.play().catch(() => {});
  };

  const ratioFromEvent = (e) => {
    const rect = scrubTrackRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX);
    return Math.min(1, Math.max(0, (x - rect.left) / rect.width));
  };

  const seekTo = (ratio) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    el.currentTime = ratio * duration;
  };

  const handlePointerDown = (e) => {
    setDragging(true);
    const ratio = ratioFromEvent(e);
    setDragProgress(ratio * 100);
    seekTo(ratio);
  };

  React.useEffect(() => {
    if (!dragging) return;
    const handleMove = (e) => {
      const ratio = ratioFromEvent(e);
      setDragProgress(ratio * 100);
    };
    const handleUp = (e) => {
      const ratio = ratioFromEvent(e);
      seekTo(ratio);
      setDragging(false);
      setDragProgress(null);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [dragging, duration]);

  const displayProgress = dragging ? dragProgress : progress;

  if (!src) return null;

  return (
    <div className="sd-audio-now-playing">
      <audio
        ref={audioRef}
        src={src}
        loop={repeat}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { if (!repeat) setPlaying(false); }}
        onLoadedMetadata={e => setDuration(e.target.duration)}
        onTimeUpdate={e => {
          setCurrentTime(e.target.currentTime);
          setProgress(e.target.duration ? (e.target.currentTime / e.target.duration) * 100 : 0);
        }}
      />

      <div className="sd-audio-track-label">{label}</div>

      <div className="sd-audio-scrub-row">
        <span className="sd-audio-time elapsed">{fmt(currentTime)}</span>
        <div
          className="sd-audio-scrub-track"
          ref={scrubTrackRef}
          onPointerDown={handlePointerDown}
          onTouchStart={handlePointerDown}
        >
          <div className="sd-audio-scrub-bg" />
          <div className="sd-audio-scrub-fill" style={{ width: `${displayProgress}%` }} />
          <div className="sd-audio-scrub-handle" style={{ left: `${displayProgress}%` }} />
        </div>
        <span className="sd-audio-time remaining">{fmt(duration - currentTime)}</span>
      </div>

      <div className="sd-audio-transport">
        <button className="sd-audio-transport-btn" onClick={restart} aria-label="Restart">
          {Icon.restart}
        </button>
        <button className="sd-audio-play-main" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
          {playing ? Icon.pause : Icon.play}
        </button>
        <button
          className={`sd-audio-transport-btn ${repeat ? "active" : ""}`}
          onClick={() => setRepeat(r => !r)}
          aria-label={repeat ? "Repeat on" : "Repeat off"}
          aria-pressed={repeat}
        >
          {Icon.repeat}
        </button>
      </div>
    </div>
  );
}

export default function SadhanaTracker({ user }) {
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState({});
  const [audioSelectionsByDate, setAudioSelectionsByDate] = React.useState({});
  const [audioOptions, setAudioOptions] = React.useState({});
  const [gratitudeByDate, setGratitudeByDate] = React.useState({});
  const [selectedDate, setSelectedDate] = React.useState(getToday());

  const today = getToday();
  const todayData = data[today] || { practices: [] };

  React.useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [daysRes, audioSelRes, audioOptRes, gratRes] = await Promise.all([
          supabase.from("sadhana_days")
            .select("entry_date, practices, checked_in")
            .eq("user_id", user.id)
            .is("deleted_at", null),
          supabase.from("sadhana_audio_selections")
            .select("entry_date, category, audio_option_id")
            .eq("user_id", user.id),
          supabase.from("audio_options")
            .select("id, category, label, audio_url, thumbnail_url")
            .eq("is_active", true)
            .order("sort_order"),
          supabase.from("gratitude_entries")
            .select("entry_date, content")
            .eq("user_id", user.id)
            .is("deleted_at", null),
        ]);

        if (cancelled) return;

        const dayMap = {};
        (daysRes.data || []).forEach(row => {
          dayMap[row.entry_date] = {
            practices: row.practices || [],
            checkedIn: row.checked_in,
          };
        });
        setData(dayMap);

        const selMap = {};
        (audioSelRes.data || []).forEach(row => {
          if (!selMap[row.entry_date]) selMap[row.entry_date] = {};
          selMap[row.entry_date][row.category] = row.audio_option_id;
        });
        setAudioSelectionsByDate(selMap);

        const optMap = {};
        (audioOptRes.data || []).forEach(row => {
          if (!optMap[row.category]) optMap[row.category] = [];
          optMap[row.category].push(row);
        });
        setAudioOptions(optMap);

        const gratMap = {};
        (gratRes.data || []).forEach(row => { gratMap[row.entry_date] = row.content; });
        setGratitudeByDate(gratMap);
      } catch (e) {
        console.log("Sadhana load failed:", e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  const upsertDay = async (dateKey, practices) => {
    if (!user) return;
    setData(prev => ({ ...prev, [dateKey]: { ...(prev[dateKey] || {}), practices } }));

    await supabase.from("sadhana_days").upsert({
      user_id: user.id,
      entry_date: dateKey,
      practices,
      checked_in: practices.length > 0,
    }, { onConflict: "user_id,entry_date" });
  };

  const togglePractice = (dateKey, practiceId) => {
    if (!isEditable(dateKey)) return;
    const existing = data[dateKey] || { practices: [] };
    const isChecked = existing.practices.includes(practiceId);

    if (!isChecked && practiceId === "gratitude") {
      const text = (gratitudeByDate[dateKey] || "").trim();
      if (!text) return;
    }

    const practices = isChecked
      ? existing.practices.filter(p => p !== practiceId)
      : [...existing.practices, practiceId];
    upsertDay(dateKey, practices);
  };

  const selectAudio = async (dateKey, category, audioOptionId) => {
    if (!isEditable(dateKey)) return;
    setAudioSelectionsByDate(prev => {
      const dayMap = { ...(prev[dateKey] || {}) };
      if (audioOptionId) dayMap[category] = audioOptionId;
      else delete dayMap[category];
      return { ...prev, [dateKey]: dayMap };
    });
    if (!user) return;
    if (audioOptionId) {
      await supabase.from("sadhana_audio_selections").upsert({
        user_id: user.id,
        entry_date: dateKey,
        category,
        audio_option_id: audioOptionId,
      }, { onConflict: "user_id,entry_date,category" });
    } else {
      await supabase.from("sadhana_audio_selections")
        .delete()
        .match({ user_id: user.id, entry_date: dateKey, category });
    }
  };

  const setGratitudeText = (dateKey, text) => {
    setGratitudeByDate(prev => ({ ...prev, [dateKey]: text }));
  };

  const saveGratitude = async (dateKey) => {
    if (!user) return;
    const text = (gratitudeByDate[dateKey] || "").trim();
    if (!text) return;
    await supabase.from("gratitude_entries").upsert({
      user_id: user.id,
      entry_date: dateKey,
      content: text,
    }, { onConflict: "user_id,entry_date" });
  };

  const streak = (() => {
    let s = 0;
    const d = new Date();
    if (!(data[today]?.practices || []).length) d.setDate(d.getDate() - 1);
    while (true) {
      const key = dateStrFromDate(d);
      if ((data[key]?.practices || []).length > 0) { s++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return s;
  })();
  const totalDays = Object.values(data).filter(d => (d.practices || []).length > 0).length;
  const practicesCount = (todayData.practices || []).length;

  const now = new Date();
  const calYear = now.getFullYear();
  const calMonth = now.getMonth();
  const todayNum = now.getDate();
  const firstDOW = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const monthLabel = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const DOW_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const calCells = [
    ...Array(firstDOW).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const dateKeyForDay = (day) =>
    `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const handleDayClick = (day) => {
    setSelectedDate(dateKeyForDay(day));
  };

  const selectedEditable = isEditable(selectedDate);
  const selectedLabel = selectedDate === today
    ? "Today's practices"
    : `Practices for ${new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`;

  if (!user) {
    return <div className="sd-loading">Sign in to track your daily practice.</div>;
  }
  if (loading) {
    return <div className="sd-loading">Loading your practice...</div>;
  }

  const renderPractices = (dateKey, editable) => {
    const dayData = data[dateKey] || { practices: [] };
    const daySelections = audioSelectionsByDate[dateKey] || {};
    const gratitudeText = gratitudeByDate[dateKey] || "";

    return (
      <div className="sd-practices">
        {PRACTICES.map(p => {
          const checked = (dayData.practices || []).includes(p.id);
          const hasAudio = AUDIO_CATEGORIES.includes(p.id);
          const options = audioOptions[p.id] || [];
          const isGratitude = p.id === "gratitude";
          const gratitudeEmpty = isGratitude && !gratitudeText.trim();
          const selectedOption = hasAudio ? options.find(o => o.id === daySelections[p.id]) : null;

          return (
            <div
              key={p.id}
              className={`sd-practice ${checked ? "checked" : ""} ${!editable ? "disabled" : ""}`}
            >
              <button
                className={`sd-checkbox-btn ${checked ? "checked" : ""}`}
                disabled={!editable || (isGratitude && !checked && gratitudeEmpty)}
                onClick={() => togglePractice(dateKey, p.id)}
                aria-label={checked ? `Uncheck ${p.name}` : `Check in ${p.name}`}
              >
                {checked ? "✓" : ""}
              </button>

              <span className="sd-practice-icon">{PRACTICE_ICONS[p.icon]}</span>

              <div className="sd-practice-body">
                <div className="sd-practice-name">{p.name}</div>
                <div className="sd-practice-desc">{p.desc}</div>

                {hasAudio && options.length > 0 && (
                  <>
                    <AudioDialRow
                      options={options}
                      selectedId={daySelections[p.id]}
                      editable={editable}
                      onSelect={(optionId) => selectAudio(dateKey, p.id, optionId)}
                    />
                    {selectedOption && (
                      <AudioPlayer key={`${dateKey}-${selectedOption.id}`} src={selectedOption.audio_url} label={selectedOption.label} />
                    )}
                  </>
                )}

                {isGratitude && (
                  <>
                    <textarea
                      className={`sd-gratitude-box ${checked ? "locked" : ""}`}
                      placeholder="What are you grateful for today..."
                      value={gratitudeText}
                      disabled={checked || !editable}
                      onChange={e => setGratitudeText(dateKey, e.target.value)}
                      onBlur={() => saveGratitude(dateKey)}
                      rows={3}
                    />
                    {checked && (
                      <div className="sd-gratitude-locked-tag">
                        {Icon.lock} Locked — uncheck to edit
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <style>{SADHANA_STYLES}</style>

      <div className="sd-hero">
        <div className={`sd-streak-ring ${practicesCount > 0 ? "active" : ""}`}>
          <div className="sd-streak-num">{streak}</div>
          <div className="sd-streak-label">day streak</div>
        </div>
        <div className="sd-checkin-sub">
          {practicesCount > 0
            ? `${practicesCount} practice${practicesCount > 1 ? "s" : ""} checked in today`
            : "Check in your practices below"}
        </div>
      </div>

      <div className="sd-stats">
        <div className="sd-stat">
          <div className="sd-stat-num">{streak}</div>
          <div className="sd-stat-label">Streak</div>
        </div>
        <div className="sd-stat">
          <div className="sd-stat-num">{totalDays}</div>
          <div className="sd-stat-label">Total days</div>
        </div>
        <div className="sd-stat">
          <div className="sd-stat-num">{practicesCount}</div>
          <div className="sd-stat-label">Today</div>
        </div>
      </div>

      <div className="sd-section-label">{selectedLabel}</div>
      {renderPractices(selectedDate, selectedEditable)}

      <div className="sd-calendar">
        <div className="sd-cal-month">{monthLabel}</div>

        <div className="sd-cal-dow">
          {DOW_LABELS.map(d => <div key={d} className="sd-cal-dow-cell">{d}</div>)}
        </div>

        <div className="sd-cal-grid">
          {calCells.map((day, idx) => {
            if (!day) return <div key={`e-${idx}`} className="sd-cal-day empty" />;
            const key = dateKeyForDay(day);
            const isDone = (data[key]?.practices || []).length > 0;
            const isToday = day === todayNum;
            const isFuture = day > todayNum;
            const isSelected = selectedDate === key;

            let cls = "sd-cal-day";
            if (isDone) cls += " done";
            if (isToday) cls += " today";
            if (isFuture) cls += " future";
            if (isSelected) cls += " selected";

            return (
              <div
                key={day}
                className={cls}
                onClick={() => !isFuture && handleDayClick(day)}
                title={isFuture ? "Future" : "View this day"}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
