import React from "react";

// SadhanaTracker.jsx — Daily spiritual habit tracker for Dharma AI
// Drop into src/ and add as a tab in App.jsx

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
    box-shadow: 0 0 24px rgba(200,140,60,0.15);
  }
  .sd-streak-num {
    font-family: 'Crimson Pro', serif;
    font-size: 40px; font-weight: 300;
    color: #e8dcc8; line-height: 1;
  }
  .sd-streak-label {
    font-size: 10px; color: #6b5f4a;
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
    background: rgba(29,158,117,0.1);
    border-color: rgba(29,158,117,0.4);
    color: #1D9E75;
    cursor: default;
  }
  .sd-checkin-sub { font-size: 11px; color: #4a4030; }

  .sd-practices {
    display: flex; flex-direction: column; gap: 8px;
    margin-bottom: 24px;
  }
  .sd-practice {
    background: rgba(255,255,255,0.03);
    border: 0.5px solid rgba(255,255,255,0.07);
    border-radius: 12px;
    padding: 14px 16px;
    display: flex; align-items: center; gap: 14px;
    cursor: pointer; transition: all 0.2s;
  }
  .sd-practice:hover { border-color: rgba(200,140,60,0.2); }
  .sd-practice.checked {
    border-color: rgba(29,158,117,0.3);
    background: rgba(29,158,117,0.05);
  }
  .sd-practice-icon { font-size: 22px; flex-shrink: 0; }
  .sd-practice-info { flex: 1; }
  .sd-practice-name { font-size: 14px; color: #c4b48a; margin-bottom: 2px; }
  .sd-practice-desc { font-size: 11px; color: #6b5f4a; }
  .sd-check {
    width: 22px; height: 22px; border-radius: 50%;
    border: 1.5px solid rgba(255,255,255,0.15);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: all 0.2s;
    font-size: 12px;
  }
  .sd-practice.checked .sd-check {
    background: #1D9E75;
    border-color: #1D9E75;
    color: white;
  }

  .sd-calendar {
    background: rgba(255,255,255,0.02);
    border: 0.5px solid rgba(255,255,255,0.06);
    border-radius: 14px;
    padding: 18px;
    margin-bottom: 24px;
  }
  .sd-cal-header {
    font-size: 11px; letter-spacing: 2px;
    color: #6b5f4a; text-transform: uppercase;
    margin-bottom: 14px;
  }
  .sd-cal-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 5px;
  }
  .sd-cal-day {
    aspect-ratio: 1;
    border-radius: 6px;
    background: rgba(255,255,255,0.03);
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; color: #4a4030;
  }
  .sd-cal-day.done { background: rgba(200,140,60,0.2); color: #c88c3c; }
  .sd-cal-day.today {
    border: 0.5px solid rgba(200,140,60,0.5);
    color: #e8dcc8;
  }
  .sd-cal-day.today.done { background: rgba(200,140,60,0.3); }

  .sd-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 8px; }
  .sd-stat {
    background: rgba(255,255,255,0.03);
    border: 0.5px solid rgba(255,255,255,0.06);
    border-radius: 10px; padding: 12px 10px; text-align: center;
  }
  .sd-stat-num { font-family: 'Crimson Pro', serif; font-size: 24px; color: #c88c3c; }
  .sd-stat-label { font-size: 10px; color: #6b5f4a; letter-spacing: 0.5px; }
  .sd-reflection {
    background: rgba(255,255,255,0.02);
    border: 0.5px solid rgba(255,255,255,0.06);
    border-radius: 12px; padding: 14px 16px;
  }
  .sd-reflection-label {
    font-size: 10px; letter-spacing: 2px; color: #6b5f4a;
    text-transform: uppercase; margin-bottom: 8px;
  }
  .sd-reflection-input {
    background: transparent; border: none;
    color: #8a7a60; font-size: 13px;
    font-family: 'Crimson Pro', serif; font-style: italic;
    width: 100%; resize: none; outline: none; line-height: 1.7;
    min-height: 60px;
  }
  .sd-reflection-input::placeholder { color: #3a3028; }
`;

const PRACTICES = [
  { id: "meditation", icon: "🧘", name: "Meditation", desc: "Any form of seated practice" },
  { id: "shloka",     icon: "📿", name: "Daily shloka", desc: "Read today's verse" },
  { id: "pranayama",  icon: "🌬️", name: "Pranayama", desc: "Breathing practice" },
  { id: "gratitude",  icon: "🙏", name: "Gratitude", desc: "Three things you're thankful for" },
  { id: "reading",    icon: "📖", name: "Scripture reading", desc: "Any sacred text" },
];

function getToday() { return new Date().toISOString().split("T")[0]; }
function getLast30Days() {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i));
    return d.toISOString().split("T")[0];
  });
}

export default function SadhanaTracker({ t }) {
  const [data, setData] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("dharma_sadhana") || "{}"); } catch { return {}; }
  });
  const [reflection, setReflection] = React.useState(() => {
    const d = JSON.parse(localStorage.getItem("dharma_sadhana") || "{}");
    return d[getToday()]?.reflection || "";
  });

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

  // Streak calculation
  const days = getLast30Days();
  const streak = (() => {
    let s = 0;
    const sorted = [...days].reverse();
    for (const d of sorted) {
      if (data[d]?.checkedIn) s++;
      else break;
    }
    return s;
  })();
  const totalDays = Object.values(data).filter(d => d.checkedIn).length;
  const practicesCompleted = (todayData.practices || []).length;

  return (
    <>
      <style>{SADHANA_STYLES}</style>

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
              {practicesCompleted > 0
                ? `${practicesCompleted} practice${practicesCompleted > 1 ? "s" : ""} logged`
                : "Mark your practice below first"}
            </div>
          </>
        ) : (
          <button className="sd-checkin-btn done">✓ Checked in today</button>
        )}
      </div>

      <div className="sd-stats">
        <div className="sd-stat">
          <div className="sd-stat-num">{streak}</div>
          <div className="sd-stat-label">Current streak</div>
        </div>
        <div className="sd-stat">
          <div className="sd-stat-num">{totalDays}</div>
          <div className="sd-stat-label">Total days</div>
        </div>
        <div className="sd-stat">
          <div className="sd-stat-num">{practicesCompleted}</div>
          <div className="sd-stat-label">Today</div>
        </div>
      </div>

      <div style={{ fontSize: 11, letterSpacing: 2, color: "#6b5f4a", textTransform: "uppercase", margin: "20px 0 12px" }}>
        Today's practices
      </div>

      <div className="sd-practices">
        {PRACTICES.map(p => {
          const checked = (todayData.practices || []).includes(p.id);
          return (
            <div
              key={p.id}
              className={`sd-practice ${checked ? "checked" : ""}`}
              onClick={() => togglePractice(p.id)}
            >
              <span className="sd-practice-icon">{p.icon}</span>
              <div className="sd-practice-info">
                <div className="sd-practice-name">{p.name}</div>
                <div className="sd-practice-desc">{p.desc}</div>
              </div>
              <div className="sd-check">{checked ? "✓" : ""}</div>
            </div>
          );
        })}
      </div>

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

      <div style={{ marginTop: 20 }}>
        <div className="sd-calendar">
          <div className="sd-cal-header">Last 30 days</div>
          <div className="sd-cal-grid">
            {days.map(d => (
              <div
                key={d}
                className={`sd-cal-day ${data[d]?.checkedIn ? "done" : ""} ${d === today ? "today" : ""}`}
              >
                {new Date(d + "T00:00:00").getDate()}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
