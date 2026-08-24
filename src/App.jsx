import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import OpenAI from "openai";
import Onboarding from "./Onboarding.jsx";
import SadhanaTracker from "./SadhanaTracker.jsx";
import ShareCard from "./ShareCard.jsx";
import Auth from "./Auth.jsx";
import { useAuth } from "./useAuth.js";
import { useTimeTheme } from './useTimeTheme.js';
import { supabase } from "./supabaseClient.js";

// ── DEV MODE — set to false before pushing to production ──
const DEV_MODE = false;

const DEV_RESPONSE = {
  reply: "Krishna speaks directly to this, Anchit. The Gita doesn't ask you to be fearless — it asks you to act despite the fear. That's the whole point of Arjuna's crisis on the battlefield. He was terrified too.\n\nकर्मण्येवाधिकारस्ते मा फलेषु कदाचन।\n\"Your right is to the work alone, never to its fruits.\" — Bhagavad Gita 2.47\n\nThe anxiety you feel about outcomes is human. But it's also a signal that you're attached to something specific happening. What would you do today if the result truly didn't matter?",
  scriptures: [
    {
      id: 999,
      book_name: "Bhagavad Gita",
      chapter: 2,
      verse_number: "47",
      sanskrit_text: "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।\nमा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि॥",
      english_translation: "You have the right to perform your duties, but you are not entitled to the fruits of your actions. Never consider yourself the cause of the results of your activities, and never be attached to not doing your duty.",
      hindi_translation: "कर्म करने का तुम्हें अधिकार है, परंतु उसके फल पर कभी नहीं।",
      similarity: 0.95,
    },
    {
      id: 998,
      book_name: "Mahabharata — Udyoga Parva",
      chapter: 5,
      verse_number: "LXXVII",
      sanskrit_text: "",
      english_translation: "Let a man deliberate and act, since deliberation is the root of all action. One who acts without deliberation destroys his own cause, like a lamp without oil.",
      hindi_translation: "",
      similarity: 0.82,
    }
  ]
};

const openaiClient = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || "placeholder-key",
  dangerouslyAllowBrowser: true,
});

