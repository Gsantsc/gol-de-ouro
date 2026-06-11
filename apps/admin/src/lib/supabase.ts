import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const useBrowserSessionLocks = process.env.NEXT_PUBLIC_SUPABASE_BROWSER_LOCKS === "true";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.");
}

const localSessionLock = async <Result,>(
  _name: string,
  _acquireTimeout: number,
  operation: () => Promise<Result>,
) => operation();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: false,
    persistSession: true,
    ...(useBrowserSessionLocks ? {} : { lock: localSessionLock })
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});
