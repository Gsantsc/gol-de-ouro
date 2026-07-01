import type { Session } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Profile } from "../shared";
import * as authService from "../services/auth.service";
import { supabase } from "../services/supabase";

type AuthContextValue = {
  loading: boolean;
  profile: Profile | null;
  session: Session | null;
  requestPasswordReset: (email: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshingProfile: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const debugLog = (...args: unknown[]) => {
  if (__DEV__) console.debug(...args);
};
const authDebugCounts = {
  authStateChanges: 0,
  fetchProfile: 0,
  getSession: 0,
  signIn: 0,
  signUp: 0
};

const countDebug = (key: keyof typeof authDebugCounts, ...args: unknown[]) => {
  authDebugCounts[key] += 1;
  debugLog(`[MOBILE AUTH] ${key} #${authDebugCounts[key]}`, ...args);
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingProfile, setRefreshingProfile] = useState(false);
  const profileRequestRef = useRef<Promise<Profile | null> | null>(null);
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const loadProfileForSession = useCallback(async (nextSession: Session | null, reason = "unknown") => {
    const userId = nextSession?.user.id;
    if (!userId) {
      setProfile(null);
      return null;
    }

    if (profileRequestRef.current) return profileRequestRef.current;

    debugLog("[MOBILE AUTH] SESSION FOUND", nextSession?.user.email);
    countDebug("fetchProfile", reason, nextSession?.user.email);
    const request = authService
      .getProfile(userId)
      .then((nextProfile) => {
        setProfile(nextProfile);
        debugLog("[MOBILE AUTH] ROLE FOUND", nextProfile?.role, nextProfile?.status ?? nextProfile?.approval_status);
        return nextProfile;
      })
      .finally(() => {
        profileRequestRef.current = null;
      });

    profileRequestRef.current = request;
    return request;
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      setRefreshingProfile(true);
      await loadProfileForSession(sessionRef.current, "manual-check");
    } finally {
      setRefreshingProfile(false);
    }
  }, [loadProfileForSession]);

  useEffect(() => {
    let mounted = true;

    countDebug("getSession", "boot");
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      debugLog("[MOBILE AUTH] restored session", data.session?.user?.email);
      setSession(data.session);
      if (data.session) await loadProfileForSession(data.session, "boot");
    }).catch(console.error).finally(() => {
      if (mounted) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      countDebug("authStateChanges", event, nextSession?.user?.email);
      debugLog("[MOBILE AUTH] auth event", event, nextSession?.user?.email);
      setSession(nextSession);
      if (event === "SIGNED_OUT") {
        setProfile(null);
        return;
      }

      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        loadProfileForSession(nextSession, event)
          .then((nextProfile) => {
            debugLog("[MOBILE AUTH] REDIRECTING", nextProfile?.role, nextProfile?.status);
          })
          .catch(console.error);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfileForSession]);

  useEffect(() => {
    if (!session?.user.id) return;

    const status = profile?.status ?? (profile?.blocked ? "suspended" : profile?.approval_status);
    if (status !== "approved" || profile?.blocked) return;

    const channelName = `profile-${session.user.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "users",
          filter: `id=eq.${session.user.id}`
        },
        () => {
          const currentSession = sessionRef.current;
          if (currentSession) loadProfileForSession(currentSession, "approved-profile-change").catch(console.error);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      profile,
      refreshingProfile,
      session,
      refreshProfile,
      requestPasswordReset: authService.requestPasswordReset,
      signIn: async (email, password) => {
        countDebug("signIn", email.trim().toLowerCase());
        const nextSession = await authService.signIn(email, password);
        setSession(nextSession);
        const nextProfile = await loadProfileForSession(nextSession, "sign-in");
        debugLog("[MOBILE AUTH] REDIRECTING", nextProfile?.role, nextProfile?.status);
      },
      signOut: async () => {
        await authService.signOut();
        setSession(null);
        setProfile(null);
      },
      signUp: async (name, email, password) => {
        countDebug("signUp", email.trim().toLowerCase());
        const { session: nextSession } = await authService.signUp(name, email, password);
        if (nextSession) {
          setSession(nextSession);
          const nextProfile = await loadProfileForSession(nextSession, "sign-up");
          debugLog("[MOBILE AUTH] REDIRECTING", nextProfile?.role, nextProfile?.status);
        }
      }
    }),
    [loadProfileForSession, loading, profile, refreshProfile, refreshingProfile, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  }
  return context;
};
