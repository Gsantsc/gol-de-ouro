import type { Session } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Profile } from "../shared";
import * as authService from "../services/auth.service";
import { supabase } from "../services/supabase";

type AuthContextValue = {
  loading: boolean;
  profile: Profile | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const debugLog = (...args: unknown[]) => {
  if (__DEV__) console.debug(...args);
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfileForSession = useCallback(async (nextSession: Session | null) => {
    const userId = nextSession?.user.id;
    if (!userId) {
      setProfile(null);
      return null;
    }

    debugLog("[MOBILE AUTH] SESSION FOUND", nextSession?.user.email);
    const nextProfile = await authService.getProfile(userId);
    setProfile(nextProfile);
    debugLog("[MOBILE AUTH] ROLE FOUND", nextProfile?.role, nextProfile?.status ?? nextProfile?.approval_status);
    return nextProfile;
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfileForSession(session);
  }, [loadProfileForSession, session]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      debugLog("[MOBILE AUTH] restored session", data.session?.user?.email);
      setSession(data.session);
      if (data.session) await loadProfileForSession(data.session);
    }).catch(console.error).finally(() => {
      if (mounted) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      debugLog("[MOBILE AUTH] auth event", event, nextSession?.user?.email);
      setSession(nextSession);
      if (event === "SIGNED_OUT") {
        setProfile(null);
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        loadProfileForSession(nextSession)
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
    if (!session?.user.id) {
      setProfile(null);
      return;
    }

    refreshProfile().catch(console.error);

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
        () => refreshProfile().catch(console.error),
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
      session,
      refreshProfile,
      signIn: async (email, password) => {
        const nextSession = await authService.signIn(email, password);
        setSession(nextSession);
        const nextProfile = await loadProfileForSession(nextSession);
        debugLog("[MOBILE AUTH] REDIRECTING", nextProfile?.role, nextProfile?.status);
      },
      signOut: async () => {
        await authService.signOut();
        setSession(null);
        setProfile(null);
      },
      signUp: async (name, email, password) => {
        const { session: nextSession } = await authService.signUp(name, email, password);
        if (nextSession) {
          setSession(nextSession);
          const nextProfile = await loadProfileForSession(nextSession);
          debugLog("[MOBILE AUTH] REDIRECTING", nextProfile?.role, nextProfile?.status);
        }
      }
    }),
    [loadProfileForSession, loading, profile, refreshProfile, session],
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
