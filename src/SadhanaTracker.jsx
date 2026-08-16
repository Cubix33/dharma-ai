import React from "react";

// SadhanaTracker.jsx — Daily spiritual habit tracker for Dharma AI

// ── SVG Spiritual Icons (no emojis) ──────────────────────────────────────────
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
      {/* flame */}
      <path d="M18 21 C16 17,12 13,15.5 7 C16.5 11,19.5 11,19.5 7 C23 13,20 17,18 21Z"
            fill="currentColor" opacity="0.95"/>
      <path d="M18 19 C17 16,14.5 13.5,16.5 9.5 C17.2 12,18.8 12,18.8 9.5 C21 13.5,19 16,18 19Z"
            fill="white" opacity="0.30"/>
      {/* diya bowl */}
      <path d="M8 26 Q18 22 28 26 Q26 32 10 32 Z" fill="currentColor" opacity="0.70"/>
      <ellipse cx="18" cy="26" rx="10" ry="2.2" fill="currentColor" opacity="0.45"/>
    </svg>
  ),
  scroll: (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" width="26" height="26">
      <rect x="7" y="9" width="22" height="19" rx="2"
            fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M7 11.5 Q18 7.5 29 11.5" stroke="currentColor" strokeWidth="1.3" fill="none" opacity="0.85"/>
      <path d="M7 25.5 Q18 29.5 29 25.5" stroke="currentColor" strokeWidth="1.3" fill="none" opacity="0.85"/>
      <line x1="12" y1="15.5" x2="24" y2="15.5" stroke="currentColor" strokeWidth="1.2" opacity="0.72"/>
      <line x1="12" y1="19"   x2="24" y2="19"   stroke="currentColor" strokeWidth="1.2" opacity="0.72"/>
      <line x1="12" y1="22.5" x2="20" y2="22.5" stroke="currentColor" strokeWidth="1.2" opacity="0.72"/>
      <text x="18" y="8.5" textAnchor="middle" fontSize="6"
            fontFamily="serif" fill="currentColor" opacity="0.75">॥</text>
    </svg>
  ),
  meditation: (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" width="26" height="26">
      {/* head */}
      <circle cx="18" cy="9" r="4" fill="currentColor" opacity="0.85"/>
      {/* body seated */}
      <path d="M18 14 L18 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.80"/>
      {/* crossed legs */}
      <path d="M18 22 Q12 24 8 28" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.75"/>
      <path d="M18 22 Q24 24 28 28" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.75"/>
      {/* arms resting */}
      <path d="M18 17 Q13 19 9 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.60"/>
      <path d="M18 17 Q23 19 27 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.60"/>
      {/* ground line */}
      <line x1="6" y1="29" x2="30" y2="29" stroke="currentColor" strokeWidth="1" opacity="0.30"/>
    </svg>
  ),
};

const PRACTICE_ICONS = {
  meditation: Icon.meditation,
  shloka:     Icon.om,
  pranayama:  Icon.lotus,
  gratitude:  Icon.diya,
  reading:    Icon.scroll,
};

