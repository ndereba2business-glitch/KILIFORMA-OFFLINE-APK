import { createClient } from "@supabase/supabase-js";
import { offlineFetch } from "./offline/net.js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  // Every read and write goes through the offline layer: reads fall back to the
  // last good answer when the phone has no throughput, writes are left alone so
  // screens can keep reporting failures honestly (src/lib/offline/net.js).
  global: { fetch: offlineFetch },
});
