import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const disableBrowserSessionLocks = process.env.NEXT_PUBLIC_SUPABASE_BROWSER_LOCKS === "false";
const missingSupabaseConfigMessage = "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const localSessionLock = async <Result,>(
  _name: string,
  _acquireTimeout: number,
  operation: () => Promise<Result>,
) => operation();

const createMissingSupabaseClient = () =>
  new Proxy({}, {
    get() {
      throw new Error(missingSupabaseConfigMessage);
    },
  }) as SupabaseClient;

const createBrowserSupabaseClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) return createMissingSupabaseClient();

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      ...(disableBrowserSessionLocks ? { lock: localSessionLock } : {})
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  });
};

export const supabase = createBrowserSupabaseClient();
