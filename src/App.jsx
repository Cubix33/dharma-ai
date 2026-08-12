import { useState, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import Onboarding from "./Onboarding.jsx";
import SadhanaTracker from "./SadhanaTracker.jsx";
import { SCRIPTURES, buildScriptureContext } from "./scriptures.js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const openaiClient = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

async function searchScriptures(query, mood = "", maxResults = 5) {
  const searchText = mood ? `${query} feeling ${mood}` : query;
  try {
    const embeddingResponse = await openaiClient.embeddings.create({
      model: "text-embedding-3-small",
      input: searchText,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    const { data, error } = await supabase.rpc("match_scriptures", {
      query_embedding: queryEmbedding,
      match_threshold: 0.4,
      match_count: maxResults,
    });

    if (error) { console.error("Supabase error:", error); return []; }
    return data || [];
  } catch (err) {
    console.error("Scripture search failed:", err);
    return [];
  }
}

// ── Daily shloka rotates by day ───────────────────────────────────────────────
const MOODS = [
  { label: "Anxious",   emoji: "◌", value: "anxiety" },
  { label: "Sad",       emoji: "◐", value: "sadness" },
  { label: "Lost",      emoji: "✦", value: "lost" },
  { label: "Angry",     emoji: "△", value: "anger" },
  { label: "Grateful",  emoji: "❀", value: "grateful" },
  { label: "Peaceful",  emoji: "ॐ", value: "peaceful" },
  { label: "Curious",   emoji: "✧", value: "spiritual curiosity" },
  { label: "Lonely",    emoji: "◍", value: "lonely" },
];

// ── Grok API ──────────────────────────────────────────────────────────────────
const GROK_API_KEY = import.meta.env.VITE_GROK_API_KEY || "";

async function askSpiritualGuide(question, mood, conversationHistory, lang = "en", profile = null) {
  // 1. Find the most relevant scriptures for this question
  const relevant = await searchScriptures(question, mood, 5);
  const scriptureContext = buildScriptureContext(relevant);
  const langInstruction = lang === "hi"
    ? "\nIMPORTANT: Respond ENTIRELY in Hindi (Devanagari script). Keep Sanskrit verses in Sanskrit but give ALL explanations in Hindi. Do not use English except for source references like 'Bhagavad Gita 2.47'.\n"
    : "";

  const userName = profile?.name || "Seeker";
  const userBackground = profile?.background || "beginner";
  const userGoal = profile?.goal || "peace";

  const backgroundInstructions = {
    beginner: "Use simple language, avoid heavy Sanskrit jargon, limit to one verse max, keep the tone warm and encouraging, and relate the wisdom to everyday modern life.",
    practising: "Use balanced depth, include 1–2 verses, connect ancient wisdom to regular practice, and assume familiarity with foundational concepts like karma, dharma, and meditation.",
    scholarly: "Use full depth with nuanced philosophical discussion, include multiple cross-references across texts, include Sanskrit with transliteration when helpful, and treat the user as a thoughtful peer."
  }[userBackground] || "Use a balanced, compassionate tone and adapt to the user’s maturity and curiosity.";

  const goalInstructions = {
    peace: "Emphasise equanimity, meditation, breath, and letting go. Focus on calm and inner steadiness.",
    purpose: "Emphasise dharma, karma yoga, and action without attachment. Help them align effort with purpose and inner calling.",
    knowledge: "Emphasise Jnana yoga, Upanishadic inquiry, and self-knowledge. Frame the answer as a reflective exploration of truth and identity.",
    daily: "Emphasise practical daily habits, sadhana, and short actionable practices that can be lived consistently in ordinary life."
  }[userGoal] || "Ground the answer in practical wisdom and daily life.";

  // 2. Build system prompt with injected scripture knowledge
  const systemPrompt = `You are Dharma — a compassionate AI spiritual guide deeply versed in Hindu philosophy and sacred texts. You help people connect ancient Hindu wisdom to their modern life questions.

═══════════════════════════════════════════
CRITICAL RULES — READ BEFORE EVERY RESPONSE
═══════════════════════════════════════════

RULE 1 — ONLY USE PROVIDED SCRIPTURE PASSAGES
You will be given RETRIEVED SCRIPTURE PASSAGES at the end of this prompt.
ALWAYS base your response on these retrieved passages first.
If a passage is provided, QUOTE IT ACCURATELY — do not paraphrase the Sanskrit or alter the translation.
If no passages match the question, say: "The scriptures I have access to don't directly address this, but from general Hindu philosophy..."

RULE 2 — NEVER FABRICATE VERSE NUMBERS OR CITATIONS
❌ NEVER invent a verse like "Bhagavad Gita 3.21" if it was not in the retrieved passages.
❌ NEVER say "As Krishna says in Chapter X..." unless that chapter/verse was retrieved.
✓ ONLY cite sources that appear in the RETRIEVED SCRIPTURE PASSAGES section.
✓ If you reference something from your training knowledge, say: "From my knowledge of the Gita..." not a specific verse number.

RULE 3 — HANDLE SANSKRIT-ONLY PASSAGES CAREFULLY
Some retrieved passages contain only Sanskrit text with no English translation.
For these:
✓ Acknowledge the source: "This shloka from [book name] speaks to your question..."
✓ Explain the contextual meaning based on the surrounding teaching, not word-for-word translation
✓ Say "The teaching of this passage is..." rather than "This translates as..."
❌ NEVER attempt word-for-word Sanskrit translation unless you are certain

RULE 4 — SIGNAL UNCERTAINTY CLEARLY
When you are not sure about a teaching, say so:
✓ "The Gita's general teaching on this is..."
✓ "Hindu philosophy broadly holds that..."
✓ "I'm drawing from general Vedantic understanding here..."
❌ NEVER state uncertain things with false confidence

RULE 5 — WHEN NO SCRIPTURE FITS
If the retrieved passages don't match the question well:
✓ Use your general knowledge of Hindu philosophy
✓ Be clear: "Drawing from the broader spirit of the Gita..." or "Hindu philosophy teaches..."
✓ Recommend they explore a specific text: "You might find the Yoga Sutras particularly relevant here..."
❌ NEVER force an irrelevant verse to fit the question

═══════════════════════════════════════════
YOUR RESPONSE STYLE
═══════════════════════════════════════════

Tone: Warm, wise, non-preachy — like a knowledgeable elder friend, not a professor
Length: 3-4 short paragraphs maximum. Never lecture. Invite reflection.
Structure:
  1. Open with the most relevant retrieved passage (if available) — cite it accurately
  2. Explain what this teaching means for the user's specific situation
  3. Connect it to their emotion/question in plain modern language
  4. End with ONE gentle question that invites them to reflect deeper

Language depth based on user profile:
- Beginner: simple language, one verse max, relatable modern examples, no jargon
- Practising: balanced depth, 1-2 verses, assume familiarity with karma/dharma concepts
- Scholarly: full philosophical depth, multiple cross-references welcome, Sanskrit with transliteration

User's current mood: ${mood || "not specified"}
User's name: ${userName}
User's background: ${userBackground}
User's goal: ${userGoal}
Language: ${lang === 'hi' ? 'Respond ENTIRELY in Hindi (Devanagari script). Keep Sanskrit in Sanskrit but ALL explanations in Hindi. Do not use English except for source references.' : 'Respond in English.'}

${scriptureContext}`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: question },
  ];

  const response = await fetch("/xai-api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      max_tokens: 1000,
      messages,
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return { reply: data.choices[0].message.content, scriptures: relevant };
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Inter:wght@300;400;500&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: linear-gradient(180deg, #f6f1e8 0%, #efe4d3 100%);
    color: #1b2a23;
    font-family: 'Noto Sans Devanagari', 'Nirmala UI', 'Segoe UI', 'Inter', sans-serif;
    font-feature-settings: 'kern' 1, 'liga' 1, 'calt' 1;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
  }

  .app {
    max-width: 430px; margin: 0 auto; min-height: 100vh;
    display: flex; flex-direction: column;
    background: linear-gradient(180deg, #fcf9f4 0%, #f2ebdf 100%);
    position: relative; overflow: hidden;
    box-shadow: 0 0 0 1px rgba(18, 30, 25, 0.04), 0 18px 40px rgba(45, 53, 46, 0.08);
  }
  .app::before {
    content: ''; position: fixed; top: -100px; left: 50%; transform: translateX(-50%);
    width: 340px; height: 340px;
    background: radial-gradient(circle, rgba(110,166,128,0.16) 0%, rgba(203,147,67,0.08) 28%, transparent 72%);
    pointer-events: none; z-index: 0;
  }

  /* Nav */
  .nav { display: flex; align-items: center; justify-content: center; padding: 18px 20px 10px; position: relative; z-index: 10; }
  .nav-logo { font-family: 'Crimson Pro', serif; font-size: 26px; font-weight: 600; color: #b6732a; letter-spacing: 0.5px; }
  .nav-tabs {
    display: flex; gap: 8px; width: 100%;
    background: rgba(255,255,255,0.68); backdrop-filter: blur(8px);
    padding: 6px; border-radius: 18px; border: 1px solid rgba(44,71,61,0.08);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
  }
  .nav-tab {
    flex: 1; background: transparent; border: none; color: #5f7267; font-size: 12px; font-weight: 600;
    padding: 10px 8px; border-radius: 12px; cursor: pointer; font-family: 'Inter', sans-serif;
    transition: all 0.2s ease; letter-spacing: 0.02em;
  }
  .nav-tab.active {
    background: linear-gradient(135deg, #a56d2b 0%, #d3a95a 100%);
    color: #fffaf2; box-shadow: 0 8px 16px rgba(165,109,43,0.18);
  }

  /* Screens */
  .screen { flex: 1; padding: 16px 24px 32px; overflow-y: auto; position: relative; z-index: 1; }

  /* Home */
  .greeting {
    font-family: 'Noto Sans Devanagari', 'Nirmala UI', 'Segoe UI', sans-serif;
    font-size: 28px;
    font-weight: 600;
    color: #1f302c;
    line-height: 1.4;
    margin-bottom: 4px;
    unicode-bidi: plaintext;
  }
  .greeting-sub { font-size: 13px; color: #61756d; margin-bottom: 28px; }

  .shloka-card {
    background: linear-gradient(135deg, #18342d 0%, #102a25 100%);
    border: 1px solid rgba(110,166,128,0.22); border-radius: 18px;
    padding: 24px; margin-bottom: 20px; position: relative; overflow: hidden;
    box-shadow: 0 20px 30px rgba(16,42,37,0.08);
  }
  .shloka-card::before {
    content: '॥'; position: absolute; right: 20px; top: 16px;
    font-size: 40px; color: rgba(216,170,93,0.12); font-family: serif;
  }
  .shloka-label { font-size: 10px; letter-spacing: 2px; color: #d9b26d; text-transform: uppercase; margin-bottom: 14px; }
  .shloka-verse { font-family: 'Crimson Pro', serif; font-size: 18px; color: #f3ead8; line-height: 1.5; margin-bottom: 10px; }
  .shloka-transliteration { font-size: 12px; color: #b7c3bb; font-style: italic; margin-bottom: 12px; line-height: 1.6; }
  .shloka-translation { font-size: 14px; color: #e2cf9d; line-height: 1.7; margin-bottom: 12px; }
  .shloka-source { font-size: 11px; color: #b9c7c0; }

  .section-title { font-size: 11px; color: #668077; text-transform: uppercase; margin-bottom: 14px; font-family: 'Noto Sans Devanagari', 'Nirmala UI', 'Segoe UI', sans-serif; unicode-bidi: plaintext; }

  /* Mood grid */
  .mood-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 24px; }
  .mood-btn { background: rgba(255,255,255,0.56); border: 1px solid rgba(41,74,63,0.08); border-radius: 12px; padding: 12px 4px; cursor: pointer; text-align: center; transition: all 0.2s; color: #21372f; }
  .mood-btn:hover { border-color: rgba(110,166,128,0.3); background: rgba(110,166,128,0.06); }
  .mood-btn.selected { border-color: #c88c3c; background: rgba(200,140,60,0.12); }
  .mood-emoji { font-size: 22px; display: block; margin-bottom: 6px; color: #8d6a3f; font-family: 'Segoe UI Symbol', 'Apple Color Emoji', 'Noto Sans Devanagari', sans-serif; line-height: 1; font-weight: 600; }
  .mood-label { font-size: 10px; color: #5f6b66; font-family: 'Noto Sans Devanagari', 'Nirmala UI', 'Segoe UI', sans-serif; }
  .mood-btn.selected .mood-label { color: #b6732a; }

  /* Quick cards */
  .quick-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .quick-card { background: rgba(255,255,255,0.56); border: 1px solid rgba(41,74,63,0.08); border-radius: 16px; padding: 18px; cursor: pointer; transition: all 0.2s; box-shadow: 0 10px 24px rgba(36, 52, 48, 0.04); }
  .quick-card:hover { border-color: rgba(110,166,128,0.3); transform: translateY(-1px); }
  .quick-icon { font-size: 24px; margin-bottom: 8px; display: block; color: #8d6a3f; font-family: 'Noto Sans Devanagari', 'Segoe UI Symbol', 'DejaVu Sans', sans-serif; line-height: 1; unicode-bidi: plaintext; }
  .quick-name { font-size: 13px; color: #1d312b; font-weight: 600; margin-bottom: 3px; }
  .quick-desc { font-size: 11px; color: #648076; line-height: 1.5; }

  /* Stats bar */
  .stats-bar { display: flex; gap: 10px; margin-bottom: 20px; }
  .stat-pill { background: rgba(255,255,255,0.56); border: 1px solid rgba(41,74,63,0.08); border-radius: 20px; padding: 8px 14px; font-size: 12px; color: #5b6b66; }
  .stat-pill span { color: #a86d2a; font-weight: 700; margin-right: 4px; }

  /* Chat */
  .chat-screen { display: flex; flex-direction: column; height: calc(100vh - 70px); padding: 16px 24px; }
  .chat-header { margin-bottom: 14px; }
  .chat-area { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; padding-bottom: 16px; }
  .chat-empty { text-align: center; padding: 30px 20px; }
  .chat-empty-symbol { font-size: 36px; margin-bottom: 12px; opacity: 0.5; }
  .chat-empty-text { font-family: 'Noto Sans Devanagari', 'Nirmala UI', 'Segoe UI', sans-serif; font-size: 16px; color: #4d5f58; line-height: 1.7; margin-bottom: 20px; }
  .starter-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .starter-btn { background: rgba(255,255,255,0.52); border: 1px solid rgba(41,74,63,0.08); border-radius: 10px; padding: 10px 12px; cursor: pointer; text-align: left; color: #425c57; font-size: 12px; font-family: 'Noto Sans Devanagari', 'Nirmala UI', 'Segoe UI', sans-serif; transition: all 0.2s; line-height: 1.5; }
  .starter-btn:hover { border-color: rgba(110,166,128,0.3); color: #20493f; }

  .message { display: flex; flex-direction: column; gap: 4px; }
  .message.user { align-items: flex-end; }
  .message.assistant { align-items: flex-start; }

  .bubble { max-width: 88%; padding: 12px 16px; border-radius: 16px; font-size: 14px; line-height: 1.7; }
  .bubble.user { background: rgba(166,109,43,0.1); border: 1px solid rgba(166,109,43,0.18); color: #1f302c; border-bottom-right-radius: 4px; }
  .bubble.assistant { background: rgba(255,255,255,0.64); border: 1px solid rgba(41,74,63,0.08); color: #1a352f; font-family: 'Noto Sans Devanagari', 'Crimson Pro', serif; font-size: 16px; border-bottom-left-radius: 4px; white-space: pre-wrap; }
  .bubble.assistant em { color: #a56d2b; font-style: italic; }

  /* Scripture chips shown after response */
  .scripture-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .scripture-chip { background: rgba(166,109,43,0.08); border: 1px solid rgba(166,109,43,0.15); border-radius: 12px; padding: 4px 10px; font-size: 10px; color: #586d67; letter-spacing: 0.3px; }

  .typing-indicator { display: flex; gap: 4px; padding: 14px 16px; background: rgba(255,255,255,0.64); border: 1px solid rgba(41,74,63,0.08); border-radius: 16px; border-bottom-left-radius: 4px; width: fit-content; }
  .typing-dot { width: 6px; height: 6px; background: #73877f; border-radius: 50%; animation: typingBounce 1.2s infinite; }
  .typing-dot:nth-child(2) { animation-delay: 0.2s; }
  .typing-dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes typingBounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }

  .chat-input-area { display: flex; gap: 10px; padding-top: 14px; border-top: 1px solid rgba(41,74,63,0.08); }
  .chat-input { flex: 1; background: rgba(255,255,255,0.56); border: 1px solid rgba(41,74,63,0.08); border-radius: 12px; padding: 12px 14px; color: #1d312b; font-size: 14px; font-family: 'Inter', sans-serif; resize: none; outline: none; transition: border-color 0.2s; line-height: 1.5; min-height: 46px; max-height: 120px; }
  .chat-input:focus { border-color: rgba(166,109,43,0.35); }
  .chat-input::placeholder { color: #73877f; }
  .send-btn { background: linear-gradient(135deg, #a56d2b 0%, #d8b15a 100%); border: none; border-radius: 12px; width: 46px; height: 46px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #fffaf2; font-size: 18px; transition: all 0.2s; flex-shrink: 0; }
  .send-btn:hover { filter: brightness(1.04); }
  .send-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  /* Scripture browser */
  .scripture-browser { display: flex; flex-direction: column; gap: 12px; }
  .filter-row { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
  .filter-row::-webkit-scrollbar { display: none; }
  .filter-btn { background: rgba(255,255,255,0.52); border: 1px solid rgba(41,74,63,0.08); border-radius: 16px; padding: 6px 14px; font-size: 12px; color: #5b6b66; cursor: pointer; white-space: nowrap; transition: all 0.2s; font-family: 'Inter', sans-serif; }
  .filter-btn.active { background: rgba(166,109,43,0.08); border-color: rgba(166,109,43,0.18); color: #a56d2b; }

  .scripture-entry { background: rgba(255,255,255,0.52); border: 1px solid rgba(41,74,63,0.08); border-radius: 14px; padding: 18px; cursor: pointer; transition: all 0.2s; }
  .scripture-entry:hover { border-color: rgba(110,166,128,0.25); background: rgba(110,166,128,0.04); }
  .scripture-entry-source { font-size: 10px; letter-spacing: 1.5px; color: #a56d2b; text-transform: uppercase; margin-bottom: 10px; }
  .scripture-entry-verse { font-family: 'Crimson Pro', serif; font-size: 16px; color: #18342d; line-height: 1.5; margin-bottom: 8px; }
  .scripture-entry-translation { font-size: 13px; color: #536b64; line-height: 1.6; margin-bottom: 10px; }
  .scripture-entry-tags { display: flex; flex-wrap: wrap; gap: 5px; }
  .tag { font-size: 10px; color: #51716a; background: rgba(255,255,255,0.52); border: 1px solid rgba(41,74,63,0.08); border-radius: 8px; padding: 2px 8px; }

  /* Scripture detail */
  .scripture-detail { padding: 4px 0; }
  .back-btn { background: none; border: none; color: #5c6f69; font-size: 13px; cursor: pointer; font-family: 'Inter', sans-serif; margin-bottom: 20px; display: flex; align-items: center; gap: 6px; }
  .detail-source { font-size: 10px; letter-spacing: 2px; color: #a56d2b; text-transform: uppercase; margin-bottom: 16px; }
  .detail-sanskrit { font-family: 'Crimson Pro', serif; font-size: 22px; color: #1b352f; line-height: 1.6; margin-bottom: 12px; }
  .detail-transliteration { font-size: 13px; color: #5f6f6a; font-style: italic; margin-bottom: 14px; line-height: 1.6; }
  .detail-translation { font-size: 16px; color: #1b352f; font-family: 'Crimson Pro', serif; line-height: 1.7; margin-bottom: 20px; padding: 16px; background: rgba(166,109,43,0.06); border-left: 2px solid rgba(166,109,43,0.22); border-radius: 0 8px 8px 0; }
  .detail-commentary-label { font-size: 10px; letter-spacing: 2px; color: #5c6f69; text-transform: uppercase; margin-bottom: 10px; }
  .detail-commentary { font-size: 14px; color: #536b64; line-height: 1.8; margin-bottom: 20px; }
  .ask-about-btn { background: rgba(166,109,43,0.1); border: 1px solid rgba(166,109,43,0.2); border-radius: 10px; padding: 12px 18px; color: #a56d2b; font-size: 13px; cursor: pointer; font-family: 'Inter', sans-serif; width: 100%; transition: all 0.2s; }
  .ask-about-btn:hover { background: rgba(166,109,43,0.14); }

  /* Meditate */
  .meditate-hero { text-align: center; padding: 20px 0 28px; }
  .mandala { width: 100px; height: 100px; border-radius: 50%; background: conic-gradient(from 0deg, rgba(200,140,60,0.3), rgba(200,140,60,0.05), rgba(200,140,60,0.3)); margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 36px; animation: rotateSlow 20s linear infinite; border: 0.5px solid rgba(200,140,60,0.2); }
  @keyframes rotateSlow { to { transform: rotate(360deg); } }
  .meditate-title { font-family: 'Crimson Pro', serif; font-size: 24px; font-weight: 300; color: #e8dcc8; margin-bottom: 6px; }
  .meditate-sub { font-size: 13px; color: #6b5f4a; }

  .session-grid { display: flex; flex-direction: column; gap: 10px; }
  .session-card { background: rgba(255,255,255,0.03); border: 0.5px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 18px 20px; display: flex; align-items: center; gap: 16px; cursor: pointer; transition: all 0.2s; }
  .session-card:hover { border-color: rgba(200,140,60,0.3); }
  .session-icon { font-size: 28px; flex-shrink: 0; }
  .session-name { font-size: 15px; color: #c4b48a; font-weight: 500; margin-bottom: 3px; }
  .session-desc { font-size: 12px; color: #6b5f4a; line-height: 1.5; }
  .session-dur { font-size: 12px; color: #c88c3c; background: rgba(200,140,60,0.1); padding: 4px 10px; border-radius: 20px; flex-shrink: 0; }

  .timer-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px; text-align: center; }
  .timer-circle { width: 160px; height: 160px; border-radius: 50%; border: 1px solid rgba(200,140,60,0.3); display: flex; align-items: center; justify-content: center; margin-bottom: 20px; }
  .timer-time { font-family: 'Crimson Pro', serif; font-size: 42px; font-weight: 300; color: #e8dcc8; }
  .timer-mantra { font-size: 13px; color: #6b5f4a; margin-bottom: 28px; font-family: 'Crimson Pro', serif; font-style: italic; }
  .timer-btn { background: rgba(200,140,60,0.15); border: 0.5px solid rgba(200,140,60,0.35); border-radius: 40px; padding: 14px 36px; color: #c88c3c; font-size: 15px; cursor: pointer; transition: all 0.2s; font-family: 'Inter', sans-serif; }
  .timer-btn:hover { background: rgba(200,140,60,0.25); }
  .back-link { background: none; border: none; color: #6b5f4a; font-size: 13px; cursor: pointer; margin-top: 16px; font-family: 'Inter', sans-serif; }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: rgba(200,140,60,0.2); border-radius: 2px; }
`;

// ── Text renderer (handles *italic* markdown) ─────────────────────────────────
function RichText({ text }) {
  if (!text) return null;
  const parts = text.split(/(\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("*") && part.endsWith("*")
          ? <em key={i}>{part.slice(1, -1)}</em>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}

// ── Families for the scripture browser ───────────────────────────────────────
const FAMILIES = [
  { key: "all", label: "All" },
  { key: "gita", label: "Bhagavad Gita" },
  { key: "upanishad", label: "Upanishads" },
  { key: "yoga_sutras", label: "Yoga Sutras" },
  { key: "ramayana", label: "Ramayana" },
  { key: "mahabharata", label: "Mahabharata" },
  { key: "vedas", label: "Vedas" },
];

const SESSIONS = [
  { id: 1, icon: "🕉️", name: "Pranayama", desc: "Nadi Shodhana alternate nostril breathing", duration: 5, mantra: "Breathe in left… hold… out right…" },
  { id: 2, icon: "🪔", name: "Trataka", desc: "Steady gaze meditation — one-pointed focus", duration: 10, mantra: "Fix the gaze. Fix the mind." },
  { id: 3, icon: "🌸", name: "Om meditation", desc: "Chant the primordial sound into stillness", duration: 10, mantra: "Aum… Aum… Aum…" },
  { id: 4, icon: "🧘", name: "Yoga Nidra", desc: "Yogic sleep — deep conscious relaxation", duration: 20, mantra: "Rest between waking and sleep…" },
];

// ── Main App ──────────────────────────────────────────────────────────────────
export default function DharmaApp() {
  const [lang, setLang] = useState(() => localStorage.getItem('dharma_lang') || 'en');
  const [profile, setProfile] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('dharma_profile') || 'null');
      return saved && saved.onboarded ? saved : null;
    } catch {
      return null;
    }
  });

  const toggleLang = () => {
    const next = lang === 'en' ? 'hi' : 'en';
    setLang(next);
    localStorage.setItem('dharma_lang', next);
  };

  const handleOnboardingComplete = (nextProfile) => {
    setProfile(nextProfile);
  };

  const [tab, setTab] = useState("home");
  const [selectedMood, setSelectedMood] = useState(null);
  const [todayShloka] = useState(() => SCRIPTURES[new Date().getDate() % SCRIPTURES.length]);

  // Guide state
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [convHistory, setConvHistory] = useState([]);
  const chatBottomRef = useRef(null);

  // Scripture browser state
  const [familyFilter, setFamilyFilter] = useState("all");
  const [selectedScripture, setSelectedScripture] = useState(null);

  // Meditate state
  const [activeSession, setActiveSession] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(s => {
          if (s <= 1) { setTimerRunning(false); clearInterval(timerRef.current); return 0; }
          return s - 1;
        });
      }, 1000);
    } else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [timerRunning]);

  const sendMessage = async (text) => {
    const question = text || inputText.trim();
    if (!question || isLoading) return;
    setInputText("");
    setMessages(prev => [...prev, { type: "user", text: question }]);
    setIsLoading(true);

    try {
      const { reply, scriptures } = await askSpiritualGuide(question, selectedMood, convHistory, lang, profile);
      setMessages(prev => [...prev, { type: "assistant", text: reply, scriptures }]);
      setConvHistory(prev => [
        ...prev,
        { role: "user", content: question },
        { role: "assistant", content: reply },
      ]);
    } catch (err) {
      setMessages(prev => [...prev, {
        type: "assistant",
        text: "*The Gita reminds us:* Even in silence, the divine speaks. There seems to be a connection issue — please check your API key and try again. 🙏",
        scriptures: [],
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = s => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;

  const filteredScriptures = FAMILIES.find(f => f.key === familyFilter)?.key === "all"
    ? SCRIPTURES
    : SCRIPTURES.filter(s => s.text_family === familyFilter);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? (lang === 'hi' ? 'सुप्रभात' : 'Good morning') : hour < 17 ? (lang === 'hi' ? 'नमस्ते' : 'Good afternoon') : (lang === 'hi' ? 'शुभ संध्या' : 'Good evening');
  const welcomeName = profile?.name || (lang === 'hi' ? 'साधक' : 'seeker');
  const t = { tabs: { sadhana: lang === 'hi' ? 'साधना' : 'Sadhana' } };
  const navItems = lang === 'hi'
    ? [["home","होम"],["guide","मार्गदर्शक"],["texts","ग्रंथ"],["sadhana", t.tabs.sadhana || "साधना"]]
    : [["home","Home"],["guide","Guide"],["texts","Texts"],["sadhana", t.tabs.sadhana || "Sadhana"]];
  const starterQuestions = lang === 'hi'
    ? [
        "मैं अपने भविष्य को लेकर चिंतित क्यों रहता हूँ?",
        "जिसने मुझे धोखा दिया उससे कैसे निपटूँ?",
        "कष्ट का उद्देश्य क्या है?",
        "मैं अपना धर्म कैसे खोजूँ?",
        "मैं बहुत ज़्यादा सोचता रहता हूँ, गीता क्या कहती है?",
        "जिसने मुझे गहरी चोट दी उसे कैसे क्षमा करूँ?"
      ]
    : [
        "Why do I feel anxious about my future?",
        "How do I deal with someone who betrayed me?",
        "What is the purpose of suffering?",
        "How can I find my dharma?",
        "I can't stop overthinking. What does the Gita say?",
        "How do I forgive someone who hurt me deeply?"
      ];

  if (!profile || !profile.onboarded) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <>
      <style>{styles}</style>
      <div className="app">

        {/* ── Nav ── */}
        <div className="nav">
          <div className="nav-logo">Dharma</div>
          <div className="nav-tabs">
            {navItems.map(([t,l]) => (
              <button key={t} className={`nav-tab ${tab===t?"active":""}`} onClick={() => { setTab(t); setSelectedScripture(null); }}>{l}</button>
            ))}
          </div>
          <button onClick={toggleLang} style={{background:"rgba(200,140,60,0.15)",border:"0.5px solid rgba(200,140,60,0.35)",borderRadius:16,padding:"6px 12px",color:"#c88c3c",fontSize:12,cursor:"pointer",marginLeft:8}}>
            {lang === 'en' ? 'हिं' : 'EN'}
          </button>
        </div>

        {/* ── HOME ── */}
        {tab === "home" && (
          <div className="screen">
            <div className="greeting">{`${greeting}, ${welcomeName}`}{lang === 'hi' ? '।' : '.'}</div>
            <div className="greeting-sub">{new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}</div>

            <div className="stats-bar">
              <div className="stat-pill"><span>{SCRIPTURES.length}</span>{lang === 'hi' ? 'श्लोक' : 'scriptures'}</div>
              <div className="stat-pill"><span>6</span>{lang === 'hi' ? 'पवित्र ग्रंथ' : 'sacred texts'}</div>
              <div className="stat-pill"><span>ॐ</span>{lang === 'hi' ? 'दर्शन मार्ग' : 'sacred wisdom'}</div>
            </div>

            {/* Daily shloka */}
            <div className="shloka-card">
              <div className="shloka-label">{lang === 'hi' ? 'आज का श्लोक' : "Today's shloka"}</div>
              <div className="shloka-verse">{todayShloka.verse_sanskrit}</div>
              <div className="shloka-transliteration">{todayShloka.transliteration}</div>
              <div className="shloka-translation">{todayShloka.translation}</div>
              <div className="shloka-source">— {todayShloka.source}</div>
            </div>

            {/* Mood */}
            <div className="section-title">{lang === 'hi' ? 'आप कैसा महसूस कर रहे हैं?' : 'How are you feeling?'}</div>
            <div className="mood-grid">
              {MOODS.map(m => (
                <button key={m.value} className={`mood-btn ${selectedMood===m.value?"selected":""}`} onClick={() => setSelectedMood(m.value)}>
                  <span className="mood-emoji">{m.emoji}</span>
                  <span className="mood-label">{m.label}</span>
                </button>
              ))}
            </div>

            {/* Mood-matched verse */}
            {selectedMood && (() => {
              const match = findRelevantScriptures(selectedMood, selectedMood, 1)[0];
              return match ? (
                <div className="shloka-card" style={{marginBottom:20}}>
                  <div className="shloka-label" style={{color:"#8a7a60"}}>for this feeling</div>
                  <div className="shloka-verse" style={{fontSize:16}}>{match.verse_sanskrit}</div>
                  <div className="shloka-translation">{match.translation}</div>
                  <div className="shloka-source">— {match.source}</div>
                  <button style={{marginTop:14,background:"rgba(200,140,60,0.12)",border:"0.5px solid rgba(200,140,60,0.3)",borderRadius:8,padding:"9px 16px",color:"#c88c3c",fontSize:13,cursor:"pointer",fontFamily:"Inter,sans-serif",width:"100%"}}
                    onClick={() => { setTab("guide"); sendMessage(`I'm feeling ${selectedMood}. What does Hindu wisdom say about this?`); }}>
                    {lang === 'hi' ? 'इस बारे में मार्गदर्शक से पूछें →' : 'Ask the guide about this →'}
                  </button>
                </div>
              ) : null;
            })()}

            <div className="section-title">{lang === 'hi' ? 'अन्वेषण करें' : 'Explore'}</div>
            <div className="quick-row">
              <div className="quick-card" onClick={() => setTab("guide")}>
                <span className="quick-icon">✦</span>
                <div className="quick-name">{lang === 'hi' ? 'आध्यात्मिक मार्गदर्शक' : 'Spiritual guide'}</div>
                <div className="quick-desc">{lang === 'hi' ? 'जीवन के सवाल पूछें और संतुलित मार्गदर्शन प्राप्त करें' : 'Ask life questions and receive grounded guidance'}</div>
              </div>
              <div className="quick-card" onClick={() => setTab("texts")}>
                <span className="quick-icon">ॐ</span>
                <div className="quick-name">{lang === 'hi' ? 'पवित्र ग्रंथ' : 'Sacred texts'}</div>
                <div className="quick-desc">{lang === 'hi' ? '6 ग्रंथों में से ' + SCRIPTURES.length + '+ श्लोक देखें' : `Browse ${SCRIPTURES.length}+ verses across 6 texts`}</div>
              </div>
              <div className="quick-card" onClick={() => { setTab("guide"); sendMessage("What is my dharma? How do I find my purpose?"); }}>
                <span className="quick-icon">❀</span>
                <div className="quick-name">{lang === 'hi' ? 'अपना धर्म खोजें' : 'Find your dharma'}</div>
                <div className="quick-desc">{lang === 'hi' ? 'स्पष्टता के साथ उद्देश्य और मार्ग पर चिंतन करें' : 'Reflect on purpose and path with clarity'}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── GUIDE ── */}
        {tab === "guide" && (
          <div className="chat-screen">
            <div className="chat-header">
              <div className="section-title">Spiritual guide</div>
              <div style={{fontFamily:"'Crimson Pro',serif",fontSize:15,color:"#8a7a60",fontStyle:"italic"}}>
                {lang === 'hi' ? `${SCRIPTURES.length}+ पवित्र श्लोकों से प्राप्त उत्तर` : `Answers drawn from ${SCRIPTURES.length}+ sacred verses`}
              </div>
            </div>

            <div className="chat-area">
              {messages.length === 0 && (
                <div className="chat-empty">
                  <div className="chat-empty-symbol">ॐ</div>
                  <div className="chat-empty-text">{lang === 'hi' ? 'आपके द्वारा माँगे गए उत्तर आपके भीतर पहले से ही हैं। ग्रंथ केवल मार्ग को प्रकाश देते हैं।' : 'The answers you seek are already within you. The scriptures simply light the path.'}</div>
                  <div className="starter-grid">
                    {starterQuestions.map(q => (
                      <button key={q} className="starter-btn" onClick={() => sendMessage(q)}>{q}</button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`message ${msg.type}`}>
                  <div className={`bubble ${msg.type}`}>
                    {msg.type === "assistant" ? <RichText text={msg.text} /> : msg.text}
                  </div>
                  {msg.type === "assistant" && msg.scriptures?.length > 0 && (
                    <div className="scripture-chips">
                      {msg.scriptures.map(s => (
                        <span key={s.id} className="scripture-chip" onClick={() => { setTab("texts"); setSelectedScripture(s); }}>{s.source}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="message assistant">
                  <div className="typing-indicator">
                    <div className="typing-dot"/><div className="typing-dot"/><div className="typing-dot"/>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef}/>
            </div>

            <div className="chat-input-area">
              <textarea className="chat-input" placeholder={lang === 'hi' ? 'अपना प्रश्न पूछें...' : 'Ask your question...'} value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();} }}
                rows={1}
              />
              <button className="send-btn" onClick={()=>sendMessage()} disabled={!inputText.trim()||isLoading}>↑</button>
            </div>
          </div>
        )}

        {/* ── TEXTS (Scripture Browser) ── */}
        {tab === "texts" && (
          <div className="screen">
            {selectedScripture ? (
              <div className="scripture-detail">
                <button className="back-btn" onClick={() => setSelectedScripture(null)}>{lang === 'hi' ? '← ग्रंथों पर वापस' : '← Back to texts'}</button>
                <div className="detail-source">{selectedScripture.source}</div>
                <div className="detail-sanskrit">{selectedScripture.verse_sanskrit}</div>
                <div className="detail-transliteration">{selectedScripture.transliteration}</div>
                <div className="detail-translation">"{lang === 'hi' && selectedScripture.hindi_translation ? selectedScripture.hindi_translation : selectedScripture.translation}"</div>
                <div className="detail-commentary-label">{lang === 'hi' ? 'टीका' : 'Commentary'}</div>
                <div className="detail-commentary">{lang === 'hi' && selectedScripture.hindi_commentary ? selectedScripture.hindi_commentary : selectedScripture.commentary}</div>
                <div className="scripture-entry-tags" style={{marginBottom:20}}>
                  {selectedScripture.themes.map(t => <span key={t} className="tag">{t}</span>)}
                </div>
                <button className="ask-about-btn"
                  onClick={() => { setTab("guide"); sendMessage(`Tell me more about this teaching from ${selectedScripture.source}: "${lang === 'hi' && selectedScripture.hindi_translation ? selectedScripture.hindi_translation : selectedScripture.translation}"`); }}>
                  {lang === 'hi' ? 'इस श्लोक के बारे में मार्गदर्शक से पूछें →' : 'Ask the guide about this verse →'}
                </button>
              </div>
            ) : (
              <div className="scripture-browser">
                <div className="section-title">{lang === 'hi' ? 'पवित्र ग्रंथ' : 'Sacred texts'}</div>
                <div className="filter-row">
                  {FAMILIES.map(f => (
                    <button key={f.key} className={`filter-btn ${familyFilter===f.key?"active":""}`} onClick={()=>setFamilyFilter(f.key)}>{f.label}</button>
                  ))}
                </div>
                <div style={{fontSize:12,color:"#4a4030",marginBottom:8}}>{filteredScriptures.length} verses</div>
                {filteredScriptures.map(s => (
                  <div key={s.id} className="scripture-entry" onClick={() => setSelectedScripture(s)}>
                    <div className="scripture-entry-source">{s.source}</div>
                    <div className="scripture-entry-verse">{s.verse_sanskrit}</div>
                    <div className="scripture-entry-translation">{lang === 'hi' && s.hindi_translation ? s.hindi_translation : s.translation}</div>
                    <div className="scripture-entry-tags">
                      {s.emotions.slice(0,3).map(e => <span key={e} className="tag">{e}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "sadhana" && (
          <div className="screen">
            <SadhanaTracker t={t} />
          </div>
        )}

      </div>
    </>
  );
}
