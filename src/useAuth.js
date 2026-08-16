// useAuth.js — Dharma AI prototype auth
//
// PROTOTYPE NOTE: there is no real SMS vendor wired in yet. requestOtp()
// generates a code, writes it to otp_codes, and returns it directly so the
// UI can display it on-screen ("dev mode: your code is 482913"). To go
// live later, replace the body of requestOtp() with a call to a real SMS
// API (Twilio/MSG91/etc) and stop returning the code to the caller —
// nothing else in this file, or in any component using useAuth(), needs
// to change.
//
// Identity = (phone_number, name) PAIR. Same phone + different name
// creates a separate profile with separate history, by design.

import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient.js";

const SESSION_KEY = "dharma_session_token";
const OTP_TTL_MINUTES = 10;
const SESSION_TTL_DAYS = 30;

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function useAuth() {
  const [user, setUser] = useState(null);       // profiles row, or null
  const [loading, setLoading] = useState(true);

  // ── Restore session on load ──────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem(SESSION_KEY);
    if (!token) { setLoading(false); return; }

    (async () => {
      try {
        const { data: session } = await supabase
          .from("sessions")
          .select("user_id, expires_at")
          .eq("token", token)
          .maybeSingle();

        if (!session || new Date(session.expires_at) < new Date()) {
          localStorage.removeItem(SESSION_KEY);
          setUser(null);
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user_id)
          .maybeSingle();

        setUser(profile || null);
      } catch (e) {
        console.log("Session restore failed:", e.message);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Step 1: request an OTP for a phone number ────────────────────────
  // Returns the code itself in this prototype so the UI can show it.
  const requestOtp = useCallback(async (phoneNumber) => {
    const code = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

    const { error } = await supabase.from("otp_codes").insert({
      phone_number: phoneNumber,
      code,
      expires_at: expiresAt,
    });

    if (error) throw new Error("Could not generate code: " + error.message);

    // PROTOTYPE: return code so UI can display it directly.
    // LIVE: send `code` via SMS vendor instead, and don't return it.
    return code;
  }, []);

  // ── Step 2: verify OTP + name, create/fetch profile, start session ──
  const verifyOtpAndLogin = useCallback(async (phoneNumber, name, code) => {
    const { data: otp } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("phone_number", phoneNumber)
      .eq("code", code)
      .eq("consumed", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otp) throw new Error("Invalid code.");
    if (new Date(otp.expires_at) < new Date()) throw new Error("Code expired, request a new one.");

    await supabase.from("otp_codes").update({ consumed: true }).eq("id", otp.id);

    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Name is required.");

    // Identity = (phone_number, name). Find existing or create new.
    let { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("phone_number", phoneNumber)
      .eq("name", trimmedName)
      .maybeSingle();

    if (!profile) {
      const { data: created, error: createErr } = await supabase
        .from("profiles")
        .insert({ phone_number: phoneNumber, name: trimmedName })
        .select()
        .single();
      if (createErr) throw new Error("Could not create profile: " + createErr.message);
      profile = created;
    }

    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: session, error: sessErr } = await supabase
      .from("sessions")
      .insert({ user_id: profile.id, expires_at: expiresAt })
      .select()
      .single();
    if (sessErr) throw new Error("Could not start session: " + sessErr.message);

    localStorage.setItem(SESSION_KEY, session.token);
    setUser(profile);
    return profile;
  }, []);

  const logout = useCallback(async () => {
    const token = localStorage.getItem(SESSION_KEY);
    if (token) {
      await supabase.from("sessions").delete().eq("token", token).catch(() => {});
      localStorage.removeItem(SESSION_KEY);
    }
    setUser(null);
  }, []);

  // ── Clear all context history for the logged-in user (soft-delete) ──
  const clearMyHistory = useCallback(async () => {
    if (!user) return;
    const now = new Date().toISOString();
    const tables = [
      "sadhana_days",
      "gratitude_entries",
      "conversation_history",
      "mahabharata_chapter_chat_history",
      "gita_chapter_chat_history",
    ];
    for (const table of tables) {
      await supabase.from(table).update({ deleted_at: now }).eq("user_id", user.id).catch(() => {});
    }
  }, [user]);

  return { user, loading, requestOtp, verifyOtpAndLogin, logout, clearMyHistory };
}
