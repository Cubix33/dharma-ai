import React from "react";

// Onboarding.jsx — First-time user flow for Dharma AI
// Drop this file into src/ and import it in App.jsx

const ONBOARDING_STYLES = `
  .ob-wrap {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 24px;
    background: #0d0a07;
    position: relative;
  }
  .ob-wrap::before {
    content: '';
    position: fixed;
    top: -80px; left: 50%;
    transform: translateX(-50%);
    width: 320px; height: 320px;
    background: radial-gradient(circle, rgba(200,140,60,0.14) 0%, transparent 70%);
    pointer-events: none;
  }
  .ob-symbol {
    font-size: 48px;
    margin-bottom: 16px;
    animation: obPulse 3s ease-in-out infinite;
  }
  @keyframes obPulse { 0%,100%{opacity:1} 50%{opacity:0.7} }
  .ob-title {
    font-family: 'Crimson Pro', serif;
    font-size: 32px;
    font-weight: 300;
    color: #e8dcc8;
    text-align: center;
    margin-bottom: 6px;
  }
  .ob-title span { color: #c88c3c; }
  .ob-subtitle {
    font-size: 13px;
    color: #6b5f4a;
    text-align: center;
    margin-bottom: 40px;
  }
  .ob-card {
    background: rgba(255,255,255,0.03);
    border: 0.5px solid rgba(255,255,255,0.08);
    border-radius: 16px;
    padding: 28px 24px;
    width: 100%;
    max-width: 380px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .ob-field { display: flex; flex-direction: column; gap: 8px; }
  .ob-label {
    font-size: 11px;
    letter-spacing: 1.5px;
    color: #6b5f4a;
    text-transform: uppercase;
  }
  .ob-input {
    background: rgba(255,255,255,0.04);
    border: 0.5px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    padding: 12px 14px;
    color: #e8dcc8;
    font-size: 15px;
    font-family: 'Inter', sans-serif;
    outline: none;
    width: 100%;
    box-sizing: border-box;
    transition: border-color 0.2s;
  }
  .ob-input:focus { border-color: rgba(200,140,60,0.5); }
  .ob-input::placeholder { color: #4a4030; }
  .ob-options { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .ob-option {
    background: rgba(255,255,255,0.03);
    border: 0.5px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    padding: 12px 10px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
    color: #8a7a60;
    font-size: 12px;
    font-family: 'Inter', sans-serif;
  }
  .ob-option:hover { border-color: rgba(200,140,60,0.3); }
  .ob-option.selected { border-color: #c88c3c; background: rgba(200,140,60,0.1); color: #c88c3c; }
  .ob-option-icon { font-size: 20px; display: block; margin-bottom: 6px; }
  .ob-option-3 { grid-column: 1 / -1; }
  .ob-btn {
    background: rgba(200,140,60,0.15);
    border: 0.5px solid rgba(200,140,60,0.4);
    border-radius: 12px;
    padding: 14px;
    color: #c88c3c;
    font-size: 15px;
    font-family: 'Inter', sans-serif;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 4px;
  }
  .ob-btn:hover { background: rgba(200,140,60,0.25); }
  .ob-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .ob-skip {
    background: none; border: none;
    color: #4a4030; font-size: 12px;
    cursor: pointer; margin-top: 16px;
    font-family: 'Inter', sans-serif;
  }
  .ob-skip:hover { color: #6b5f4a; }
  .ob-step-dots {
    display: flex; gap: 6px; margin-bottom: 28px;
  }
  .ob-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: rgba(200,140,60,0.2);
    transition: all 0.3s;
  }
  .ob-dot.active { background: #c88c3c; width: 18px; border-radius: 3px; }
`;

const BACKGROUNDS = [
  { value: "beginner",    icon: "🌱", label: "Just starting" },
  { value: "practising",  icon: "🧘", label: "Regular seeker" },
  { value: "scholarly",   icon: "📿", label: "Deep student" },
];

const GOALS = [
  { value: "peace",       icon: "☮️",  label: "Inner peace" },
  { value: "purpose",     icon: "🧭", label: "Find purpose" },
  { value: "knowledge",   icon: "✨", label: "Learn scriptures" },
  { value: "daily",       icon: "🌅", label: "Daily practice", wide: true },
];

export default function Onboarding({ onComplete }) {
  const [step, setStep] = React.useState(0);
  const [name, setName] = React.useState("");
  const [background, setBackground] = React.useState("");
  const [goal, setGoal] = React.useState("");

  const handleComplete = () => {
    const profile = { name: name.trim() || "Seeker", background, goal, onboarded: true };
    localStorage.setItem("dharma_profile", JSON.stringify(profile));
    onComplete(profile);
  };

  return (
    <>
      <style>{ONBOARDING_STYLES}</style>
      <div className="ob-wrap">
        <div className="ob-symbol">🕉️</div>
        <div className="ob-title">Dharma<span>AI</span></div>
        <div className="ob-subtitle">Your personal scripture companion</div>

        <div className="ob-step-dots">
          {[0,1,2].map(i => (
            <div key={i} className={`ob-dot ${step >= i ? "active" : ""}`}/>
          ))}
        </div>

        <div className="ob-card">
          {step === 0 && (
            <div className="ob-field">
              <div className="ob-label">What shall we call you?</div>
              <input
                className="ob-input"
                placeholder="Your name..."
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && setStep(1)}
                autoFocus
              />
              <button className="ob-btn" onClick={() => setStep(1)}>
                Continue →
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="ob-field">
              <div className="ob-label">Your spiritual background</div>
              <div className="ob-options">
                {BACKGROUNDS.map(b => (
                  <div
                    key={b.value}
                    className={`ob-option ${background === b.value ? "selected" : ""}`}
                    onClick={() => setBackground(b.value)}
                  >
                    <span className="ob-option-icon">{b.icon}</span>
                    {b.label}
                  </div>
                ))}
              </div>
              <button className="ob-btn" disabled={!background} onClick={() => setStep(2)}>
                Continue →
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="ob-field">
              <div className="ob-label">Your primary goal</div>
              <div className="ob-options">
                {GOALS.map(g => (
                  <div
                    key={g.value}
                    className={`ob-option ${g.wide ? "ob-option-3" : ""} ${goal === g.value ? "selected" : ""}`}
                    onClick={() => setGoal(g.value)}
                  >
                    <span className="ob-option-icon">{g.icon}</span>
                    {g.label}
                  </div>
                ))}
              </div>
              <button className="ob-btn" disabled={!goal} onClick={handleComplete}>
                Begin my journey 🙏
              </button>
            </div>
          )}
        </div>

        <button className="ob-skip" onClick={() => handleComplete()}>
          Skip for now
        </button>
      </div>
    </>
  );
}
