// supabaseClient.js — single shared Supabase client instance.
//
// Import `supabase` from here everywhere in the app. Do NOT call
// createClient() anywhere else — multiple instances in the same browser
// tab share the same auth storage key and cause "Multiple GoTrueClient
// instances" warnings plus genuinely flaky/undefined behavior.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://placeholder-dharma.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