async function saveToHistory(supabaseClient, deviceId, question, answer, passages, mood, userId) {
  try {
    console.log("  3. Saved to conversation_history:", passages.map(p => p.book_name).join(", "));
    await supabaseClient.from("conversation_history").insert({
      device_id: deviceId,
      user_id: userId || null,
      question: question.slice(0, 800),
      answer: answer.slice(0, 2500),
      sources: passages.map(p => p.book_name).join(", "),
      mood: mood || "",
      verses_shown: passages.map(p =>
        `${p.book_name} ${p.chapter}.${p.verse_number}`
      ).join(", "),
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.log("History save failed:", e.message);
  }
}

async function loadHistory(supabaseClient, deviceId) {
  try {
    const { data } = await supabaseClient
      .from("conversation_history")
      .select("question, sources, mood, verses_shown, created_at")
      .eq("device_id", deviceId)
      .order("created_at", { ascending: false })
      .limit(10);
    return data || [];
  } catch (e) {
    return [];
  }
}

async function searchScriptures(query, mood = "", maxResults = 10, bookHint = null) {
  const searchText = mood ? `${query} feeling ${mood}` : query;

  try {
    const embeddingResponse = await openaiClient.embeddings.create({
      model: "text-embedding-3-small",
      input: searchText,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    let results = [];

    if (bookHint === "gita") {
      // Caller already knows the scope — skip keyword guessing entirely
      const { data, error } = await supabase.rpc("match_scriptures_filtered", {
        query_embedding: queryEmbedding,
        filter_book:     "Bhagavad Gita",
        match_threshold: 0.2,
        match_count:     10,
      });
      if (error) console.error("Gita search error:", error);
      results = data || [];
      console.log("Gita-only search (hinted):", results.length, "results");

    } else if (bookHint === "mahabharata") {
      const { data, error } = await supabase.rpc("match_scriptures_filtered", {
        query_embedding: queryEmbedding,
        filter_book:     "Mahabharata —",
        match_threshold: 0.2,
        match_count:     10,
      });
      if (error) console.error("MB search error:", error);
      results = data || [];
      console.log("Mahabharata search (hinted):", results.length, "results");

    } else {
      const q = (query + " " + mood).toLowerCase();
      const mentionsGita = q.includes("gita") || q.includes("bhagavad") ||
                           q.includes("krishna") || q.includes("arjuna");
      const mentionsMB   = q.includes("mahabharata") || q.includes("mahabharat") ||
                           q.includes("parva");

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

// Lightweight passage formatter for the chapter-reading Q&A panel — unlike
// buildScriptureContext, it deliberately omits exact verse/chapter citation
// instructions since that context should be paraphrased, not cited precisely.
function formatRetrievedPassages(passages) {
  if (!passages || passages.length === 0) return "(no additional passages found)";
  return passages.map(p => {
    const source = p.book_name || "Unknown source";
    const text = (p.english_translation || "").trim();
    return `From ${source}: ${text}`;
  }).join("\n\n");
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

async function askSpiritualGuide(question, mood, conversationHistory, lang = "en", profile = null, sessionHistory = [], persistentHistory = [], queryMode = "guide") {
  // DEV MODE — skip API calls for UI testing
  if (DEV_MODE) {
    await new Promise(r => setTimeout(r, 500));
    return DEV_RESPONSE;
  }

  const relevant = await searchScriptures(question, mood, 10);
  const reranked = await rerankPassages(question, relevant, lang);
  const bestPassages = reranked.length > 0 ? reranked : relevant.slice(0, 5);
  console.log("RETRIEVAL CHAIN for:", JSON.stringify(question).slice(0, 80));
  console.log("  1. Raw retrieved (" + relevant.length + "):", relevant.map(p => p.book_name).join(", "));
  console.log("  2. After rerank (" + bestPassages.length + "):", bestPassages.map(p => p.book_name).join(", "));
  const scriptureContext = buildScriptureContext(bestPassages);
  const langInstruction = lang === "hi"
    ? "\nIMPORTANT: Respond ENTIRELY in Hindi (Devanagari script). Keep Sanskrit verses in Sanskrit but give ALL explanations in Hindi. Do not use English except for source references like 'Bhagavad Gita 2.47'.\n"
    : "";

  const sessionCtx = sessionHistory.length > 0
    ? "\nSESSION CONTEXT (what this user asked earlier today):\n" +
      sessionHistory.slice(-3).map((h, i) =>
        `${i+1}. "${h.question}" → topics: ${h.sources || "general"}`
      ).join("\n")
    : "";

  const persistCtx = persistentHistory.length > 0
    ? "\nUSER HISTORY (from previous sessions):\n" +
      persistentHistory.slice(0, 5).map((h, i) => {
        const mood = h.mood ? ` — felt: ${h.mood}` : "";
        return `${i+1}. Asked: "${h.question?.slice(0,80)}"${mood}`;
      }).join("\n") +
      (() => {
        const moods = persistentHistory
          .filter(h => h.mood)
          .map(h => h.mood);
        if (moods.length < 2) return "";
        const counts = moods.reduce((a, m) => ({ ...a, [m]: (a[m]||0)+1 }), {});
        const topMood = Object.entries(counts).sort((a,b) => b[1]-a[1])[0];
        if (topMood && topMood[1] >= 2) {
          return `\n→ Pattern noticed: this user frequently feels "${topMood[0]}" (${topMood[1]} times). Acknowledge this gently if relevant — their journey shows growth.`;
        }
        return "";
      })()
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
${sessionCtx}
${persistCtx}

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
  // Textual mode: user is exploring a passage, not seeking personal guidance
  if (queryMode === "textual") {
    const textualSystemPrompt = `You are Dharma — a knowledgeable guide to Hindu scripture and epic literature. The user is reading a specific passage or chapter and wants to understand it better — narratively, historically, or philosophically. They are NOT asking for a life lesson right now.

USER PROFILE:
Name: ${userName}
Background: ${userBackground}
Language: ${lang === 'hi' ? 'Respond entirely in Hindi (Devanagari). Keep Sanskrit as Sanskrit.' : 'Respond in English.'}

YOUR ROLE:
- Explain what is happening narratively in this passage (who, what, why)
- Draw out the dharmic or philosophical themes present in the actual text
- Mention related characters, events, or other parvas for context if relevant
- DO NOT project personal emotions onto the user
- DO NOT immediately leap to a life lesson unless they ask
- End with a question that invites them deeper into the text, not into self-reflection

VOICE: Engaged, curious, knowledgeable — like a scholar-friend who loves this epic.

ADAPT TO BACKGROUND:
- beginner: explain who the characters are, keep narrative clear, minimal Sanskrit
- practising: assume they know the main characters, go into themes and dharmic tension
- scholarly: full depth — intertextual references, philosophical schools, original Sanskrit

Length: 150–300 words. Narrative first, themes second, one question at end.

${scriptureContext}`;
    const textualMessages = [
      { role: "system", content: textualSystemPrompt },
      ...conversationHistory,
      { role: "user", content: question },
    ];
    const textualResponse = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${import.meta.env.VITE_GROK_API_KEY}`,
      },
      body: JSON.stringify({ model: "grok-4.5", max_tokens: 1000, messages: textualMessages }),
    });
    const textualData = await textualResponse.json();
    if (textualData.error) throw new Error(textualData.error.message);
    return { reply: textualData.choices[0].message.content, scriptures: bestPassages };
  }

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
    --panel-tint: rgba(17, 19, 22, 0.54);
    --panel-soft: rgba(255,255,255,0.08);
    --panel-strong: rgba(255,255,255,0.14);
    --text-main: #f8f2e8;
    --text-soft: #d5c4a2;
    --text-muted: #b8b2a3;
    --accent: #d9b36b;
    --accent-strong: #f0c86a;
    --card-border: rgba(255,255,255,0.1);
    max-width: 430px; margin: 0 auto; min-height: 100vh;
    display: flex; flex-direction: column;
    position: relative; overflow: hidden;
    box-shadow: 0 0 0 1px rgba(18, 30, 25, 0.04), 0 18px 40px rgba(45, 53, 46, 0.08);
    color: var(--text-main);
    background: linear-gradient(180deg, #040810 0%, #081220 100%);
  }
  .app::before {
    content: ''; position: fixed; top: -100px; left: 50%; transform: translateX(-50%);
    width: 340px; height: 340px;
    background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 28%, transparent 72%);
    pointer-events: none; z-index: 0;
  }
  .app.brahma { --panel-tint: rgba(21, 13, 24, 0.62); --panel-soft: rgba(255,255,255,0.07); --accent: #d9b36b; --text-soft: #f0d9af; }
  .app.sunrise { --panel-tint: rgba(20,8,0,0.60); --panel-soft: rgba(255,255,255,0.07); --accent: #ffaa44; --text-soft: #ffc878; }
  .app.day { --panel-tint: rgba(5,20,40,0.58); --panel-soft: rgba(255,255,255,0.08); --accent: #60b8ff; --text-soft: #90c8f0; }
  .app.sunset { --panel-tint: rgba(18,4,0,0.60); --panel-soft: rgba(255,255,255,0.07); --accent: #ff9a38; --text-soft: #ffb860; }
  .app.night { --panel-tint: rgba(5, 12, 18, 0.66); --panel-soft: rgba(255,255,255,0.06); --accent: #d9c48a; --text-soft: #dfe8f6; }

  /* Nav */
  .nav {
    display: flex; align-items: center; justify-content: flex-start; gap: 10px;
    padding: 14px 20px 10px; position: relative; z-index: 10;
    width: 100%; max-width: 100%; overflow: hidden;
    background: rgba(10, 13, 17, 0.26); backdrop-filter: blur(8px);
  }
  .nav-logo { flex-shrink: 0; font-family: 'Crimson Pro', serif; font-size: 26px; font-weight: 600; color: var(--accent); letter-spacing: 0.5px; margin-right: 4px; }
  .nav-tabs {
    display: flex; gap: 6px; flex: 1 1 auto; min-width: 0; width: 100%;
    background: rgba(16, 21, 26, 0.42); backdrop-filter: blur(8px);
    padding: 6px; border-radius: 18px; border: 1px solid rgba(255,255,255,0.08);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 10px 24px rgba(34, 42, 38, 0.12);
    overflow: hidden;
  }
  .nav-tab {
    flex: 1 1 auto; min-width: 0; background: transparent; border: none; color: rgba(233, 220, 199, 0.8); font-size: 12px; font-weight: 600;
    padding: 10px 6px; border-radius: 12px; cursor: pointer; font-family: 'Inter', sans-serif;
    transition: all 0.2s ease; letter-spacing: 0.02em; white-space: nowrap;
    text-overflow: clip;
  }
  .nav-tab.active {
    background: linear-gradient(135deg, rgba(214,157,69,0.9) 0%, rgba(239,196,96,0.95) 100%);
    color: #17130d; box-shadow: 0 8px 16px rgba(214,157,69,0.24);
  }

  /* Screens */
  .screen { flex: 1; padding: 16px 24px 32px; overflow-y: auto; position: relative; z-index: 1; background: rgba(9, 12, 14, 0.18); }

  /* Home */
  .greeting {
    font-family: 'Noto Sans Devanagari', 'Nirmala UI', 'Segoe UI', sans-serif;
    font-size: 28px;
    font-weight: 600;
    color: var(--text-main);
    line-height: 1.4;
    margin-bottom: 4px;
    unicode-bidi: plaintext;
    letter-spacing: -0.02em;
  }
  .greeting-sub {
    font-size: 12px; color: var(--text-soft); margin-bottom: 24px; display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 8px; line-height: 1.6; text-align: center;
  }

  .time-sky {
    position: absolute; inset: 0; pointer-events: none; z-index: 0; opacity: 0.95; transition: all 0.8s ease;
  }
  .time-sky.brahma {
    background: linear-gradient(180deg, rgba(18, 9, 20, 0.9), rgba(29, 12, 35, 0.28));
  }
  .time-sky.sunrise {
    background: linear-gradient(180deg, rgba(120, 46, 10, 0.28), rgba(255, 176, 87, 0.12));
  }
  .time-sky.day {
    background: linear-gradient(180deg, rgba(9, 19, 32, 0.28), rgba(18, 64, 108, 0.09));
  }
  .time-sky.sunset {
    background: linear-gradient(180deg, rgba(87, 26, 5, 0.26), rgba(225, 125, 68, 0.1));
  }
  .time-sky.night {
    background: linear-gradient(180deg, rgba(0, 5, 8, 0.7), rgba(9, 24, 39, 0.18));
  }

  .time-glow {
    position: absolute; left: 50%; transform: translateX(-50%); width: 210px; height: 210px; border-radius: 50%; filter: blur(42px); pointer-events: none; z-index: 0; transition: all 0.8s ease;
  }
  .time-glow.brahma { background: radial-gradient(circle, rgba(180,120,255,0.18), transparent 65%); top: 18px; }
  .time-glow.sunrise { background: radial-gradient(circle, rgba(255,165,70,0.22), transparent 70%); top: 16px; }
  .time-glow.day { background: radial-gradient(circle, rgba(182, 230, 255, 0.15), transparent 68%); top: 24px; }
  .time-glow.sunset { background: radial-gradient(circle, rgba(255,149,82,0.2), transparent 66%); top: 20px; }
  .time-glow.night { background: radial-gradient(circle, rgba(214, 230, 255, 0.16), transparent 68%); top: 16px; }

  .time-sun {
    position: absolute; left: 50%; transform: translateX(-50%); width: 120px; height: 120px; border-radius: 50%; pointer-events: none; z-index: 0; transition: all 0.8s ease;
    opacity: 0.9;
  }
  .time-sun.brahma {
    top: 12px; right: 18px; left: auto; transform: none; width: 36px; height: 36px;
    background: radial-gradient(circle at 38% 35%, #fff3c9, #d4c060);
    box-shadow: 0 0 26px rgba(212,192,96,0.45);
  }
  .time-sun.sunrise {
    top: 30px; right: 28px; left: auto; transform: none; width: 52px; height: 52px;
    background: radial-gradient(circle at 40% 40%, #fff4b5, #ffb530);
    box-shadow: 0 0 40px rgba(255,177,40,0.5), 0 0 80px rgba(255,116,22,0.18);
    animation: sunriseFloat 5s ease-in-out infinite alternate;
  }
  .time-sun.day {
    top: 18px; right: 28px; left: auto; transform: none; width: 38px; height: 38px;
    background: radial-gradient(circle at 40% 35%, #fffef1, #ffd840);
    box-shadow: 0 0 30px rgba(255,220,80,0.5);
  }
  .time-sun.sunset {
    bottom: 28px; left: 26px; right: auto; transform: none; width: 48px; height: 48px;
    background: radial-gradient(circle at 45% 40%, #fff1a5, #ff8820);
    box-shadow: 0 0 35px rgba(255,140,30,0.55), 0 0 70px rgba(255,80,10,0.2);
    animation: sunsetFloat 5s ease-in-out infinite alternate;
  }
  .time-sun.night {
    top: 16px; right: 32px; left: auto; transform: none; width: 32px; height: 32px;
    background: radial-gradient(circle at 38% 35%, #fff8e0, #d4c060);
    box-shadow: 0 0 24px rgba(212,192,96,0.35);
  }
  .app.brahma .nav, .app.brahma .screen, .app.brahma .chat-screen, .app.brahma .scripture-browser, .app.brahma .scripture-detail { background: rgba(19, 14, 27, 0.5); }
  .app.sunrise .nav, .app.sunrise .screen, .app.sunrise .chat-screen, .app.sunrise .scripture-browser, .app.sunrise .scripture-detail { background: rgba(53, 19, 1, 0.3); }
  .app.day .nav, .app.day .screen, .app.day .chat-screen, .app.day .scripture-browser, .app.day .scripture-detail { background: rgba(8, 22, 38, 0.28); }
  .app.sunset .nav, .app.sunset .screen, .app.sunset .chat-screen, .app.sunset .scripture-browser, .app.sunset .scripture-detail { background: rgba(61, 26, 8, 0.28); }
  .app.night .nav, .app.night .screen, .app.night .chat-screen, .app.night .scripture-browser, .app.night .scripture-detail { background: rgba(7, 16, 24, 0.4); }
  @keyframes sunriseFloat { 0% { transform: scale(0.96) translateY(6px); } 100% { transform: scale(1.08) translateY(-8px); } }
  @keyframes sunsetFloat { 0% { transform: scale(0.98) translateY(8px); } 100% { transform: scale(1.06) translateY(-10px); } }

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

  .section-title {
    font-size: 15px; color: var(--text-main); font-weight: 700; letter-spacing: 0.08em;
    margin: 22px 0 14px; font-family: 'Noto Sans Devanagari', 'Nirmala UI', 'Segoe UI', sans-serif;
    unicode-bidi: plaintext; text-transform: uppercase; opacity: 0.9;
  }

  /* Mood grid */
  .mood-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 24px; }
  .mood-btn {
    background: rgba(13, 17, 21, 0.42); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px 4px; cursor: pointer;
    text-align: center; transition: all 0.2s; color: var(--text-main); box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
  }
  .mood-btn:hover { border-color: rgba(240,200,110,0.5); background: rgba(240,200,110,0.08); }
  .mood-btn.selected { border-color: var(--accent); background: rgba(240,200,110,0.12); box-shadow: 0 12px 22px rgba(218,179,107,0.12); }
  .mood-emoji { font-size: 22px; display: block; margin-bottom: 6px; color: var(--accent); font-family: 'Segoe UI Symbol', 'Apple Color Emoji', 'Noto Sans Devanagari', sans-serif; line-height: 1; font-weight: 600; }
  .mood-label { font-size: 10px; color: rgba(240, 231, 216, 0.8); font-family: 'Noto Sans Devanagari', 'Nirmala UI', 'Segoe UI', sans-serif; }
  .mood-btn.selected .mood-label { color: var(--accent-strong); }

  /* Quick cards */
  .quick-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .quick-card {
    background: rgba(13, 17, 21, 0.42); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 18px; cursor: pointer;
    transition: all 0.2s; box-shadow: 0 10px 24px rgba(0,0,0,0.08);
  }
  .quick-card:hover { border-color: rgba(240,200,110,0.5); transform: translateY(-1px); background: rgba(17, 22, 28, 0.52); }
  .quick-icon { font-size: 24px; margin-bottom: 8px; display: block; color: var(--accent); font-family: 'Noto Sans Devanagari', 'Segoe UI Symbol', 'DejaVu Sans', sans-serif; line-height: 1; unicode-bidi: plaintext; }
  .quick-name { font-size: 13px; color: var(--text-main); font-weight: 600; margin-bottom: 3px; }
  .quick-desc { font-size: 11px; color: rgba(233, 220, 199, 0.75); line-height: 1.5; }

  /* Stats bar */
  .stats-bar { display: flex; gap: 10px; margin-bottom: 20px; }
  .stat-pill { background: rgba(255,255,255,0.12); border: 1px solid rgba(41,74,63,0.08); border-radius: 20px; padding: 8px 14px; font-size: 12px; color: var(--text-main); }
  .stat-pill span { color: #a86d2a; font-weight: 700; margin-right: 4px; }

  /* Chat */
  .chat-screen { display: flex; flex-direction: column; height: calc(100vh - 70px); padding: 16px 24px; }
  .chat-header { margin-bottom: 14px; }
  .chat-area { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; padding-bottom: 16px; }
  .chat-empty { text-align: center; padding: 30px 20px; }
  .chat-empty-symbol { font-size: 36px; margin-bottom: 12px; opacity: 0.5; }
  .chat-empty-text { font-family: 'Noto Sans Devanagari', 'Nirmala UI', 'Segoe UI', sans-serif; font-size: 16px; color: var(--text-soft); line-height: 1.7; margin-bottom: 20px; }
  .starter-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .starter-btn { background: rgba(255,255,255,0.10); border: 1px solid rgba(41,74,63,0.08); border-radius: 10px; padding: 10px 12px; cursor: pointer; text-align: left; color: var(--text-main); font-size: 12px; font-family: 'Noto Sans Devanagari', 'Nirmala UI', 'Segoe UI', sans-serif; transition: all 0.2s; line-height: 1.5; }
  .starter-btn:hover { border-color: rgba(110,166,128,0.3); color: #20493f; }

  .message { display: flex; flex-direction: column; gap: 4px; }
  .message.user { align-items: flex-end; }
  .message.assistant { align-items: flex-start; }

  .bubble { max-width: 88%; padding: 12px 16px; border-radius: 16px; font-size: 14px; line-height: 1.7; }
  .bubble.user { background: rgba(255,255,255,0.14); border: 1px solid rgba(255,200,120,0.30); color: var(--text-main); border-bottom-right-radius: 4px; }
  .bubble.assistant { background: rgba(255,255,255,0.93); border: 1px solid rgba(41,74,63,0.12); color: #12261f; font-family: 'Noto Sans Devanagari', 'Crimson Pro', serif; font-size: 16px; border-bottom-left-radius: 4px; white-space: pre-wrap; }
  .bubble.assistant em { color: #a56d2b; font-style: italic; }
  .scripture-block { display: block; margin: 10px 0; }
  .scripture-label { color: #8a6a3d; font-weight: 600; }
  .scripture-sanskrit { display: block; margin-top: 6px; color: #f5f0e8; font-family: 'Crimson Pro', serif; font-style: italic; font-weight: 500; line-height: 1.8; }
  .scripture-sanskrit-text { display: block; white-space: pre-wrap; color: #f5f0e8; font-family: 'Crimson Pro', serif; font-style: italic; }
  .scripture-translation { color: var(--text-main); line-height: 1.7; }
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
  .chat-input { flex: 1; background: rgba(255,255,255,0.10); border: 1px solid rgba(41,74,63,0.08); border-radius: 12px; padding: 12px 14px; color: var(--text-main); font-size: 14px; font-family: 'Inter', sans-serif; resize: none; outline: none; transition: border-color 0.2s; line-height: 1.5; min-height: 46px; max-height: 120px; }
  .chat-input:focus { border-color: rgba(166,109,43,0.35); }
  .chat-input::placeholder { color: var(--text-muted); }
  .send-btn { background: linear-gradient(135deg, #a56d2b 0%, #d8b15a 100%); border: none; border-radius: 12px; width: 46px; height: 46px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #fffaf2; font-size: 18px; transition: all 0.2s; flex-shrink: 0; }
  .send-btn:hover { filter: brightness(1.04); }
  .send-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  /* Scripture browser */
  .scripture-browser { display: flex; flex-direction: column; gap: 8px; }
  .filter-row { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
  .filter-row::-webkit-scrollbar { display: none; }
  .filter-btn { background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18); border-radius: 16px; padding: 6px 14px; font-size: 12px; color: var(--text-main); cursor: pointer; white-space: nowrap; transition: all 0.2s; font-family: 'Inter', sans-serif; }
  .filter-btn.active { background: rgba(166,109,43,0.08); border-color: rgba(166,109,43,0.18); color: #a56d2b; }

  .scripture-entry { position: relative; background: rgba(255,255,255,0.90); border: 1px solid rgba(41,74,63,0.12); border-radius: 12px; padding: 12px 36px 12px 14px; cursor: pointer; transition: all 0.2s; }
  .scripture-entry:hover { border-color: rgba(110,166,128,0.25); background: rgba(110,166,128,0.04); }
  .scripture-entry-source { font-size: 9px; letter-spacing: 1.2px; color: #a56d2b; text-transform: uppercase; margin-bottom: 6px; }
  .scripture-entry-verse { font-family: 'Crimson Pro', serif; font-size: 14px; color: #0e2218; line-height: 1.4; margin-bottom: 5px; }
  .scripture-entry-translation { font-size: 12px; color: #2a4a42; line-height: 1.45; margin-bottom: 0; }
  .scripture-entry-share-btn { position: absolute; top: 10px; right: 10px; background: none; border: none; padding: 4px; font-size: 13px; line-height: 1; color: rgba(200,140,60,0.7); cursor: pointer; opacity: 0.7; transition: opacity 0.2s; }
  .scripture-entry-share-btn:hover { opacity: 1; }
  .scripture-entry-tags { display: flex; flex-wrap: wrap; gap: 5px; }
  .tag { font-size: 10px; color: #51716a; background: rgba(255,255,255,0.52); border: 1px solid rgba(41,74,63,0.08); border-radius: 8px; padding: 2px 8px; }

  /* Scripture detail */
  .scripture-detail { padding: 4px 0; }
  .back-btn { background: none; border: none; color: var(--text-soft); font-size: 13px; cursor: pointer; font-family: 'Inter', sans-serif; margin-bottom: 20px; display: flex; align-items: center; gap: 6px; }
  .detail-source { font-size: 10px; letter-spacing: 2px; color: #a56d2b; text-transform: uppercase; margin-bottom: 16px; }
  .detail-sanskrit { font-family: 'Crimson Pro', serif; font-size: 22px; color: #f4efe7; line-height: 1.6; margin-bottom: 12px; }
  .detail-transliteration { font-size: 13px; color: #f0e7dd; font-style: italic; margin-bottom: 14px; line-height: 1.6; }
  .detail-translation { font-size: 16px; color: #f7f1ea; font-family: 'Crimson Pro', serif; line-height: 1.7; margin-bottom: 20px; padding: 16px; background: rgba(166,109,43,0.06); border-left: 2px solid rgba(166,109,43,0.22); border-radius: 0 8px 8px 0; }
  .detail-commentary-label { font-size: 10px; letter-spacing: 2px; color: var(--text-soft); text-transform: uppercase; margin-bottom: 10px; }
  .detail-commentary { font-size: 14px; color: var(--text-soft); line-height: 1.8; margin-bottom: 20px; }
  .ask-about-btn { background: rgba(166,109,43,0.1); border: 1px solid rgba(166,109,43,0.2); border-radius: 10px; padding: 12px 18px; color: #a56d2b; font-size: 13px; cursor: pointer; font-family: 'Inter', sans-serif; width: 100%; transition: all 0.2s; }
  .ask-about-btn:hover { background: rgba(166,109,43,0.14); }

  /* Meditate */
  .meditate-hero { text-align: center; padding: 20px 0 28px; }
  .mandala { width: 100px; height: 100px; border-radius: 50%; background: conic-gradient(from 0deg, rgba(200,140,60,0.3), rgba(200,140,60,0.05), rgba(200,140,60,0.3)); margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 36px; animation: rotateSlow 20s linear infinite; border: 0.5px solid rgba(200,140,60,0.2); }
  @keyframes rotateSlow { to { transform: rotate(360deg); } }
  .meditate-title { font-family: 'Crimson Pro', serif; font-size: 24px; font-weight: 300; color: #e8dcc8; margin-bottom: 6px; }
  .meditate-sub { font-size: 13px; color: var(--text-soft); }

  .session-grid { display: flex; flex-direction: column; gap: 10px; }
  .session-card { background: rgba(255,255,255,0.03); border: 0.5px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 18px 20px; display: flex; align-items: center; gap: 16px; cursor: pointer; transition: all 0.2s; }
  .session-card:hover { border-color: rgba(200,140,60,0.3); }
  .session-icon { font-size: 28px; flex-shrink: 0; }
  .session-name { font-size: 15px; color: #c4b48a; font-weight: 500; margin-bottom: 3px; }
  .session-desc { font-size: 12px; color: var(--text-soft); line-height: 1.5; }
  .session-dur { font-size: 12px; color: #c88c3c; background: rgba(200,140,60,0.1); padding: 4px 10px; border-radius: 20px; flex-shrink: 0; }

  .timer-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px; text-align: center; }
  .timer-circle { width: 160px; height: 160px; border-radius: 50%; border: 1px solid rgba(200,140,60,0.3); display: flex; align-items: center; justify-content: center; margin-bottom: 20px; }
  .timer-time { font-family: 'Crimson Pro', serif; font-size: 42px; font-weight: 300; color: #e8dcc8; }
  .timer-mantra { font-size: 13px; color: var(--text-soft); margin-bottom: 28px; font-family: 'Crimson Pro', serif; font-style: italic; }
  .timer-btn { background: rgba(200,140,60,0.15); border: 0.5px solid rgba(200,140,60,0.35); border-radius: 40px; padding: 14px 36px; color: #c88c3c; font-size: 15px; cursor: pointer; transition: all 0.2s; font-family: 'Inter', sans-serif; }
  .timer-btn:hover { background: rgba(200,140,60,0.25); }
  .back-link { background: none; border: none; color: var(--text-soft); font-size: 13px; cursor: pointer; margin-top: 16px; font-family: 'Inter', sans-serif; }

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

function RichText({ text, theme }) {
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
          <span className="scripture-sanskrit-text" style={{ color: theme.textPrimary, opacity: 0.95 }}>{sanskritLines.join("\n")}</span>
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

function Stars({ opacity = 0.6 }) {
  const stars = React.useMemo(() => (
    Array.from({ length: 80 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 1.5 + 0.5,
      delay: Math.random() * 4,
      duration: Math.random() * 3 + 2,
    }))
  ), []);

  return (
    <div style={{
      position: "fixed", inset: 0,
      pointerEvents: "none", zIndex: 0, opacity,
    }}>
      {stars.map(s => (
        <div key={s.id} style={{
          position: "absolute",
          left: `${s.x}%`,
          top: `${s.y}%`,
          width: s.size,
          height: s.size,
          borderRadius: "50%",
          background: "white",
          animation: `twinkle ${s.duration}s ${s.delay}s ease-in-out infinite alternate`,
        }} />
      ))}
      <style>{`
        @keyframes twinkle {
          from { opacity: 0.2; transform: scale(0.8); }
          to   { opacity: 0.9; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

function Celestial({ theme, tab }) {
  if (tab === 'sadhana') return null;
  if (!theme.celestialStyle) return null;
  if (theme.celestial === 'moon-clouds') {
    // Scattered across the top third of the screen, soft and slow-drifting
    // so they never clump behind the greeting text on narrow viewports.
    const clouds = [
      { left: '6%',  top: '5%',  width: 70, height: 26, opacity: 0.30, blur: 5, duration: 62, delay: -4,  drift: 22 },
      { left: '30%', top: '13%', width: 90, height: 32, opacity: 0.24, blur: 6, duration: 78, delay: -22, drift: 30 },
      { left: '58%', top: '4%',  width: 60, height: 22, opacity: 0.28, blur: 4, duration: 55, delay: -12, drift: 18 },
      { left: '18%', top: '24%', width: 54, height: 20, opacity: 0.20, blur: 5, duration: 70, delay: -34, drift: 20 },
      { left: '68%', top: '20%', width: 76, height: 28, opacity: 0.24, blur: 5, duration: 88, delay: -46, drift: 26 },
    ];

    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        height: '34vh',
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: 92,
          right: 36,
          width: 42,
          height: 42,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #fffef8, #e9edf8 52%, #d3d6e8 100%)',
          boxShadow: '0 0 24px rgba(242,246,255,0.55), 0 0 60px rgba(170,197,255,0.3)',
        }} />
        {clouds.map((cloud, index) => (
          <div key={index} style={{
            position: 'absolute',
            left: cloud.left,
            top: cloud.top,
            width: cloud.width,
            height: cloud.height,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.85)',
            opacity: cloud.opacity,
            filter: `blur(${cloud.blur}px)`,
            animation: `cloudDrift ${cloud.duration}s ${cloud.delay}s ease-in-out infinite alternate`,
            ['--cloud-drift']: `${cloud.drift}px`,
          }} />
        ))}
        <style>{`
          @keyframes cloudDrift {
            from { transform: translateX(0); }
            to   { transform: translateX(var(--cloud-drift)); }
          }
        `}</style>
      </div>
    );
  }

  if (theme.celestial === 'sun-high' || theme.celestial === 'sun-rising' || theme.celestial === 'sun-setting') {
    if (theme.name === 'Ratri' || theme.name === 'Brahma Muhurta') return null;
  }
  const isPulsing = theme.celestial === 'sun-rising' || theme.celestial === 'sun-setting';
  return (
    <div style={{
      ...theme.celestialStyle,
      position: 'fixed',
      zIndex: 0,
      pointerEvents: 'none',
      animation: isPulsing ? 'celestialPulse 4s ease-in-out infinite alternate' : undefined,
    }}>
      <style>{`
        @keyframes celestialPulse {
          from { transform: scale(0.95); filter: brightness(0.9); }
          to   { transform: scale(1.05); filter: brightness(1.1); }
        }
      `}</style>
    </div>
  );
}

function Birds({ theme }) {
  if (!theme || !['sun-rising', 'sun-setting'].includes(theme.celestial)) return null;

  const isSunset = theme.celestial === 'sun-setting';
  // Bright enough to show against the dark-rich backgrounds
  const birdColor = isSunset ? '#ffcc88' : '#ffd0a0';

  // Each bird: cx/cy = centre position in the 420×100 viewBox, s = scale
  const birds = [
    { cx: 52,  cy: 38, s: 0.55 },
    { cx: 118, cy: 22, s: 0.42 },
    { cx: 200, cy: 30, s: 0.62 },
    { cx: 278, cy: 16, s: 0.38 },
    { cx: 345, cy: 34, s: 0.48 },
  ];

  // Faint, shallow open-M silhouette — a soft hint of a wingbeat rather than a bold shape
  const wingPath = 'M-10,4 C-6,-1 -2,-2 0,0 C2,-2 6,-1 10,4';

  return (
    <div style={{
      position: 'fixed',
      top: 72,       // below the nav bar
      left: 0,
      right: 0,
      height: 120,
      pointerEvents: 'none',
      zIndex: 1,     // above orbs (z:0) but below nav (z:10)
      overflow: 'hidden',
    }}>
      <svg
        viewBox="0 0 420 100"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%' }}
      >
        {birds.map((b, i) => (
          <g key={i}>
            {/* Wrapper g handles position — animation g handles movement */}
            <g transform={`translate(${b.cx}, ${b.cy}) scale(${b.s})`}>
              <g>
                <path
                  d={wingPath}
                  fill="none"
                  stroke={birdColor}
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  opacity="0.4"
                />
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values={`0,0; ${5 + i * 2},${-4 - i}; 0,0`}
                  keyTimes="0; 0.5; 1"
                  dur={`${7 + i * 1.8}s`}
                  begin={`${i * 0.9}s`}
                  repeatCount="indefinite"
                  calcMode="spline"
                  keySplines="0.42 0 0.58 1; 0.42 0 0.58 1"
                />
              </g>
            </g>
          </g>
        ))}
      </svg>
    </div>
  );
}

function Orbs({ theme }) {
  return (
    <>
      {[theme.orb1, theme.orb2].filter(Boolean).map((orb, i) => (
        <div key={i} style={{
          position: "fixed",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${orb.color}, transparent 70%)`,
          width: orb.size,
          height: orb.size,
          top: orb.top !== undefined ? orb.top : "auto",
          bottom: orb.bottom !== undefined ? orb.bottom : "auto",
          left: orb.left !== undefined ? orb.left : "auto",
          right: orb.right !== undefined ? orb.right : "auto",
          pointerEvents: "none",
          zIndex: 0,
          filter: "blur(60px)",
          animation: `orbFloat ${8 + i * 3}s ease-in-out infinite alternate`,
        }} />
      ))}
      <style>{`
        @keyframes orbFloat {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(20px, -20px) scale(1.05); }
        }
      `}</style>
    </>
  );
}

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

  const theme = useTimeTheme();
  const [tab, setTab] = useState("home");
  const [selectedMood, setSelectedMood] = useState(null);
  const [sharePassage, setSharePassage] = useState(null);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [persistentHistory, setPersistentHistory] = useState([]);
  const [dbScriptures, setDbScriptures] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [todayShloka, setTodayShloka] = useState(null);
  const [moodShloka, setMoodShloka] = useState(null);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [accountMenuPos, setAccountMenuPos] = useState(null);
  const accountBtnRef = useRef(null);

  const { user, loading: authLoading, requestOtp, verifyOtpAndLogin, logout, clearMyHistory } = useAuth();

  // Today's home-card shloka — deterministic pick from the shlokas table
  // so it's stable across reloads within the same day, no mood filter.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("shlokas")
        .select("*")
        .eq("is_active", true);
      if (data && data.length > 0) {
        const idx = new Date().getDate() % data.length;
        setTodayShloka(data[idx]);
      }
    })();
  }, []);

  // Mood-matched shloka — refetched whenever selectedMood changes,
  // filtered by mood_tags overlap.
  useEffect(() => {
    if (!selectedMood) { setMoodShloka(null); return; }
    (async () => {
      const { data } = await supabase
        .from("shlokas")
        .select("*")
        .eq("is_active", true)
        .contains("mood_tags", [selectedMood])
        .limit(1);
      setMoodShloka(data && data.length > 0 ? data[0] : null);
    })();
  }, [selectedMood]);

  const deviceId = useMemo(() => {
    let id = localStorage.getItem("dharma_device_id");
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("dharma_device_id", id);
    }
    return id;
  }, []);

  // Guide state
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [convHistory, setConvHistory] = useState([]);
  const chatBottomRef = useRef(null);

  // Scripture browser state
  const [familyFilter, setFamilyFilter] = useState("Bhagavad Gita");
  const [selectedScripture, setSelectedScripture] = useState(null);
  const [selectedParva, setSelectedParva] = useState(null);
  const [selectedParvaBookName, setSelectedParvaBookName] = useState(null); // full book_name, needed for book_content queries
  const [textMode, setTextMode] = useState("browse"); // "browse" | "parva" | "detail" | "chapters" | "reading"
  const [parvaList, setParvaList] = useState([]);       // distinct parva names
  const [parvaVerses, setParvaVerses] = useState([]);   // verses for selected parva
  const [parvaLoading, setParvaLoading] = useState(false);
  const [chapterList, setChapterList] = useState([]);   // chapter numbers for selected Mahabharata parva
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [chapterText, setChapterText] = useState("");
  const [chapterLoading, setChapterLoading] = useState(false);
  const [chapterPage, setChapterPage] = useState(1);     // pagination within the chapter tile grid
  const [readingPage, setReadingPage] = useState(1);     // "flip page" position within a chapter's text
  const [chapterChatMessages, setChapterChatMessages] = useState([]); // in-session {role, content} thread for the current chapter
  const [chapterChatInput, setChapterChatInput] = useState("");
  const [chapterChatLoading, setChapterChatLoading] = useState(false);
  const [gitaChatMessages, setGitaChatMessages] = useState([]); // in-session {role, content} thread for the current verse
  const [gitaChatInput, setGitaChatInput] = useState("");
  const [gitaChatLoading, setGitaChatLoading] = useState(false);
  const [textsPage, setTextsPage] = useState(1);
  const [versePage, setVersePage] = useState(1);        // pagination within a chapter/parva
  const [textsLoaded, setTextsLoaded] = useState(false);

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
    if (tab !== "texts" || textsLoaded) return;

    async function loadInitialData() {
      try {
        // 1. Load all Gita verses — 701 rows, fits easily
        const { data: gitaData, error: gitaError } = await supabase
          .from("scriptures")
          .select("id, book_name, chapter, verse_number, sanskrit_text, transliteration, english_translation, hindi_translation")
          .ilike("book_name", "%Bhagavad Gita%")
          .not("english_translation", "is", null)
          .order("chapter", { ascending: true });

        if (!gitaError && gitaData) {
          setDbScriptures(gitaData);
          console.log("Gita loaded:", gitaData.length, "verses");
        }

        // 2. Load ONLY book_name for Mahabharata — tiny payload, just strings
        //    This gives us all distinct parva names without hitting row limits
        const { data: mbData, error: mbError } = await supabase
          .rpc("get_distinct_parvas");

        if (!mbError && mbData) {
          const distinctParvas = mbData
            .map(row => typeof row === 'string' ? row : row.book_name)
            .filter(Boolean);
          setParvaList(distinctParvas);
          console.log("Parvas loaded:", distinctParvas.length, distinctParvas);
        } else if (mbError) {
          console.error("Parva RPC error:", mbError.message, mbError);
        }

      } catch (err) {
        console.error("Failed to load scriptures:", err);
      } finally {
        setDbLoading(false);
      }
    }
    loadInitialData().then(() => setTextsLoaded(true));
  }, [tab, textsLoaded]);

  const loadParvaVerses = async (bookName) => {
    setParvaLoading(true);
    setParvaVerses([]);
    try {
      const { data, error } = await supabase
        .from("scriptures")
        .select("id, book_name, chapter, verse_number, sanskrit_text, transliteration, english_translation, hindi_translation")
        .eq("book_name", bookName)
        .not("english_translation", "is", null)
        .order("chapter", { ascending: true })
        .range(0, 999);

      if (!error && data) {
        // Sort verses numerically (verse_number stored as text)
        const sorted = data.sort((a, b) => {
          const chA = parseInt(a.chapter) || 0;
          const chB = parseInt(b.chapter) || 0;
          if (chA !== chB) return chA - chB;
          return (parseInt(a.verse_number) || 0) - (parseInt(b.verse_number) || 0);
        });
        setParvaVerses(sorted);
      }
    } catch (err) {
      console.error("Failed to load parva verses:", err);
    } finally {
      setParvaLoading(false);
    }
  };

  const loadChapters = async (bookName) => {
    setChapterLoading(true);
    setChapterList([]);
    try {
      const { data, error } = await supabase
        .from("book_content")
        .select("chapter")
        .eq("book_name", bookName)
        .eq("content_type", "chapter_text")
        .order("chapter", { ascending: true });

      if (!error && data) {
        setChapterList(data.map(row => row.chapter));
      } else if (error) {
        console.error("Failed to load chapters:", error.message, error);
      }
    } catch (err) {
      console.error("Failed to load chapters:", err);
    } finally {
      setChapterLoading(false);
    }
  };

  const loadChapterText = async (bookName, chapterNum) => {
    setChapterLoading(true);
    setChapterText("");
    try {
      const { data, error } = await supabase
        .from("book_content")
        .select("content")
        .eq("book_name", bookName)
        .eq("chapter", chapterNum)
        .eq("content_type", "chapter_text")
        .single();

      if (!error && data) {
        setChapterText(data.content || "");
      } else if (error) {
        console.error("Failed to load chapter text:", error.message, error);
      }
    } catch (err) {
      console.error("Failed to load chapter text:", err);
    } finally {
      setChapterLoading(false);
    }
  };

  const askAboutChapter = async (question) => {
    const q = (question || "").trim();
    if (!q || chapterChatLoading) return;
    setChapterChatInput("");
    setChapterChatLoading(true);
    try {
      // Broad vector search across scriptures — same retrieval used by the Guide tab,
      // not scoped to the current parva, since the reader may ask about anything.
      const relevant = await searchScriptures(q, "", 10, "mahabharata");
      const reranked = await rerankPassages(q, relevant, lang);
      const bestPassages = reranked.length > 0 ? reranked : relevant.slice(0, 5);
      console.log("RETRIEVAL CHAIN for:", JSON.stringify(q).slice(0, 80));
      console.log("  0. Current chapter always included:", selectedParvaBookName, "ch.", selectedChapter, `(${chapterText.length} chars)`);
      console.log("  1. Raw retrieved (" + relevant.length + "):", relevant.map(p => p.book_name).join(", "));
      console.log("  2. After rerank (" + bestPassages.length + "):", bestPassages.map(p => p.book_name).join(", "));
      const retrievedText = formatRetrievedPassages(bestPassages);

      const systemPrompt = `You are helping a reader understand the Mahabharata while they read a specific chapter. You have two sources of context:

1. CURRENT CHAPTER (the reader is looking at this right now — prioritize this for "what happens here" or "what does this mean" questions):
${chapterText}

2. ADDITIONAL PASSAGES FROM ELSEWHERE IN THE MAHABHARATA (use these for questions about characters, events, or context beyond the current chapter):
${retrievedText}

Answer using whichever source(s) are relevant. Prioritize source 1 for questions about the current chapter. Use source 2 for broader context (e.g. "what happens to this character later"). If neither source answers it, say so honestly. For Mahabharata/Ramayana citations from source 2, do not cite exact verse/chapter numbers — paraphrase instead.`;

      const messages = [
        { role: "system", content: systemPrompt },
        ...chapterChatMessages,
        { role: "user", content: q },
      ];

      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_GROK_API_KEY}`,
        },
        body: JSON.stringify({ model: "grok-4.5", max_tokens: 700, messages }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      const answer = data.choices?.[0]?.message?.content || "";

      setChapterChatMessages(prev => [...prev, { role: "user", content: q }, { role: "assistant", content: answer }]);

      console.log("  3. Saved to mahabharata_chapter_chat_history:", bestPassages.map(p => p.book_name).join(", "));
      await supabase.from("mahabharata_chapter_chat_history").insert({
        device_id: deviceId,
        user_id: user?.id || null,
        book_name: selectedParvaBookName,
        chapter: selectedChapter,
        question: q,
        answer,
        sources: bestPassages.map(p => p.book_name).join(", "),
      });
    } catch (err) {
      console.error("askAboutChapter failed:", err);
      setChapterChatMessages(prev => [...prev, { role: "user", content: q }, { role: "assistant", content: "Sorry, I couldn't find an answer to that just now." }]);
    } finally {
      setChapterChatLoading(false);
    }
  };

  const askAboutVerse = async (question) => {
    const q = (question || "").trim();
    if (!q || gitaChatLoading || !selectedScripture) return;
    setGitaChatInput("");
    setGitaChatLoading(true);
    try {
      // Broad vector search across scriptures — same retrieval used by the Guide tab
      // and the Mahabharata chapter chat — not scoped to just this verse.
      const relevant = await searchScriptures(q, "", 10, "gita");
      const reranked = await rerankPassages(q, relevant, lang);
      const bestPassages = reranked.length > 0 ? reranked : relevant.slice(0, 5);
      console.log("RETRIEVAL CHAIN for:", JSON.stringify(q).slice(0, 80));
      console.log("  0. Current verse always included: ch.", selectedScripture.chapter, "v.", selectedScripture.verse_number);
      console.log("  1. Raw retrieved (" + relevant.length + "):", relevant.map(p => p.book_name).join(", "));
      console.log("  2. After rerank (" + bestPassages.length + "):", bestPassages.map(p => p.book_name).join(", "));
      const retrievedText = formatRetrievedPassages(bestPassages);

      const systemPrompt = `You are helping a reader explore a specific verse of the Bhagavad Gita. You have two sources of context:

1. CURRENT VERSE (chapter ${selectedScripture.chapter}, verse ${selectedScripture.verse_number}):
Sanskrit: ${selectedScripture.sanskrit_text || "(not available)"}
Transliteration: ${selectedScripture.transliteration || "(not available)"}
Translation: ${selectedScripture.english_translation || "(not available)"}

2. ADDITIONAL RELATED VERSES FROM THE GITA OR ELSEWHERE:
${retrievedText}

Answer the user's question, prioritizing the current verse for direct questions about its meaning. Use source 2 for broader thematic or cross-referential questions. When citing Bhagavad Gita verses specifically, exact chapter/verse citations (e.g. "Chapter 2, Verse 47") ARE accurate and should be used normally. For any Mahabharata or Ramayana passages that come up in source 2, do not cite exact verse/chapter numbers for those — paraphrase instead. If the question can't be answered from available context, say so honestly.`;

      const messages = [
        { role: "system", content: systemPrompt },
        ...gitaChatMessages,
        { role: "user", content: q },
      ];

      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_GROK_API_KEY}`,
        },
        body: JSON.stringify({ model: "grok-4.5", max_tokens: 700, messages }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      const answer = data.choices?.[0]?.message?.content || "";

      setGitaChatMessages(prev => [...prev, { role: "user", content: q }, { role: "assistant", content: answer }]);

      console.log("  3. Saved to gita_chapter_chat_history:", bestPassages.map(p => p.book_name).join(", "));
      await supabase.from("gita_chapter_chat_history").insert({
        device_id: deviceId,
        user_id: user?.id || null,
        chapter: selectedScripture.chapter,
        verse_number: selectedScripture.verse_number,
        question: q,
        answer,
        sources: bestPassages.map(p => p.book_name).join(", "),
      });
    } catch (err) {
      console.error("askAboutVerse failed:", err);
      setGitaChatMessages(prev => [...prev, { role: "user", content: q }, { role: "assistant", content: "Sorry, I couldn't find an answer to that just now." }]);
    } finally {
      setGitaChatLoading(false);
    }
  };

  useEffect(() => {
    loadHistory(supabase, deviceId).then(setPersistentHistory);
  }, [deviceId]);

  const sendMessage = async (text, queryMode = "guide") => {
    const question = text || inputText.trim();
    if (!question || isLoading) return;
    setInputText("");
    setMessages(prev => [...prev, { type: "user", text: question }]);
    setIsLoading(true);

    try {
      const { reply, scriptures } = await askSpiritualGuide(question, selectedMood, convHistory, lang, profile, sessionHistory, persistentHistory, queryMode);

      const historyEntry = { question, sources: (scriptures || []).map(p => p.book_name).join(", ") || "" };
      setSessionHistory(prev => [...prev.slice(-4), historyEntry]);
      saveToHistory(supabase, deviceId, question, reply, scriptures || [], selectedMood, user?.id);

      const assistantMessage = {
        type: "assistant",
        text: reply,
        scriptures: scriptures || [],
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

  function getParvaName(book_name) {
    const match = (book_name || "").match(/Mahabharata\s*[—–-]\s*(.+)/i);
    return match ? match[1].trim() : (book_name || "Unknown");
  }

  // Splits chapter prose into book-style "pages" of roughly charsPerPage characters,
  // breaking on paragraph boundaries where possible so a page never cuts mid-word.
  function paginateChapterText(text, charsPerPage = 1400) {
    if (!text) return [];
    const blocks = text.split(/\n+/).filter(b => b.trim().length > 0);
    const pages = [];
    let current = "";
    const pushCurrent = () => { if (current) { pages.push(current); current = ""; } };
    for (let block of blocks) {
      while (block.length > charsPerPage) {
        let cut = block.lastIndexOf(' ', charsPerPage);
        if (cut <= 0) cut = charsPerPage;
        pushCurrent();
        pages.push(block.slice(0, cut).trim());
        block = block.slice(cut).trim();
      }
      if (current.length + block.length + 2 > charsPerPage) pushCurrent();
      current = current ? current + "\n\n" + block : block;
    }
    pushCurrent();
    return pages.length ? pages : [text];
  }

  function groupScriptures(scriptures, parvas, filterKey) {
    const groups = [];

    // Bhagavad Gita — group by chapter from loaded verses
    if (filterKey === "all" || filterKey === "Bhagavad Gita") {
      const gitaGroups = {};
      for (const s of scriptures) {
        if (!(s.book_name || "").toLowerCase().includes("bhagavad gita")) continue;
        const key = `Bhagavad Gita — Chapter ${s.chapter}`;
        if (!gitaGroups[key]) gitaGroups[key] = { label: key, isGita: true, entries: [], bookName: s.book_name };
        gitaGroups[key].entries.push(s);
      }
      // Sort chapters numerically
      const sorted = Object.values(gitaGroups).sort((a, b) => {
        const na = parseInt(a.label.match(/\d+/)?.[0] || 0);
        const nb = parseInt(b.label.match(/\d+/)?.[0] || 0);
        return na - nb;
      });
      // Sort verses within each chapter
      for (const g of sorted) {
        g.entries.sort((a, b) =>
          (parseInt(a.verse_number) || 0) - (parseInt(b.verse_number) || 0)
        );
      }
      groups.push(...sorted);
    }

    // Mahabharata — build from distinct parva names, no verse data needed here
    if (filterKey === "all" || filterKey === "Mahabharata") {
      for (const bookName of parvas) {
        if (!bookName.toLowerCase().startsWith("mahabharata")) continue;
        const label = (() => {
          const match = bookName.match(/Mahabharata\s*[—–-]\s*(.+)/i);
          return match ? match[1].trim() : bookName;
        })();
        groups.push({ label, isGita: false, entries: [], bookName });
      }
    }

    // Ramayana — build from distinct book names, no verse data needed here
    if (filterKey === "all" || filterKey === "Ramayana") {
      for (const bookName of parvas) {
        if (!bookName.toLowerCase().startsWith("ramayana")) continue;
        const label = (() => {
          const match = bookName.match(/Ramayana\s*[—–-]\s*(.+)/i);
          return match ? match[1].trim() : bookName;
        })();
        groups.push({ label, isGita: false, entries: [], bookName });
      }
    }

    return groups;
  }

  // Localized families
  const FAMILIES = [
    { key: "Bhagavad Gita", label: lang === 'hi' ? "भगवद गीता" : "Bhagavad Gita" },
    { key: "Mahabharata",   label: lang === 'hi' ? "महाभारत"    : "Mahabharata" },
    { key: "Ramayana",      label: lang === 'hi' ? "रामायण"     : "Ramayana" },
  ];

  const filteredScriptures = dbScriptures
    .filter(s => {
      const bookName = (s.book_name || "").toLowerCase();
      const filterKey = (familyFilter || "all").toLowerCase();
      if (filterKey === "all") return bookName.includes("bhagavad gita") || bookName.includes("mahabharata") || bookName.includes("ramayana");
      if (filterKey === "bhagavad gita") return bookName.includes("bhagavad gita");
      if (filterKey === "mahabharata") return bookName.startsWith("mahabharata —");
      if (filterKey === "ramayana") return bookName.startsWith("ramayana —");
      return false;
    })
    .filter(s => s.english_translation && s.english_translation.length > 30);

  const scripturePageSize = 20;
  const scriptureTotalPages = Math.max(1, Math.ceil(filteredScriptures.length / scripturePageSize));
  const scripturePage = Math.min(textsPage, scriptureTotalPages);
  const visibleScriptures = filteredScriptures.slice((scripturePage - 1) * scripturePageSize, scripturePage * scripturePageSize);
  const groupedScriptures = groupScriptures(filteredScriptures, parvaList, familyFilter);
  const parvaEntries = parvaVerses; // now loaded on demand, not derived from filteredScriptures

  const versePageSize = 15;
  const verseTotalPages = Math.max(1, Math.ceil(parvaEntries.length / versePageSize));
  const currentVersePage = Math.min(versePage, verseTotalPages);
  const visibleParvaEntries = parvaEntries.slice((currentVersePage - 1) * versePageSize, currentVersePage * versePageSize);

  const chapterPageSize = 20;
  const chapterTotalPages = Math.max(1, Math.ceil(chapterList.length / chapterPageSize));
  const currentChapterPage = Math.min(chapterPage, chapterTotalPages);
  const visibleChapters = chapterList.slice((currentChapterPage - 1) * chapterPageSize, currentChapterPage * chapterPageSize);

  const readingPages = paginateChapterText(chapterText);
  const readingTotalPages = Math.max(1, readingPages.length);
  const currentReadingPage = Math.min(readingPage, readingTotalPages);
  const currentReadingText = readingPages[currentReadingPage - 1] || "";

  useEffect(() => {
    setTextsPage(1);
  }, [familyFilter]);

  const now = new Date();
  const hour = now.getHours();
  const currentTimeText = now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const greeting = hour >= 5 && hour < 12
    ? (lang === 'hi' ? 'सुप्रभात' : 'Good morning')
    : hour >= 12 && hour < 17
      ? (lang === 'hi' ? 'नमस्ते' : 'Good afternoon')
      : hour >= 17 && hour < 20
        ? (lang === 'hi' ? 'शुभ संध्या' : 'Good evening')
        : (lang === 'hi' ? 'शुभ रात्रि' : 'Good night');
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

      <div
        style={{
          minHeight: "100vh",
          background: theme.bgGradient,
          color: theme.textPrimary,
          fontFamily: "'Inter', sans-serif",
          position: "relative",
          overflow: "hidden",
          transition: "background 2s ease",
        }}
      >
        {theme.showStars && <Stars opacity={theme.starOpacity} />}
        <Orbs theme={theme} />
        <Birds theme={theme} />
        <Celestial theme={theme} tab={tab} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="nav" style={{ background: theme.navBg, backdropFilter: "blur(20px)", borderBottom: `0.5px solid ${theme.cardBorder}` }}>
            <div className="nav-logo" style={{ color: theme.accent }}>Dharma</div>
            <div className="nav-tabs" style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
              {navItems.map(([t, l]) => (
                <button
                  key={t}
                  className={`nav-tab ${tab === t ? "active" : ""}`}
                  onClick={() => { setTab(t); setSelectedScripture(null); }}
                  style={
                    tab === t
                      ? { background: theme.accentBg, color: theme.textPrimary, boxShadow: `0 8px 16px ${theme.navGlow}` }
                      : { color: theme.textPrimary }
                  }
                >
                  {l}
                </button>
              ))}
            </div>
            <div style={{ position: "relative", marginLeft: 8 }}>
              <button
                ref={accountBtnRef}
                onClick={() => {
                  if (!showAccountMenu && accountBtnRef.current) {
                    const rect = accountBtnRef.current.getBoundingClientRect();
                    setAccountMenuPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
                  }
                  setShowAccountMenu(prev => !prev);
                }}
                style={{
                  background: theme.accentBg,
                  border: `0.5px solid ${theme.accentBorder}`,
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: theme.accent,
                  fontSize: 14,
                  cursor: "pointer",
                }}
                aria-label="Account menu"
              >
                {user ? (user.name || "U").charAt(0).toUpperCase() : "☰"}
              </button>

              {showAccountMenu && accountMenuPos && createPortal(
                <>
                  <div
                    onClick={() => setShowAccountMenu(false)}
                    style={{ position: "fixed", inset: 0, zIndex: 1000 }}
                  />
                  <div
                    style={{
                      position: "fixed",
                      top: accountMenuPos.top,
                      right: accountMenuPos.right,
                      background: theme.cardBg,
                      border: `1px solid ${theme.cardBorder}`,
                      borderRadius: 12,
                      padding: 12,
                      minWidth: 200,
                      zIndex: 1001,
                      boxShadow: "0 12px 28px rgba(0,0,0,0.35)",
                      backdropFilter: "blur(16px)",
                    }}
                  >
                    {user ? (
                      <>
                        <div style={{ fontSize: 12, color: theme.textSecondary, padding: "4px 6px 10px", fontFamily: "Inter, sans-serif" }}>
                          {lang === 'hi' ? 'साइन इन:' : 'Signed in as'} <strong style={{ color: theme.textPrimary }}>{user.name}</strong>
                        </div>
                        <button
                          onClick={async () => {
                            if (window.confirm(lang === 'hi' ? 'लॉग आउट करें?' : 'Log out?')) {
                              await logout();
                              setShowAccountMenu(false);
                            }
                          }}
                          style={{
                            width: "100%", textAlign: "left", background: "none", border: "none",
                            color: theme.textPrimary, fontSize: 13, padding: "8px 6px", cursor: "pointer",
                            fontFamily: "Inter, sans-serif", borderRadius: 8,
                          }}
                        >
                          {lang === 'hi' ? 'लॉग आउट' : 'Log out'}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => { setTab("account"); setShowAccountMenu(false); }}
                        style={{
                          width: "100%", textAlign: "left", background: "none", border: "none",
                          color: theme.textPrimary, fontSize: 13, padding: "8px 6px", cursor: "pointer",
                          fontFamily: "Inter, sans-serif", borderRadius: 8,
                        }}
                      >
                        {lang === 'hi' ? 'साइन इन करें' : 'Sign in'}
                      </button>
                    )}

                    <div style={{ borderTop: `0.5px solid ${theme.cardBorder}`, marginTop: 8, paddingTop: 8 }}>
                      <button
                        onClick={toggleLang}
                        style={{
                          width: "100%", textAlign: "left", background: "none", border: "none",
                          color: theme.textSecondary, fontSize: 13, padding: "8px 6px", cursor: "pointer",
                          fontFamily: "Inter, sans-serif", borderRadius: 8,
                        }}
                      >
                        {lang === 'en' ? 'हिंदी में बदलें' : 'Switch to English'}
                      </button>
                    </div>
                  </div>
                </>,
                document.body
              )}
            </div>
          </div>

          {tab === "account" && (
            <div className="screen" style={{ background: theme.cardBg, borderTop: `0.5px solid ${theme.cardBorder}` }}>
              {!user && !authLoading ? (
                <Auth
                  requestOtp={requestOtp}
                  verifyOtpAndLogin={verifyOtpAndLogin}
                  onSuccess={() => setTab("sadhana")}
                  lang={lang}
                />
              ) : (
                <div style={{ padding: 20, textAlign: "center", color: theme.textSecondary, fontFamily: "Inter, sans-serif" }}>
                  {lang === 'hi' ? `आप ${user?.name} के रूप में साइन इन हैं।` : `You're signed in as ${user?.name}.`}
                </div>
              )}
            </div>
          )}

          {tab === "home" && (
            <div className="screen" style={{ background: theme.cardBg, borderTop: `0.5px solid ${theme.cardBorder}` }}>
              <div className="greeting" style={{ color: theme.textPrimary }}>{`${greeting}, ${welcomeName}`}{lang === 'hi' ? '।' : '.'}</div>
              <div className="greeting-sub" style={{ color: theme.textSecondary }}>
                <span>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</span>
                <span style={{ marginLeft: 8, opacity: 0.9 }}>• {currentTimeText}</span>
              </div>
              {todayShloka && (
                <>
                  <div
                    className="shloka-card"
                    onClick={() => {
                      setTab("guide");
                      setTimeout(() => {
                        const shlokaQuestion = `Can you explain today's shloka in depth?\n${todayShloka.sanskrit_text || ''}\n${todayShloka.translation || ''}\nSource: ${todayShloka.source || 'Bhagavad Gita'}`;
                        sendMessage(shlokaQuestion);
                      }, 300);
                    }}
                    style={{ cursor: 'pointer', background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}
                  >
                    <div className="shloka-label">{lang === 'hi' ? 'आज का श्लोक' : "Today's shloka"}</div>
                    <div className="shloka-verse">{todayShloka.sanskrit_text}</div>
                    <div className="shloka-transliteration">{todayShloka.transliteration}</div>
                    <div className="shloka-translation">{todayShloka.translation}</div>
                    <div className="shloka-source">— {todayShloka.source}</div>
                  </div>

                  <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(200,140,60,0.5)', letterSpacing: '1px', marginTop: 8, fontFamily: 'Inter, sans-serif' }}>
                    TAP TO EXPLORE IN GUIDE →
                  </div>
                </>
              )}

              <div className="section-title">{lang === 'hi' ? 'आप कैसा महसूस कर रहे हैं?' : 'How are you feeling?'}</div>
              <div className="mood-grid">
                {MOODS.map(m => (
                  <button
                    key={m.value}
                    className={`mood-btn ${selectedMood === m.value ? "selected" : ""}`}
                    onClick={() => setSelectedMood(prev => prev === m.value ? null : m.value)}
                    style={selectedMood === m.value ? { background: theme.accentBg, border: `1px solid ${theme.accentBorder}` } : { background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}
                  >
                    <span className="mood-emoji" style={{ color: theme.accent }}>{m.emoji}</span>
                    <span className="mood-label" style={{ color: theme.textPrimary }}>{m.label}</span>
                  </button>
                ))}
              </div>

              {selectedMood && moodShloka && (
                <div className="shloka-card" style={{ marginBottom: 20 }}>
                  <div className="shloka-label" style={{ color: "#8a7a60" }}>for this feeling</div>
                  <div className="shloka-verse" style={{ fontSize: 16 }}>{moodShloka.sanskrit_text}</div>
                  <div className="shloka-translation">{moodShloka.translation}</div>
                  <div className="shloka-source">— {moodShloka.source}</div>
                  <button
                    style={{ marginTop: 14, background: "rgba(200,140,60,0.12)", border: "0.5px solid rgba(200,140,60,0.3)", borderRadius: 8, padding: "9px 16px", color: "#c88c3c", fontSize: 13, cursor: "pointer", fontFamily: "Inter,sans-serif", width: "100%" }}
                    onClick={() => { setTab("guide"); sendMessage(`I'm feeling ${selectedMood}. What does Hindu wisdom say about this?`); }}
                  >
                    {lang === 'hi' ? 'इस बारे में मार्गदर्शक से पूछें →' : 'Ask the guide about this →'}
                  </button>
                </div>
              )}

              <div className="section-title">{lang === 'hi' ? 'अन्वेषण करें' : 'Explore'}</div>
              <div className="quick-row">
                <div className="quick-card" onClick={() => setTab("guide")} style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
                  <span className="quick-icon" style={{ color: theme.accent }}>✦</span>
                  <div className="quick-name" style={{ color: theme.textPrimary }}>{lang === 'hi' ? 'आध्यात्मिक मार्गदर्शक' : 'Spiritual guide'}</div>
                  <div className="quick-desc" style={{ color: theme.textPrimary }}>{lang === 'hi' ? 'जीवन के सवाल पूछें और संतुलित मार्गदर्शन प्राप्त करें' : 'Ask life questions and receive grounded guidance'}</div>
                </div>
                <div className="quick-card" onClick={() => { setTab("guide"); sendMessage("What is my dharma? How do I find my purpose?"); }} style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
                  <span className="quick-icon" style={{ color: theme.accent }}>❀</span>
                  <div className="quick-name" style={{ color: theme.textPrimary }}>{lang === 'hi' ? 'अपना धर्म खोजें' : 'Find your dharma'}</div>
                  <div className="quick-desc" style={{ color: theme.textPrimary }}>{lang === 'hi' ? 'स्पष्टता के साथ उद्देश्य और मार्ग पर चिंतन करें' : 'Reflect on purpose and path with clarity'}</div>
                </div>
              </div>

              <button
                onClick={() => {
                  if (window.confirm('Reset all data? This clears your profile, streak, and history.')) {
                    localStorage.removeItem('dharma_profile');
                    localStorage.removeItem('dharma_lang');
                    localStorage.removeItem('dharma_sadhana');
                    localStorage.removeItem('dharma_device_id');
                    window.location.reload();
                  }
                }}
                style={{
                  background: 'none',
                  border: '0.5px solid rgba(255,80,80,0.2)',
                  borderRadius: 8,
                  padding: '8px 16px',
                  color: 'rgba(255,80,80,0.4)',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  letterSpacing: '1px',
                  marginTop: 16,
                }}
              >
                ↺ Reset App Data
              </button>
            </div>
          )}

          {tab === "guide" && (
            <div className="chat-screen" style={{ background: theme.cardBg }}>
              <div className="chat-header">
                <div className="section-title" style={{ color: theme.textPrimary }}>Spiritual guide</div>
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
                    <div
                      className={`bubble ${msg.type}`}
                      style={
                        msg.type === "assistant"
                          ? { background: theme.cardBg, color: theme.textPrimary, border: `0.5px solid ${theme.cardBorder}` }
                          : undefined
                      }
                    >
                      {msg.type === "assistant" ? <RichText text={msg.text} theme={theme} /> : msg.text}
                    </div>
                    {msg.type === 'assistant' && msg.scriptures && msg.scriptures.length > 0 && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {msg.scriptures.slice(0, 3).map((p, index) => (
                          p.sanskrit_text || (p.english_translation && p.english_translation.length > 100) ? (
                            <button
                              key={index}
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
                              }}
                            >
                              📤 {p.book_name?.includes('Gita') ? 'Share Gita verse' : 'Share passage'}
                            </button>
                          ) : null
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="message assistant">
                    <div className="typing-indicator">
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              <div className="chat-input-area">
                <textarea
                  className="chat-input"
                  placeholder={lang === 'hi' ? 'अपना प्रश्न पूछें...' : 'Ask your question...'}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  rows={1}
                  style={{ background: theme.inputBg, color: theme.textPrimary, border: `0.5px solid ${theme.cardBorder}` }}
                />
                <button
                  className="send-btn"
                  onClick={() => sendMessage()}
                  disabled={!inputText.trim() || isLoading}
                  style={{ background: theme.accentBg, border: `0.5px solid ${theme.accentBorder}`, color: theme.accent }}
                >
                  ↑
                </button>
              </div>
            </div>
          )}

          {tab === "texts" && (
            <div className="screen" style={{ background: theme.cardBg }}>

              {/* ── DETAIL VIEW ── */}
              {textMode === "detail" && selectedScripture && (
                <div className="scripture-detail">
                  <button className="back-btn" onClick={() => { setSelectedScripture(null); setTextMode("parva"); }}>
                    ← Back to {selectedParva}
                  </button>
                  <div className="detail-source">
                    {selectedScripture.book_name}
                    {selectedScripture.chapter ? ` · Ch ${selectedScripture.chapter}` : ""}
                    {selectedScripture.verse_number ? ` · ${selectedScripture.verse_number}` : ""}
                  </div>
                  {selectedScripture.sanskrit_text && (
                    <div className="detail-sanskrit">{selectedScripture.sanskrit_text}</div>
                  )}
                  {selectedScripture.transliteration && (
                    <div className="detail-transliteration">{selectedScripture.transliteration}</div>
                  )}
                  <div className="detail-translation">
                    "{lang === 'hi' && selectedScripture.hindi_translation
                      ? selectedScripture.hindi_translation
                      : selectedScripture.english_translation}"
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, marginBottom: 16 }}>
                    <button
                      onClick={() => setSharePassage(selectedScripture)}
                      style={{ background: 'none', border: '0.5px solid rgba(200,140,60,0.2)', borderRadius: 6, padding: '4px 10px', color: 'rgba(200,140,60,0.6)', fontSize: 11, cursor: 'pointer' }}
                    >
                      📤 Share
                    </button>
                  </div>
                  {(selectedScripture.book_name || "").toLowerCase().includes("bhagavad gita") ? (
                    <div style={{ marginTop: 8, borderTop: `1px solid ${theme.cardBorder}`, paddingTop: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: theme.textPrimary, fontFamily: 'Inter, sans-serif', marginBottom: 10 }}>
                        {lang === 'hi' ? 'इस श्लोक के बारे में पूछें' : 'Explore this passage'}
                      </div>
                      <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10, paddingRight: 4 }}>
                        {gitaChatMessages.length === 0 && !gitaChatLoading && (
                          <div style={{ fontSize: 12, color: theme.textMuted, fontFamily: 'Inter, sans-serif' }}>
                            {lang === 'hi'
                              ? 'इस श्लोक के अर्थ के बारे में पूछें, या गीता के अन्य भागों से इसका संबंध जानें।'
                              : "Ask what this verse means, or how it connects to other themes in the Gita."}
                          </div>
                        )}
                        {gitaChatMessages.map((m, i) => (
                          <div
                            key={i}
                            style={{
                              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                              maxWidth: '85%',
                              background: m.role === 'user' ? 'rgba(200,140,60,0.16)' : 'rgba(0,0,0,0.28)',
                              border: `1px solid ${theme.cardBorder}`,
                              borderRadius: 12,
                              padding: '8px 12px',
                              fontSize: 13,
                              lineHeight: 1.5,
                              color: theme.textPrimary,
                              fontFamily: 'Inter, sans-serif',
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {m.content}
                          </div>
                        ))}
                        {gitaChatLoading && (
                          <div style={{ fontSize: 12, color: theme.textMuted, fontFamily: 'Inter, sans-serif' }}>
                            {lang === 'hi' ? 'सोच रहा हूँ…' : 'Thinking…'}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="text"
                          value={gitaChatInput}
                          onChange={e => setGitaChatInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askAboutVerse(gitaChatInput); } }}
                          placeholder={lang === 'hi' ? 'इस श्लोक के बारे में पूछें…' : 'Ask about this verse…'}
                          disabled={gitaChatLoading}
                          style={{
                            flex: 1,
                            background: theme.inputBg,
                            color: theme.textPrimary,
                            border: `0.5px solid ${theme.cardBorder}`,
                            borderRadius: 8,
                            padding: '8px 10px',
                            fontSize: 13,
                            fontFamily: 'Inter, sans-serif',
                          }}
                        />
                        <button
                          onClick={() => askAboutVerse(gitaChatInput)}
                          disabled={!gitaChatInput.trim() || gitaChatLoading}
                          style={{
                            background: theme.accentBg,
                            border: `0.5px solid ${theme.accentBorder}`,
                            color: theme.accent,
                            borderRadius: 8,
                            padding: '8px 14px',
                            fontSize: 13,
                            cursor: (!gitaChatInput.trim() || gitaChatLoading) ? 'not-allowed' : 'pointer',
                            opacity: (!gitaChatInput.trim() || gitaChatLoading) ? 0.5 : 1,
                          }}
                        >
                          ↑
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="ask-about-btn"
                      onClick={() => {
                        const src = selectedScripture;
                        const ref = `${src.book_name}${src.chapter ? ` Chapter ${src.chapter}` : ""}${src.verse_number ? ` verse ${src.verse_number}` : ""}`;
                        const translation = lang === 'hi' && src.hindi_translation ? src.hindi_translation : src.english_translation;
                        const q = `I'm reading ${ref}. Can you tell me what is happening narratively here, what this passage is about, and what themes are present? The passage says: "${(translation || "").slice(0, 300)}"`;
                        setTab("guide");
                        sendMessage(q, "textual");
                      }}
                    >
                      {lang === 'hi' ? 'इस अध्याय के बारे में और जानें →' : 'Explore this passage with the guide →'}
                    </button>
                  )}
                </div>
              )}

              {/* ── READING VIEW (Mahabharata chapter text) ── */}
              {textMode === "reading" && selectedChapter && (
                <div>
                  <button
                    className="back-btn"
                    onClick={() => {
                      setSelectedChapter(null);
                      setChapterText("");
                      setReadingPage(1);
                      setTextMode("chapters");
                    }}
                  >
                    ← Back to {selectedParva}
                  </button>
                  <div className="detail-source" style={{ marginBottom: 20 }}>
                    {selectedParva} · Chapter {selectedChapter}
                    {readingTotalPages > 1 ? ` · Page ${currentReadingPage} of ${readingTotalPages}` : ""}
                  </div>
                  {chapterLoading ? (
                    <div style={{ textAlign: "center", padding: "40px", color: "#6b5f4a", fontFamily: "'Crimson Pro',serif", fontSize: 16 }}>
                      Loading chapter...
                    </div>
                  ) : (
                    <>
                    <div
                      style={{
                        maxWidth: 640,
                        minHeight: '55vh',
                        margin: '0 auto',
                        fontFamily: "'Crimson Pro', serif",
                        fontSize: 18,
                        lineHeight: 1.85,
                        color: theme.textPrimary,
                        whiteSpace: 'pre-wrap',
                        paddingBottom: 24,
                      }}
                    >
                      {currentReadingText || "No text available for this chapter."}
                    </div>
                    {readingTotalPages > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 8, paddingBottom: 8 }}>
                        <button
                          onClick={() => setReadingPage(p => Math.max(1, p - 1))}
                          disabled={currentReadingPage === 1}
                          style={{
                            background: 'rgba(200,140,60,0.1)',
                            border: '0.5px solid rgba(200,140,60,0.2)',
                            borderRadius: 8,
                            padding: '8px 12px',
                            color: '#b6732a',
                            cursor: currentReadingPage === 1 ? 'not-allowed' : 'pointer',
                            opacity: currentReadingPage === 1 ? 0.5 : 1,
                            fontFamily: 'Inter, sans-serif',
                          }}
                        >
                          ← Prev page
                        </button>
                        <span style={{ fontSize: 12, color: theme.textMuted, fontFamily: 'Inter, sans-serif' }}>
                          Page {currentReadingPage} / {readingTotalPages}
                        </span>
                        <button
                          onClick={() => setReadingPage(p => Math.min(readingTotalPages, p + 1))}
                          disabled={currentReadingPage === readingTotalPages}
                          style={{
                            background: 'rgba(200,140,60,0.1)',
                            border: '0.5px solid rgba(200,140,60,0.2)',
                            borderRadius: 8,
                            padding: '8px 12px',
                            color: '#b6732a',
                            cursor: currentReadingPage === readingTotalPages ? 'not-allowed' : 'pointer',
                            opacity: currentReadingPage === readingTotalPages ? 0.5 : 1,
                            fontFamily: 'Inter, sans-serif',
                          }}
                        >
                          Next page →
                        </button>
                      </div>
                    )}

                    {/* ── ASK ABOUT THIS CHAPTER ── */}
                    <div style={{ maxWidth: 640, margin: '24px auto 0', borderTop: `1px solid ${theme.cardBorder}`, paddingTop: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: theme.textPrimary, fontFamily: 'Inter, sans-serif', marginBottom: 10 }}>
                        {lang === 'hi' ? 'इस अध्याय के बारे में पूछें' : 'Ask about this chapter'}
                      </div>
                      <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10, paddingRight: 4 }}>
                        {chapterChatMessages.length === 0 && !chapterChatLoading && (
                          <div style={{ fontSize: 12, color: theme.textMuted, fontFamily: 'Inter, sans-serif' }}>
                            {lang === 'hi'
                              ? 'इस अध्याय में क्या हो रहा है, या महाभारत में कहीं और के पात्रों/घटनाओं के बारे में पूछें।'
                              : "Ask what's happening in this chapter, or about characters and events elsewhere in the Mahabharata."}
                          </div>
                        )}
                        {chapterChatMessages.map((m, i) => (
                          <div
                            key={i}
                            style={{
                              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                              maxWidth: '85%',
                              background: m.role === 'user' ? 'rgba(200,140,60,0.16)' : 'rgba(0,0,0,0.28)',
                              border: `1px solid ${theme.cardBorder}`,
                              borderRadius: 12,
                              padding: '8px 12px',
                              fontSize: 13,
                              lineHeight: 1.5,
                              color: theme.textPrimary,
                              fontFamily: 'Inter, sans-serif',
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {m.content}
                          </div>
                        ))}
                        {chapterChatLoading && (
                          <div style={{ fontSize: 12, color: theme.textMuted, fontFamily: 'Inter, sans-serif' }}>
                            {lang === 'hi' ? 'सोच रहा हूँ…' : 'Thinking…'}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="text"
                          value={chapterChatInput}
                          onChange={e => setChapterChatInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askAboutChapter(chapterChatInput); } }}
                          placeholder={lang === 'hi' ? 'इस अध्याय के बारे में पूछें…' : 'Ask about this chapter…'}
                          disabled={chapterChatLoading}
                          style={{
                            flex: 1,
                            background: theme.inputBg,
                            color: theme.textPrimary,
                            border: `0.5px solid ${theme.cardBorder}`,
                            borderRadius: 8,
                            padding: '8px 10px',
                            fontSize: 13,
                            fontFamily: 'Inter, sans-serif',
                          }}
                        />
                        <button
                          onClick={() => askAboutChapter(chapterChatInput)}
                          disabled={!chapterChatInput.trim() || chapterChatLoading}
                          style={{
                            background: theme.accentBg,
                            border: `0.5px solid ${theme.accentBorder}`,
                            color: theme.accent,
                            borderRadius: 8,
                            padding: '8px 14px',
                            fontSize: 13,
                            cursor: (!chapterChatInput.trim() || chapterChatLoading) ? 'not-allowed' : 'pointer',
                            opacity: (!chapterChatInput.trim() || chapterChatLoading) ? 0.5 : 1,
                          }}
                        >
                          ↑
                        </button>
                      </div>
                    </div>
                    </>
                  )}
                </div>
              )}

              {/* ── CHAPTER TILES VIEW (Mahabharata) ── */}
              {textMode === "chapters" && selectedParva && (
                <div>
                  <button
                    className="back-btn"
                    onClick={() => {
                      setSelectedParva(null);
                      setSelectedParvaBookName(null);
                      setChapterList([]);
                      setChapterPage(1);
                      setTextMode("browse");
                    }}
                  >
                    ← Back to texts
                  </button>
                  <div className="detail-source" style={{ marginBottom: 20 }}>{selectedParva}</div>
                  {chapterLoading ? (
                    <div style={{ textAlign: "center", padding: "40px", color: "#6b5f4a", fontFamily: "'Crimson Pro',serif", fontSize: 16 }}>
                      Loading chapters...
                    </div>
                  ) : (
                    <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
                      {visibleChapters.map(chapterNum => (
                        <div
                          key={chapterNum}
                          onClick={() => {
                            setSelectedChapter(chapterNum);
                            setReadingPage(1);
                            setChapterChatMessages([]);
                            setChapterChatInput("");
                            setTextMode("reading");
                            loadChapterText(selectedParvaBookName, chapterNum);
                          }}
                          style={{
                            background: 'rgba(0,0,0,0.32)',
                            border: `1px solid ${theme.cardBorder}`,
                            borderRadius: 12,
                            padding: '14px 10px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            fontFamily: "'Crimson Pro', serif",
                            fontSize: 15,
                            fontWeight: 600,
                            color: theme.textPrimary,
                            backdropFilter: 'blur(10px)',
                          }}
                        >
                          Chapter {chapterNum}
                        </div>
                      ))}
                    </div>
                    {chapterTotalPages > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16, paddingBottom: 8 }}>
                        <button
                          onClick={() => setChapterPage(p => Math.max(1, p - 1))}
                          disabled={currentChapterPage === 1}
                          style={{
                            background: 'rgba(200,140,60,0.1)',
                            border: '0.5px solid rgba(200,140,60,0.2)',
                            borderRadius: 8,
                            padding: '8px 12px',
                            color: '#b6732a',
                            cursor: currentChapterPage === 1 ? 'not-allowed' : 'pointer',
                            opacity: currentChapterPage === 1 ? 0.5 : 1,
                            fontFamily: 'Inter, sans-serif',
                          }}
                        >
                          Prev
                        </button>
                        <span style={{ fontSize: 12, color: theme.textMuted, fontFamily: 'Inter, sans-serif' }}>
                          Page {currentChapterPage} / {chapterTotalPages}
                        </span>
                        <button
                          onClick={() => setChapterPage(p => Math.min(chapterTotalPages, p + 1))}
                          disabled={currentChapterPage === chapterTotalPages}
                          style={{
                            background: 'rgba(200,140,60,0.1)',
                            border: '0.5px solid rgba(200,140,60,0.2)',
                            borderRadius: 8,
                            padding: '8px 12px',
                            color: '#b6732a',
                            cursor: currentChapterPage === chapterTotalPages ? 'not-allowed' : 'pointer',
                            opacity: currentChapterPage === chapterTotalPages ? 0.5 : 1,
                            fontFamily: 'Inter, sans-serif',
                          }}
                        >
                          Next
                        </button>
                      </div>
                    )}
                    </>
                  )}
                </div>
              )}

              {/* ── PARVA VIEW ── */}
              {textMode === "parva" && selectedParva && (
                <div>
                  <button className="back-btn" onClick={() => { setSelectedParva(null); setTextMode("browse"); }}>
                    ← Back to texts
                  </button>
                  <div className="detail-source" style={{ marginBottom: 20 }}>{selectedParva}</div>
                  {parvaLoading ? (
                    <div style={{ textAlign: "center", padding: "40px", color: "#6b5f4a", fontFamily: "'Crimson Pro',serif", fontSize: 16 }}>
                      Loading verses...
                    </div>
                  ) : (
                  <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {visibleParvaEntries.map(s => (
                      <div
                        key={s.id}
                        className="scripture-entry"
                        onClick={() => {
                          setSelectedScripture(s);
                          setGitaChatMessages([]);
                          setGitaChatInput("");
                          setTextMode("detail");
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="scripture-entry-source">
                          {s.chapter ? `Ch ${s.chapter}` : ""}
                          {s.verse_number ? ` · ${s.verse_number}` : ""}
                        </div>
                        {s.sanskrit_text && (
                          <div className="scripture-entry-verse">{s.sanskrit_text.slice(0, 120)}</div>
                        )}
                        <div className="scripture-entry-translation">
                          {(lang === 'hi' && s.hindi_translation
                            ? s.hindi_translation
                            : s.english_translation || "").slice(0, 160)}
                          {((lang === 'hi' && s.hindi_translation
                            ? s.hindi_translation
                            : s.english_translation) || "").length > 160 ? "…" : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                  {verseTotalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16, paddingBottom: 8 }}>
                      <button
                        onClick={() => setVersePage(p => Math.max(1, p - 1))}
                        disabled={currentVersePage === 1}
                        style={{
                          background: 'rgba(200,140,60,0.1)',
                          border: '0.5px solid rgba(200,140,60,0.2)',
                          borderRadius: 8,
                          padding: '8px 12px',
                          color: '#b6732a',
                          cursor: currentVersePage === 1 ? 'not-allowed' : 'pointer',
                          opacity: currentVersePage === 1 ? 0.5 : 1,
                          fontFamily: 'Inter, sans-serif',
                        }}
                      >
                        Prev
                      </button>
                      <span style={{ fontSize: 12, color: theme.textMuted, fontFamily: 'Inter, sans-serif' }}>
                        Page {currentVersePage} / {verseTotalPages}
                      </span>
                      <button
                        onClick={() => setVersePage(p => Math.min(verseTotalPages, p + 1))}
                        disabled={currentVersePage === verseTotalPages}
                        style={{
                          background: 'rgba(200,140,60,0.1)',
                          border: '0.5px solid rgba(200,140,60,0.2)',
                          borderRadius: 8,
                          padding: '8px 12px',
                          color: '#b6732a',
                          cursor: currentVersePage === verseTotalPages ? 'not-allowed' : 'pointer',
                          opacity: currentVersePage === verseTotalPages ? 0.5 : 1,
                          fontFamily: 'Inter, sans-serif',
                        }}
                      >
                        Next
                      </button>
                    </div>
                  )}
                  </>
                  )}
                  <button
                    className="ask-about-btn"
                    style={{ marginTop: 20 }}
                    onClick={() => {
                      const q = `I'm exploring the ${selectedParva} of the Mahabharata. Can you give me an overview of what happens in this section — the key events, characters, and themes?`;
                      setTab("guide");
                      sendMessage(q, "textual");
                    }}
                  >
                    {lang === 'hi' ? `${selectedParva} का अवलोकन →` : `Overview of ${selectedParva} →`}
                  </button>
                </div>
              )}

              {/* ── BROWSE VIEW ── */}
              {textMode === "browse" && (
                <div className="scripture-browser">
                  <div className="section-title">{lang === 'hi' ? 'पवित्र ग्रंथ' : 'Sacred texts'}</div>
                  <div className="filter-row">
                    {FAMILIES.map(f => (
                      <button
                        key={f.key}
                        className={`filter-btn ${familyFilter === f.key ? "active" : ""}`}
                        onClick={() => { setFamilyFilter(f.key); setTextsPage(1); }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  {dbLoading ? (
                    <div style={{ textAlign: "center", padding: "40px", color: "#6b5f4a", fontFamily: "'Crimson Pro',serif", fontSize: 16 }}>
                      Loading sacred texts...
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {groupedScriptures.map(group => (
                        <div
                          key={group.label}
                          onClick={() => {
                            setSelectedParva(group.label);
                            setSelectedParvaBookName(group.bookName || null);
                            setVersePage(1);
                            const isMahabharata = (group.bookName || "").toLowerCase().startsWith("mahabharata");
                            if (isMahabharata) {
                              // Mahabharata parvas read chapter-by-chapter from book_content, not the verse list
                              setTextMode("chapters");
                              setChapterPage(1);
                              loadChapters(group.bookName);
                            } else if (!group.isGita) {
                              // Ramayana (and any other non-Gita family) — existing verse-list behavior
                              setTextMode("parva");
                              loadParvaVerses(group.bookName);
                            } else {
                              // Gita verses already loaded — filter from dbScriptures
                              setTextMode("parva");
                              const chapterNum = parseInt(group.label.match(/\d+/)?.[0]);
                              const verses = filteredScriptures
                                .filter(s => (s.book_name || "").toLowerCase().includes("bhagavad gita")
                                          && parseInt(s.chapter) === chapterNum)
                                .sort((a, b) => (parseInt(a.verse_number) || 0) - (parseInt(b.verse_number) || 0));
                              setParvaVerses(verses);
                            }
                          }}
                          style={{
                            background: 'rgba(0,0,0,0.32)',
                            border: `1px solid ${theme.cardBorder}`,
                            borderRadius: 14,
                            padding: '16px 18px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            backdropFilter: 'blur(10px)',
                            transition: 'border-color 0.15s',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 600, color: theme.textPrimary, fontFamily: "'Crimson Pro', serif", marginBottom: 4 }}>
                              {group.label}
                            </div>
                            {group.isGita && (
                              <div style={{ fontSize: 11, color: theme.textMuted, fontFamily: 'Inter, sans-serif' }}>
                                {group.entries.length} {group.entries.length === 1 ? 'verse' : 'verses'}
                              </div>
                            )}
                          </div>
                          <div style={{ color: theme.accent, fontSize: 18, opacity: 0.7 }}>›</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

          {tab === "sadhana" && (
            <div className="screen">
              {!user && !authLoading ? (
                <div style={{ textAlign: "center", padding: "60px 24px", color: theme.textSecondary, fontFamily: "Inter, sans-serif" }}>
                  <div style={{ fontSize: 14, marginBottom: 16 }}>
                    {lang === 'hi'
                      ? 'अपनी साधना को ट्रैक करने के लिए साइन इन करें।'
                      : 'Sign in to track your daily practice.'}
                  </div>
                  <button
                    onClick={() => setTab("account")}
                    style={{
                      background: theme.accentBg, border: `0.5px solid ${theme.accentBorder}`,
                      borderRadius: 24, padding: "12px 28px", color: theme.accent,
                      fontSize: 14, cursor: "pointer", fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {lang === 'hi' ? 'साइन इन करें' : 'Sign in'}
                  </button>
                </div>
              ) : (
                <SadhanaTracker user={user} />
              )}
            </div>
          )}
        </div>
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
