// supabaseClient.js — single shared Supabase client instance.
//
// Import `supabase` from here everywhere in the app. Do NOT call
// createClient() anywhere else — multiple instances in the same browser
// tab share the same auth storage key and cause "Multiple GoTrueClient
// instances" warnings plus genuinely flaky/undefined behavior.

import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