const SADHANA_STYLES = `
  .sd-hero {
    text-align: center;
    padding: 12px 0 24px;
  }
  .sd-streak-ring {
    width: 110px; height: 110px;
    border-radius: 50%;
    border: 3px solid rgba(200,140,60,0.2);
    margin: 0 auto 16px;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    position: relative;
  }
  .sd-streak-ring.active {
    border-color: #c88c3c;
    box-shadow: 0 0 24px rgba(200,140,60,0.20);
  }
  .sd-streak-num {
    font-family: 'Crimson Pro', serif;
    font-size: 40px; font-weight: 300;
    color: #e8dcc8; line-height: 1;
  }
  .sd-streak-label {
    font-size: 10px; color: rgba(255,255,255,0.45);
    letter-spacing: 1px; text-transform: uppercase;
  }
  .sd-checkin-btn {
    background: rgba(200,140,60,0.15);
    border: 0.5px solid rgba(200,140,60,0.4);
    border-radius: 24px;
    padding: 14px 32px;
    color: #c88c3c;
    font-size: 14px;
    cursor: pointer;
    font-family: 'Inter', sans-serif;
    transition: all 0.2s;
    margin-bottom: 8px;
  }
  .sd-checkin-btn:hover { background: rgba(200,140,60,0.25); }
  .sd-checkin-btn.done {
    background: rgba(29,158,117,0.12);
    border-color: rgba(29,158,117,0.4);
    color: #1D9E75;
    cursor: default;
  }
  .sd-checkin-sub { font-size: 11px; color: rgba(255,255,255,0.38); }

  /* ── Practice cards ── */
  .sd-practices {
    display: flex; flex-direction: column; gap: 8px;
    margin-bottom: 24px;
  }
  .sd-practice {
    background: rgba(0,0,0,0.42);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 14px;
    padding: 16px 18px;
    display: flex; align-items: center; gap: 16px;
    cursor: pointer; transition: all 0.18s;
    backdrop-filter: blur(12px);
  }
  .sd-practice:hover {
    border-color: rgba(200,140,60,0.28);
    background: rgba(0,0,0,0.50);
  }
  .sd-practice.checked {
    border-color: rgba(29,158,117,0.38);
    background: rgba(0,0,0,0.48);
  }
  .sd-practice-icon {
    flex-shrink: 0;
    color: #c88c3c;
    width: 32px; height: 32px;
    display: flex; align-items: center; justify-content: center;
    opacity: 0.92;
  }
  .sd-practice.checked .sd-practice-icon { color: #1D9E75; }
  .sd-practice-info { flex: 1; }
  .sd-practice-name {
    font-size: 14px; color: #ffffff;
    font-weight: 600; margin-bottom: 3px;
    font-family: 'Inter', sans-serif;
  }
  .sd-practice-desc { font-size: 11px; color: rgba(255,255,255,0.52); }
  .sd-check {
    width: 22px; height: 22px; border-radius: 50%;
    border: 1.5px solid rgba(255,255,255,0.18);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: all 0.18s;
    font-size: 12px; color: transparent;
  }
  .sd-practice.checked .sd-check {
    background: #1D9E75;
    border-color: #1D9E75;
    color: white;
  }

  /* ── Stats ── */
  .sd-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 8px; }
  .sd-stat {
    background: rgba(0,0,0,0.38);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 12px; padding: 12px 10px; text-align: center;
    backdrop-filter: blur(10px);
  }
  .sd-stat-num {
    font-family: 'Crimson Pro', serif;
    font-size: 26px; color: #c88c3c; line-height: 1.1;
  }
  .sd-stat-label { font-size: 10px; color: rgba(255,255,255,0.42); letter-spacing: 0.5px; }

  /* ── Reflection ── */
  .sd-reflection {
    background: rgba(0,0,0,0.42);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 14px; padding: 16px 18px;
    backdrop-filter: blur(12px);
  }
  .sd-reflection-label {
    font-size: 10px; letter-spacing: 2px; color: rgba(200,140,60,0.75);
    text-transform: uppercase; margin-bottom: 10px;
    font-family: 'Inter', sans-serif;
  }
  .sd-reflection-input {
    background: transparent; border: none;
    color: rgba(255,255,255,0.82); font-size: 13px;
    font-family: 'Crimson Pro', serif; font-style: italic;
    width: 100%; resize: none; outline: none; line-height: 1.7;
    min-height: 60px;
  }
  .sd-reflection-input::placeholder { color: rgba(255,255,255,0.22); }

  /* ── Calendar ── */
  .sd-calendar {
    background: rgba(0,0,0,0.38);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 24px;
    backdrop-filter: blur(12px);
  }
  .sd-cal-month {
    text-align: center;
    font-size: 11px; letter-spacing: 2px;
    color: rgba(255,255,255,0.45); text-transform: uppercase;
    margin-bottom: 16px; font-family: 'Inter', sans-serif;
  }
  .sd-cal-dow {
    display: grid; grid-template-columns: repeat(7,1fr); gap: 4px;
    margin-bottom: 6px;
  }
  .sd-cal-dow-cell {
    text-align: center; font-size: 10px;
    color: rgba(255,255,255,0.32);
    font-family: 'Inter', sans-serif; font-weight: 600;
    padding-bottom: 2px;
  }
  .sd-cal-grid {
    display: grid; grid-template-columns: repeat(7,1fr); gap: 4px;
  }
  .sd-cal-day {
    aspect-ratio: 1;
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-family: 'Inter', sans-serif;
    background: rgba(255,255,255,0.04);
    border: 1px solid transparent;
    color: rgba(255,255,255,0.55);
    transition: all 0.15s;
    cursor: default;
  }
  .sd-cal-day.done {
    background: rgba(200,140,60,0.26);
    border-color: rgba(200,140,60,0.40);
    color: #ffd080;
    cursor: pointer;
  }
  .sd-cal-day.done:hover { background: rgba(200,140,60,0.38); }
  .sd-cal-day.today {
    border-color: rgba(255,255,255,0.32);
    color: #ffffff; font-weight: 700;
  }
  .sd-cal-day.today.done {
    background: rgba(200,140,60,0.36);
    border-color: rgba(200,140,60,0.60);
  }
  .sd-cal-day.selected {
    background: rgba(200,140,60,0.52) !important;
    border-color: rgba(200,140,60,0.80) !important;
    color: #ffffff !important;
  }
  .sd-cal-day.future { color: rgba(255,255,255,0.18); }
  .sd-cal-day.empty { background: transparent; border-color: transparent; }

  /* ── Day detail panel ── */
  .sd-day-detail {
    margin-top: 14px;
    background: rgba(0,0,0,0.45);
    border: 1px solid rgba(200,140,60,0.28);
    border-radius: 14px;
    padding: 16px 18px;
    backdrop-filter: blur(12px);
  }
  .sd-day-detail-date {
    font-size: 10px; letter-spacing: 2px;
    color: rgba(200,140,60,0.80);
    text-transform: uppercase; margin-bottom: 12px;
    font-family: 'Inter', sans-serif;
  }
  .sd-day-practice-row {
    display: flex; align-items: center; gap: 10px;
    font-size: 13px; color: rgba(255,255,255,0.85);
    font-family: 'Inter', sans-serif;
    margin-bottom: 7px;
  }
  .sd-day-practice-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: rgba(200,140,60,0.90); flex-shrink: 0;
  }
  .sd-day-reflection {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255,255,255,0.08);
    font-size: 13px;
    color: rgba(255,255,255,0.60);
    font-family: 'Crimson Pro', serif;
    font-style: italic;
    line-height: 1.65;
  }
  .sd-section-label {
    font-size: 11px; letter-spacing: 2px;
    color: rgba(255,255,255,0.38);
    text-transform: uppercase;
    margin: 20px 0 12px;
    font-family: 'Inter', sans-serif;
  }
`;

