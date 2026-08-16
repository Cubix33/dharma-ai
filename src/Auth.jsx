// Auth.jsx — phone + name login, prototype OTP (no SMS vendor)
import React, { useState } from "react";

const STYLES = `
  .auth-wrap { max-width: 360px; margin: 0 auto; padding: 40px 20px; font-family: 'Inter', sans-serif; }
  .auth-title { font-family: 'Crimson Pro', serif; font-size: 26px; color: #e8dcc8; margin-bottom: 6px; }
  .auth-sub { font-size: 13px; color: rgba(255,255,255,0.5); margin-bottom: 28px; }
  .auth-label { font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 6px; display: block; }
  .auth-input {
    width: 100%; padding: 12px 14px; margin-bottom: 16px;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px; color: #e8dcc8; font-size: 15px; font-family: 'Inter', sans-serif;
    box-sizing: border-box;
  }
  .auth-input:focus { outline: none; border-color: #c88c3c; }
  .auth-btn {
    width: 100%; padding: 13px; background: #c88c3c; border: none; border-radius: 8px;
    color: #1a1410; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif;
  }
  .auth-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .auth-error { font-size: 13px; color: #e08a6a; margin-bottom: 14px; }
  .auth-dev-code {
    background: rgba(200,140,60,0.1); border: 1px solid rgba(200,140,60,0.3);
    border-radius: 8px; padding: 12px 14px; margin-bottom: 16px;
    font-size: 13px; color: #e8dcc8;
  }
  .auth-dev-code b { color: #c88c3c; font-size: 18px; letter-spacing: 2px; }
  .auth-back { font-size: 13px; color: rgba(255,255,255,0.5); text-align: center; margin-top: 14px; cursor: pointer; }
`;

export default function Auth({ requestOtp, verifyOtpAndLogin, onSuccess, onSkip, lang = "en" }) {
  const [step, setStep] = useState("phone"); // phone | otp
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleRequestOtp = async () => {
    setError("");
    if (!/^\d{10}$/.test(phone.trim())) {
      setError("Enter a valid 10-digit phone number.");
      return;
    }
    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    setBusy(true);
    try {
      const generated = await requestOtp(phone.trim());
      setDevCode(generated); // prototype only — never do this with a real SMS vendor
      setStep("otp");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code.");
      return;
    }
    setBusy(true);
    try {
      const profile = await verifyOtpAndLogin(phone.trim(), name.trim(), code.trim());
      onSuccess?.(profile);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <style>{STYLES}</style>
      <div className="auth-title">{lang === "hi" ? "साइन इन करें" : "Sign in"}</div>
      <div className="auth-sub">
        {lang === "hi"
          ? "अपनी साधना और इतिहास को सहेजने के लिए साइन इन करें।"
          : "Sign in to save your practice history and preferences."}
      </div>

      {error && <div className="auth-error">{error}</div>}

      {step === "phone" && (
        <>
          <label className="auth-label">{lang === "hi" ? "फ़ोन नंबर" : "Phone number"}</label>
          <input
            className="auth-input"
            type="tel"
            placeholder="9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
          />
          <label className="auth-label">{lang === "hi" ? "नाम" : "Name"}</label>
          <input
            className="auth-input"
            type="text"
            placeholder={lang === "hi" ? "आपका नाम" : "Your name"}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="auth-btn" onClick={handleRequestOtp} disabled={busy}>
            {busy ? "..." : lang === "hi" ? "कोड भेजें" : "Send code"}
          </button>
        </>
      )}

      {step === "otp" && (
        <>
          <div className="auth-dev-code">
            {lang === "hi" ? "डेव मोड — आपका कोड: " : "Dev mode — your code: "}
            <b>{devCode}</b>
            <div style={{ marginTop: 6, opacity: 0.6 }}>
              {lang === "hi"
                ? "(प्रोटोटाइप: कोई SMS नहीं भेजा गया)"
                : "(prototype: no SMS was actually sent)"}
            </div>
          </div>
          <label className="auth-label">{lang === "hi" ? "6-अंकीय कोड" : "6-digit code"}</label>
          <input
            className="auth-input"
            type="text"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <button className="auth-btn" onClick={handleVerify} disabled={busy}>
            {busy ? "..." : lang === "hi" ? "सत्यापित करें" : "Verify & continue"}
          </button>
          <div className="auth-back" onClick={() => setStep("phone")}>
            {lang === "hi" ? "वापस जाएं" : "← back"}
          </div>
        </>
      )}

      {onSkip && (
        <div className="auth-back" onClick={onSkip}>
          {lang === "hi" ? "बिना साइन इन जारी रखें" : "Continue without signing in"}
        </div>
      )}
    </div>
  );
}
