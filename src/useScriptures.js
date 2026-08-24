// useScriptures.js — Drop into src/
// Replaces findRelevantScriptures() with real Supabase vector search
// Import this in App.jsx instead of calling findRelevantScriptures directly

import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { OpenAI } from "openai";

// ── Clients ────────────────────────────────────────────────────────────────
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://placeholder-dharma.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "placeholder-anon-key";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || "placeholder-key",
  dangerouslyAllowBrowser: true, // safe for read-only embedding calls
});

// ── Embed a query string ──────────────────────────────────────────────────
async function embedQuery(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

// ── Main search function ──────────────────────────────────────────────────
/**
 * Find the most relevant scripture passages for a user's question.
 * Replaces the old findRelevantScriptures() that searched locally.
 *
 * @param {string} query     - User's question or mood
 * @param {string} mood      - Current mood (optional, appended to query)
 * @param {number} maxResults - How many passages to return (default 5)
 * @returns {Promise<Array>} - Array of scripture objects
 */
export async function searchScriptures(query, mood = "", maxResults = 5) {
  // Combine query + mood for richer embedding
  const searchText = mood ? `${query} feeling ${mood}` : query;

  try {
    // Step 1: Embed the user's question
    const queryEmbedding = await embedQuery(searchText);

    // Step 2: Search Supabase with vector similarity
    const { data, error } = await supabase.rpc("match_scriptures", {
      query_embedding: queryEmbedding,
      match_threshold: 0.4,  // Lower = more results but less relevant
      match_count:     maxResults,
    });

    if (error) {
      console.error("Supabase search error:", error);
      return [];
    }

    return data || [];

  } catch (err) {
    console.error("Scripture search failed:", err);
    return [];
  }
}

// ── Build Grok context from retrieved passages ────────────────────────────
/**
 * Formats retrieved scripture passages for injection into Grok's system prompt.
 * Same interface as the old buildScriptureContext() function.
 */
export function buildScriptureContext(passages) {
  if (!passages || passages.length === 0) return "";

  const entries = passages.map(p => {
    const source = `${p.book_name}${p.chapter ? ` ${p.chapter}` : ""}${p.verse_number ? `.${p.verse_number}` : ""}`;
    return `[${source}]
Sanskrit/Transliteration: ${p.transliteration || p.sanskrit_text || ""}
Translation: ${p.english_translation}`;
  }).join("\n\n---\n\n");

  return `\n\nRELEVANT SCRIPTURE PASSAGES (retrieved by semantic search):\n\n${entries}\n\nBase your answer on these passages. Always cite the source in your response.`;
}

// ── React hook for components ─────────────────────────────────────────────
/**
 * React hook for scripture search with loading state.
 * Usage in a component:
 *   const { results, loading, search } = useScriptureSearch();
 *   await search("I feel anxious about the future", "anxiety");
 */
export function useScriptureSearch() {
  const [results, setResults] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const search = async (query, mood = "") => {
    setLoading(true);
    setError(null);
    try {
      const passages = await searchScriptures(query, mood);
      setResults(passages);
      return passages;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  return { results, loading, error, search };
}