const PRACTICES = [
  { id: "meditation", icon: "meditation", name: "Meditation",        desc: "Any form of seated practice" },
  { id: "shloka",     icon: "shloka",     name: "Daily shloka",      desc: "Read today's verse" },
  { id: "pranayama",  icon: "pranayama",  name: "Pranayama",         desc: "Breathing practice" },
  { id: "gratitude",  icon: "gratitude",  name: "Gratitude",         desc: "Three things you're thankful for" },
  { id: "reading",    icon: "reading",    name: "Scripture reading",  desc: "Any sacred text" },
];

// Practice id → human-readable name map for the detail panel
const PRACTICE_NAMES = Object.fromEntries(PRACTICES.map(p => [p.id, p.name]));

function getToday() { return new Date().toISOString().split("T")[0]; }

export default function SadhanaTracker({ t }) {
  const [data, setData] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("dharma_sadhana") || "{}"); }
    catch { return {}; }
  });
  const [reflection, setReflection] = React.useState(() => {
    try {
      const d = JSON.parse(localStorage.getItem("dharma_sadhana") || "{}");
      return d[getToday()]?.reflection || "";
    } catch { return ""; }
  });
  const [selectedCalDay, setSelectedCalDay] = React.useState(null);

  const today = getToday();
  const todayData = data[today] || { practices: [], checkedIn: false };
  const checkedIn = todayData.checkedIn;

  const save = (updated) => {
    setData(updated);
    localStorage.setItem("dharma_sadhana", JSON.stringify(updated));
  };

  const togglePractice = (id) => {
    const td = data[today] || { practices: [], checkedIn: false };
    const practices = td.practices.includes(id)
      ? td.practices.filter(p => p !== id)
      : [...td.practices, id];
    save({ ...data, [today]: { ...td, practices } });
  };

  const checkIn = () => {
    const td = data[today] || { practices: [], checkedIn: false };
    save({ ...data, [today]: { ...td, checkedIn: true, reflection } });
  };

  const saveReflection = (val) => {
    setReflection(val);
    const td = data[today] || { practices: [], checkedIn: false };
    save({ ...data, [today]: { ...td, reflection: val } });
  };

  // ── Streak calculation ────────────────────────────────────────────────────
  const streak = (() => {
    let s = 0;
    const d = new Date();
    // Don't penalise for today not being checked in yet
    if (!data[today]?.checkedIn) d.setDate(d.getDate() - 1);
    while (true) {
      const key = d.toISOString().split("T")[0];
      if (data[key]?.checkedIn) { s++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return s;
  })();
  const totalDays       = Object.values(data).filter(d => d.checkedIn).length;
  const practicesCount  = (todayData.practices || []).length;

  // ── Calendar data ─────────────────────────────────────────────────────────
  const now          = new Date();
  const calYear      = now.getFullYear();
  const calMonth     = now.getMonth();
  const todayNum     = now.getDate();
  const firstDOW     = new Date(calYear, calMonth, 1).getDay();   // 0 = Sun
  const daysInMonth  = new Date(calYear, calMonth + 1, 0).getDate();
  const monthLabel   = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const DOW_LABELS   = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  // Cells: null for empty leading slots, day number otherwise
  const calCells = [
    ...Array(firstDOW).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const dateStr = (day) =>
    `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const handleDayClick = (day) => {
    const key = dateStr(day);
    if (data[key]?.checkedIn) {
      setSelectedCalDay(prev => prev === day ? null : day);
    }
  };

  // Detail panel for selected day
  const selectedEntry = selectedCalDay ? data[dateStr(selectedCalDay)] : null;

  return (
    <>
      <style>{SADHANA_STYLES}</style>

      {/* ── Hero / streak ── */}
      <div className="sd-hero">
        <div className={`sd-streak-ring ${checkedIn ? "active" : ""}`}>
          <div className="sd-streak-num">{streak}</div>
          <div className="sd-streak-label">day streak</div>
        </div>
        {!checkedIn ? (
          <>
            <button className="sd-checkin-btn" onClick={checkIn}>
              ✓ Check in today
            </button>
            <div className="sd-checkin-sub">
              {practicesCount > 0
                ? `${practicesCount} practice${practicesCount > 1 ? "s" : ""} logged`
                : "Mark your practice below first"}
            </div>
          </>
        ) : (
          <button className="sd-checkin-btn done">✓ Checked in today</button>
        )}
      </div>

      {/* ── Stats ── */}
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

      {/* ── Practice list ── */}
      <div className="sd-section-label">Today's practices</div>
      <div className="sd-practices">
        {PRACTICES.map(p => {
          const checked = (todayData.practices || []).includes(p.id);
          return (
            <div
              key={p.id}
              className={`sd-practice ${checked ? "checked" : ""}`}
              onClick={() => togglePractice(p.id)}
            >
              <span className="sd-practice-icon">
                {PRACTICE_ICONS[p.icon]}
              </span>
              <div className="sd-practice-info">
                <div className="sd-practice-name">{p.name}</div>
                <div className="sd-practice-desc">{p.desc}</div>
              </div>
              <div className="sd-check">{checked ? "✓" : ""}</div>
            </div>
          );
        })}
      </div>

      {/* ── Reflection ── */}
      <div className="sd-reflection">
        <div className="sd-reflection-label">Today's reflection</div>
        <textarea
          className="sd-reflection-input"
          placeholder="What arose in your practice today..."
          value={reflection}
          onChange={e => saveReflection(e.target.value)}
          rows={3}
        />
      </div>

      {/* ── Calendar ── */}
      <div style={{ marginTop: 24 }}>
        <div className="sd-calendar">
          <div className="sd-cal-month">{monthLabel}</div>

          {/* Day-of-week headers */}
          <div className="sd-cal-dow">
            {DOW_LABELS.map(d => (
              <div key={d} className="sd-cal-dow-cell">{d}</div>
            ))}
          </div>

          {/* Date cells */}
          <div className="sd-cal-grid">
            {calCells.map((day, idx) => {
              if (!day) {
                return <div key={`e-${idx}`} className="sd-cal-day empty" />;
              }
              const key        = dateStr(day);
              const isDone     = !!data[key]?.checkedIn;
              const isToday    = day === todayNum;
              const isFuture   = day > todayNum;
              const isSelected = selectedCalDay === day;

              let cls = "sd-cal-day";
              if (isDone)     cls += " done";
              if (isToday)    cls += " today";
              if (isFuture)   cls += " future";
              if (isSelected) cls += " selected";

              return (
                <div
                  key={day}
                  className={cls}
                  onClick={() => handleDayClick(day)}
                  title={isDone ? "View practice log" : ""}
                >
                  {day}
                </div>
              );
            })}
          </div>

          {/* ── Selected day detail ── */}
          {selectedCalDay && selectedEntry && (
            <div className="sd-day-detail">
              <div className="sd-day-detail-date">
                {new Date(calYear, calMonth, selectedCalDay)
                  .toLocaleDateString("en-IN", {
                    weekday: "long", day: "numeric", month: "long",
                  })}
              </div>

              {/* Completed practices */}
              {(selectedEntry.practices || []).length > 0 ? (
                (selectedEntry.practices).map((pid, i) => (
                  <div key={i} className="sd-day-practice-row">
                    <div className="sd-day-practice-dot" />
                    {PRACTICE_NAMES[pid] || pid}
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", fontFamily: "Inter, sans-serif" }}>
                  No practices recorded
                </div>
              )}

              {/* Reflection */}
              {selectedEntry.reflection ? (
                <div className="sd-day-reflection">
                  "{selectedEntry.reflection}"
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
