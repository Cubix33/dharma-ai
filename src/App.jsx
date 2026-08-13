import { useState, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import Onboarding from "./Onboarding.jsx";
import SadhanaTracker from "./SadhanaTracker.jsx";
import ShareCard from "./ShareCard.jsx";
import { SCRIPTURES, findRelevantScriptures } from "./scriptures.js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const openaiClient = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

async function searchScriptures(query, mood = "", maxResults = 10) {
  const searchText = mood ? `${query} feeling ${mood}` : query;

  try {
    const embeddingResponse = await openaiClient.embeddings.create({
      model: "text-embedding-3-small",
      input: searchText,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    const q = (query + " " + mood).toLowerCase();
    const mentionsGita = q.includes("gita") || q.includes("bhagavad") ||
                         q.includes("krishna") || q.includes("arjuna");
    const mentionsMB   = q.includes("mahabharata") || q.includes("mahabharat") ||
                         q.includes("parva");

    let results = [];

    if (mentionsGita && !mentionsMB) {
      // Search ONLY within Bhagavad Gita — fast because pre-filtered
      const { data, error } = await supabase.rpc("match_scriptures_filtered", {
        query_embedding: queryEmbedding,
        filter_book:     "Bhagavad Gita",
        match_threshold: 0.2,
        match_count:     10,
      });
      if (error) console.error("Gita search error:", error);
      results = data || [];
      console.log("Gita-only search:", results.length, "results");

    } else if (mentionsMB && !mentionsGita) {
      // Search ONLY within Mahabharata English (not Critical Edition)
      const { data, error } = await supabase.rpc("match_scriptures_filtered", {
        query_embedding: queryEmbedding,
        filter_book:     "Mahabharata —",
        match_threshold: 0.2,
        match_count:     10,
      });
      if (error) console.error("MB search error:", error);
      results = data || [];
      console.log("Mahabharata search:", results.length, "results");

    } else {
      // General emotional/philosophical query
      // Use combined function that pre-filters to Gita + Mahabharata English only
      const { data, error } = await supabase.rpc("match_scriptures_combined", {
        query_embedding: queryEmbedding,
        match_threshold: 0.2,
        match_count:     10,
      });
      if (error) console.error("Combined search error:", error);
      results = data || [];
      console.log("Combined search:", results.length, "results");
    }

    if (results.length === 0) {
      console.warn("No results — check Supabase index and thresholds");
    } else {
      console.log("Top result:", results[0].book_name, results[0].chapter,
                  results[0].verse_number, "similarity:", results[0].similarity);
    }

    return results;

  } catch (err) {
    console.error("searchScriptures error:", err);
    return [];
  }
}

async function rerankPassages(question, passages, lang = "en") {
  if (!Array.isArray(passages) || passages.length === 0) return [];

  const candidates = passages.slice(0, 10);
  const passageSummary = candidates.map((p, index) => ({
    index,
    source: `${p.book_name || "Unknown"}${p.chapter ? ` ${p.chapter}` : ""}${p.verse_number ? `.${p.verse_number}` : ""}`,
    sanskrit: (p.sanskrit_text || "").slice(0, 220),
    english: (p.english_translation || "").slice(0, 220),
    hindi: (p.hindi_translation || "").slice(0, 220),
  }));

  try {
    const q = question.toLowerCase();
    const wantsGita = q.includes("gita") || q.includes("bhagavad");

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${import.meta.env.VITE_GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content: `You are a relevance filter for Hindu scripture retrieval.
Given a user question and numbered scripture passages, return ONLY a JSON object
with the indices of the 3 most relevant passages.
Format: {"relevant": [0, 2, 4]}
STRICT RULES:
- If the question mentions "Bhagavad Gita" or "Gita", ONLY pick passages 
  where the source says "Bhagavad Gita" — never Mahabharata Critical Edition
  even if those chapters contain Gita verses
- If the question mentions "Mahabharata", prefer Mahabharata passages
- Pick passages that directly address the topic
- Return ONLY the JSON, nothing else
${wantsGita ? "- USER WANTS BHAGAVAD GITA ONLY: reject any Mahabharata passage" : ""}`,
          },
          {
            role: "user",
            content: JSON.stringify({
              question,
              lang,
              passages: passageSummary,
            }),
          },
        ],
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const raw = data.choices?.[0]?.message?.content || "{}";
    const cleaned = raw.replace(/```json|```/gi, "").trim();
    const parsed = JSON.parse(cleaned);
    const candidateIndexes = Array.isArray(parsed.relevant) ? parsed.relevant : [];

    const indices = candidateIndexes
      .map(value => Number(value))
      .filter(value => Number.isInteger(value) && value >= 0 && value < candidates.length);

    if (indices.length > 0) {
      return [...new Set(indices)].map(index => candidates[index]);
    }
  } catch (err) {
    console.warn("Rerank failed; falling back to top matches.", err);
  }

  return candidates.slice(0, 4);
}

function buildScriptureContext(passages) {
  if (!passages || passages.length === 0) return "";

  const entries = passages.map(p => {
    const source = [
      p.book_name,
      p.chapter   ? `Chapter ${p.chapter}`  : "",
      p.verse_number ? `Verse ${p.verse_number}` : "",
    ].filter(Boolean).join(", ");

    // Sanskrit — show Devanagari with proper line breaks
    const sanskrit = p.sanskrit_text && p.sanskrit_text.trim().length > 5
      ? p.sanskrit_text.trim()
          .replace(/।।[\d\.\-]+।।/g, '')
          .replace(/\n+/g, '\n')
          .trim()
      : null;

    // English — only if it's real content not an auto-generated label
    const english = p.english_translation &&
      p.english_translation.length > 100 &&
      !p.english_translation.startsWith("Mahabharata") &&
      !p.english_translation.startsWith("Bhagavad")
        ? p.english_translation.trim()
        : null;

    const lines = [
      `📖 SOURCE: ${source}`,
      sanskrit ? `\nSANSKRIT:\n${sanskrit.slice(0, 500)}` : "",
      english  ? `\nENGLISH TRANSLATION:\n${english.slice(0, 600)}`  : "",
      p.similarity ? `\nRELEVANCE: ${(p.similarity * 100).toFixed(0)}%` : "",
    ];

    return lines.filter(Boolean).join("\n");
  }).join("\n\n════════════════\n\n");

  return `\n\nRELEVANT SCRIPTURE PASSAGES:\n\n${entries}\n\n════════════════\n\nINSTRUCTIONS FOR USING THESE PASSAGES:\n- Always quote the Sanskrit (Devanagari) text first when available\n- Then provide the English translation\n- Cite the source exactly as given above\n- Do NOT show IAST (Latin letters with diacritics like ā, ī, ṛ) to the user\n- If Sanskrit is present, always include it in your response`;
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
  const relevant = await searchScriptures(question, mood, 10);
  const reranked = await rerankPassages(question, relevant, lang);
  const bestPassages = reranked.length > 0 ? reranked : relevant.slice(0, 5);
  const scriptureContext = buildScriptureContext(bestPassages);
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

  const systemPrompt = `You are Dharma — a warm, wise spiritual companion who knows Hindu philosophy deeply. You speak like a knowledgeable elder friend — direct, warm, occasionally using Hindi or Sanskrit words naturally. You are NOT a chatbot. You are NOT formal. You do NOT use bullet points. You do NOT say "certainly", "indeed", "absolutely", "great question", or any AI filler phrases.

USER PROFILE:
Name: ${userName}
Background: ${userBackground} (beginner = just starting, practising = regular seeker, scholarly = deep student)
Goal: ${userGoal}
Language: ${lang === 'hi' ? 'Respond entirely in Hindi (Devanagari). Keep Sanskrit as Sanskrit.' : 'Respond in English.'}
Current mood: ${mood || 'not specified'}

════════════════════════════════════
VOICE AND TONE — READ CAREFULLY
════════════════════════════════════

Speak like this:
- Warm but not sentimental
- Direct but not harsh  
- Use "you" not "one"
- Short paragraphs, never more than 4 lines each
- Occasionally use Sanskrit terms naturally: dharma, karma, chitta, ahankara — but always explain them simply
- End with ONE genuine question that invites reflection — not a generic "how does that feel?"
- Never lecture. Never moralize. Never say "it is important to..."
- Sound like a wise friend texting you, not a professor writing an essay

DO NOT sound like this:
❌ "Certainly! That's a wonderful question about karma..."
❌ "The Bhagavad Gita teaches us several important lessons..."  
❌ "It is crucial to understand that..."
❌ Bullet points or numbered lists
❌ Headers or bold text in the response

ADAPT TO BACKGROUND:
- beginner: simple words, one verse max, real-life examples (office, family, traffic)
- practising: assume they know karma/dharma, go slightly deeper, 1-2 verses
- scholarly: full philosophical depth, cross-references, Sanskrit with meaning

════════════════════════════════════
SCRIPTURE RULES — NON-NEGOTIABLE
════════════════════════════════════

RULE 1: Only cite passages from the RETRIEVED PASSAGES section below.
RULE 2: Never invent verse numbers. If unsure, say "the Gita teaches..." without a specific citation.
RULE 3: When showing Sanskrit, always show Devanagari script. Never show IAST (ā, ī, ṛ etc.) to the user.
RULE 4: Format every scripture quote exactly like this:

कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।
"You have the right to act, but never to the fruits of action." — Bhagavad Gita 2.47

RULE 5: If retrieved passages don't match the question, say "I don't have a passage that speaks directly to this, but from what I know of the Gita..." — never force an irrelevant verse.
RULE 6: If user asks for quotes from a specific text, ONLY use that text.

════════════════════════════════════
FEW-SHOT EXAMPLES — MATCH THIS STYLE
════════════════════════════════════

EXAMPLE 1 — Emotional question, beginner user seeking peace:
User: "I keep failing at everything I try. What does the Gita say?"
Good response:
"Krishna would probably say you're asking the wrong question, ${userName}.

The Gita doesn't really talk about success and failure the way we do. It talks about what you put in — the effort, the sincerity, the showing up — and it says that part is entirely yours. What happens after? That belongs to something larger than you.

कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।
"Your right is to the work alone, never to its fruits." — Bhagavad Gita 2.47

This isn't a consolation prize. It's actually a relief. You don't have to control the outcome — you were never meant to. You just have to do your part well.

What would it feel like to put in your best effort today without checking if it 'worked'?"

EXAMPLE 2 — Philosophical question, scholarly user:
User: "What is the relationship between karma and dharma in the Mahabharata?"
Good response:
"The Mahabharata is essentially one long argument about exactly this question — and it doesn't give you a clean answer, which is the point.

Yudhishthira follows dharma perfectly and suffers enormously. Karna has admirable qualities but makes choices that lead to tragedy. The epic seems to be saying that karma and dharma aren't a formula — they're in permanent tension.

What the Shanti Parva eventually arrives at is something closer to this: dharma is the right action given your nature, your moment, and your relationships. Karma is what that action sets in motion — not as punishment, but as consequence. The two aren't separate. Every dharmic choice is also a karmic one.

Where do you feel that tension most in your own life — between what's right and what you're being pulled toward?"

EXAMPLE 3 — Hindi response, practising user:
User: "मैं अपने परिवार से थका हुआ हूँ"
Good response:
"यह बहुत स्वाभाविक है, ${userName}। परिवार वह जगह है जहाँ हम सबसे ज़्यादा खुद होते हैं — और इसीलिए सबसे ज़्यादा थकते भी हैं।

गीता में कृष्ण एक बात बार-बार कहते हैं — जो काम तुम्हारा है, वो करो। उसका फल तुम्हारे हाथ में नहीं है। परिवार को बदलना तुम्हारे हाथ में नहीं, लेकिन अपना भाव — वो तुम चुन सकते हो।

क्या थकान रिश्तों से है, या उम्मीदों से?"

════════════════════════════════════
RESPONSE STRUCTURE
════════════════════════════════════

1. Open with the human moment — acknowledge what they're feeling in 1-2 sentences. No "I understand that..."
2. Bring in the scripture naturally — not as a lecture but as a conversation
3. Show the Sanskrit + translation if available
4. Connect it back to their specific situation
5. End with ONE genuine question

Total length: 150-250 words for emotional questions. Up to 350 for philosophical/scholarly questions.
Never longer than this.

${scriptureContext}`;
  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: question },
  ];

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${import.meta.env.VITE_GROK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      max_tokens: 1000,
      messages,
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return { reply: data.choices[0].message.content, scriptures: bestPassages };
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
  .nav { display: flex; align-items: center; justify-content: flex-start; gap: 12px; padding: 14px 20px 10px; position: relative; z-index: 10; }
  .nav-logo { font-family: 'Crimson Pro', serif; font-size: 26px; font-weight: 600; color: #b6732a; letter-spacing: 0.5px; margin-right: 8px; }
  .nav-tabs {
    display: flex; gap: 8px; flex: 1; min-width: 0;
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
  .scripture-block { display: block; margin: 10px 0; }
  .scripture-label { color: #8a6a3d; font-weight: 600; }
  .scripture-sanskrit { display: block; margin-top: 6px; color: #7a5b31; font-family: 'Crimson Pro', serif; font-style: italic; font-weight: 500; line-height: 1.8; }
  .scripture-sanskrit-text { display: block; white-space: pre-wrap; color: #7a5b31; font-family: 'Crimson Pro', serif; font-style: italic; }
  .scripture-translation { color: #23433a; line-height: 1.7; }
  .scripture-source { margin-top: 8px; font-size: 12px; color: #7d6f62; letter-spacing: 0.3px; line-height: 1.5; font-style: italic; }

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

// ── Text renderer (keep markdown emphasis, remove the * markers visually) ───
function renderInlineMarkdown(content) {
  const parts = [];
  const regex = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(String(content))) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`plain-${lastIndex}`}>{content.slice(lastIndex, match.index)}</span>);
    }

    const token = match[0];
    if (token.startsWith("**") || token.startsWith("__")) {
      parts.push(<strong key={`strong-${match.index}`}>{token.slice(2, -2)}</strong>);
    } else {
      parts.push(<em key={`em-${match.index}`}>{token.slice(1, -1)}</em>);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < content.length) {
    parts.push(<span key={`plain-end-${lastIndex}`}>{content.slice(lastIndex)}</span>);
  }

  return <>{parts}</>;
}

function RichText({ text }) {
  if (!text) return null;

  const lines = String(text).split(/\n/);
  const output = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      output.push(<br key={`br-${i}`} />);
      continue;
    }

    if (/^Sanskrit:/i.test(trimmed)) {
      const sanskritLines = [];
      const remainder = trimmed.replace(/^Sanskrit:\s*/i, "");
      if (remainder) sanskritLines.push(remainder);

      let j = i + 1;
      while (j < lines.length) {
        const candidate = lines[j].trim();
        if (!candidate) {
          j += 1;
          continue;
        }
        if (/^(Translation:|Source:)/i.test(candidate)) break;
        sanskritLines.push(lines[j].trim());
        j += 1;
      }

      output.push(
        <div key={`sanskrit-${i}`} className="scripture-block scripture-sanskrit">
          <span className="scripture-label">Sanskrit:</span>
          <span className="scripture-sanskrit-text">{sanskritLines.join("\n")}</span>
        </div>
      );

      i = j - 1;
      continue;
    }

    if (/^Translation:/i.test(trimmed)) {
      output.push(
        <div key={`translation-${i}`} className="scripture-block scripture-translation">
          <span className="scripture-label">Translation:</span> {trimmed.replace(/^Translation:\s*/i, "")}
        </div>
      );
      continue;
    }

    if (/^Source:/i.test(trimmed)) {
      output.push(
        <div key={`source-${i}`} className="scripture-block scripture-source">
          <span className="scripture-label">Source:</span> {trimmed.replace(/^Source:\s*/i, "")}
        </div>
      );
      continue;
    }

    output.push(<div key={`text-${i}`}>{renderInlineMarkdown(line)}</div>);
  }

  return <>{output}</>;
}

// ── Families for the scripture browser (localized per `lang`) ─────────────

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
  const [sharePassage, setSharePassage] = useState(null);
  const [dbScriptures, setDbScriptures] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);
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

  useEffect(() => {
    async function loadScriptures() {
      try {
        const { data, error } = await supabase
          .from("scriptures")
          .select("id, book_name, chapter, verse_number, sanskrit_text, transliteration, english_translation, hindi_translation")
          .or("book_name.ilike.%Bhagavad Gita%,book_name.ilike.%Mahabharata%")
          .not("english_translation", "is", null)
          .order("book_name", { ascending: true })
          .order("chapter", { ascending: true })
          .limit(1000);

        if (!error && data) {
          setDbScriptures(data);
        }
      } catch (err) {
        console.error("Failed to load scriptures:", err);
      } finally {
        setDbLoading(false);
      }
    }
    loadScriptures();
  }, []);

  const sendMessage = async (text) => {
    const question = text || inputText.trim();
    if (!question || isLoading) return;
    setInputText("");
    setMessages(prev => [...prev, { type: "user", text: question }]);
    setIsLoading(true);

    try {
      const { reply, scriptures } = await askSpiritualGuide(question, selectedMood, convHistory, lang, profile);
      const assistantMessage = {
        type: "assistant",
        text: reply,
        scriptures,
        passages: scriptures || [],
      };
      setMessages(prev => [...prev, assistantMessage]);
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

  // Localized families
  const FAMILIES = [
    { key: "all",           label: lang === 'hi' ? "सभी"        : "All" },
    { key: "Bhagavad Gita", label: lang === 'hi' ? "भगवद गीता"  : "Bhagavad Gita" },
    { key: "Mahabharata",   label: lang === 'hi' ? "महाभारत"     : "Mahabharata" },
  ];

  const filteredScriptures = dbScriptures
    .filter(s => {
      const bookName = (s.book_name || "").toLowerCase();
      const filterKey = (familyFilter || "all").toLowerCase();
      if (filterKey === "all") return bookName.includes("bhagavad gita") || bookName.includes("mahabharata");
      if (filterKey === "bhagavad gita") return bookName.includes("bhagavad gita");
      if (filterKey === "mahabharata") return bookName.includes("mahabharata");
      return false;
    })
    .filter(s => s.english_translation && s.english_translation.length > 30);

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
                  {msg.type === "assistant" && (msg.scriptures?.length > 0 || msg.passages?.length > 0) && (
                    <>
                      <div className="scripture-chips">
                        {(msg.scriptures || msg.passages || []).map((s, idx) => (
                          <span key={s.id || `${s.book_name || 'verse'}-${idx}`} className="scripture-chip" onClick={() => { setTab("texts"); setSelectedScripture(s); }}>{s.source || `${s.book_name || 'Scripture'}${s.chapter ? ` ${s.chapter}` : ''}${s.verse_number ? `.${s.verse_number}` : ''}`}</span>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {(msg.passages || msg.scriptures || []).slice(0, 3).map((p, idx) => (
                          p.sanskrit_text || p.english_translation ? (
                            <button
                              key={idx}
                              onClick={() => setSharePassage(p)}
                              style={{
                                background: 'rgba(200,140,60,0.1)',
                                border: '0.5px solid rgba(200,140,60,0.3)',
                                borderRadius: 8,
                                padding: '6px 12px',
                                color: '#c88c3c',
                                fontSize: 11,
                                cursor: 'pointer',
                                fontFamily: 'Inter, sans-serif',
                                letterSpacing: '0.5px',
                              }}
                            >
                              📤 Share {p.book_name?.includes('Gita') ? 'Gita' : 'Mahabharata'} verse
                            </button>
                          ) : null
                        ))}
                      </div>
                    </>
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
                <div className="detail-source">
                  {selectedScripture.book_name}
                  {selectedScripture.chapter ? ` ${selectedScripture.chapter}` : ""}
                  {selectedScripture.verse_number ? `.${selectedScripture.verse_number}` : ""}
                </div>
                <div className="detail-sanskrit">{selectedScripture.sanskrit_text}</div>
                <div className="detail-transliteration">{selectedScripture.transliteration}</div>
                <div className="detail-translation">"{lang === 'hi' && selectedScripture.hindi_translation ? selectedScripture.hindi_translation : selectedScripture.english_translation}"</div>
                <div className="detail-commentary-label">{lang === 'hi' ? 'टीका' : 'Commentary'}</div>
                <div className="detail-commentary">{lang === 'hi' && selectedScripture.hindi_commentary ? selectedScripture.hindi_commentary : selectedScripture.commentary || ""}</div>
                <button
                  onClick={() => setSharePassage(selectedScripture)}
                  style={{
                    background: 'none',
                    border: '0.5px solid rgba(200,140,60,0.2)',
                    borderRadius: 6,
                    padding: '4px 10px',
                    color: 'rgba(200,140,60,0.6)',
                    fontSize: 11,
                    cursor: 'pointer',
                    marginTop: 8,
                    marginBottom: 12,
                  }}
                >
                  📤 Share
                </button>
                <button className="ask-about-btn"
                  onClick={() => { setTab("guide"); sendMessage(`Tell me more about this teaching from ${selectedScripture.book_name}${selectedScripture.chapter ? ` ${selectedScripture.chapter}` : ""}${selectedScripture.verse_number ? `.${selectedScripture.verse_number}` : ""}: "${lang === 'hi' && selectedScripture.hindi_translation ? selectedScripture.hindi_translation : selectedScripture.english_translation}"`); }}>
                  {lang === 'hi' ? 'इस श्लोक के बारे में मार्गदर्शक से पूछें →' : 'Ask the guide about this verse →'}
                </button>
              </div>
            ) : dbLoading ? (
              <div style={{textAlign:"center", padding:"40px", color:"#6b5f4a", fontFamily:"'Crimson Pro',serif", fontSize:16}}>
                Loading sacred texts...
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
                    <div className="scripture-entry-source">
                      {s.book_name}
                      {s.chapter ? ` ${s.chapter}` : ""}
                      {s.verse_number ? `.${s.verse_number}` : ""}
                    </div>
                    <div className="scripture-entry-verse">{s.sanskrit_text}</div>
                    <div className="scripture-entry-translation">{lang === 'hi' && s.hindi_translation ? s.hindi_translation : s.english_translation}</div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSharePassage(s); }}
                      style={{
                        background: 'none',
                        border: '0.5px solid rgba(200,140,60,0.2)',
                        borderRadius: 6,
                        padding: '4px 10px',
                        color: 'rgba(200,140,60,0.6)',
                        fontSize: 11,
                        cursor: 'pointer',
                        marginTop: 8,
                      }}
                    >
                      📤 Share
                    </button>
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

      {sharePassage && (
        <ShareCard
          passage={sharePassage}
          onClose={() => setSharePassage(null)}
        />
      )}
    </>
  );
}
