import type { Profile } from "../shared";
import type { Session, User } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";

const debugLog = (...args: unknown[]) => {
  if (__DEV__) console.debug(...args);
};
let signInWithPasswordCalls = 0;

const normalizeProfile = (profile: Profile | null): Profile | null => {
  if (!profile) return null;
  return {
    ...profile,
    approval_status: profile.approval_status,
    role: profile.role === "user" ? "player" : profile.role,
    status: profile.status ?? (profile.blocked ? "suspended" : profile.approval_status),
  };
};

const readDeviceLabel = () => {
  const deviceName = (Constants as typeof Constants & { deviceName?: string }).deviceName;
  return [Platform.OS, deviceName].filter(Boolean).join(" / ");
};

const recordLogin = async () => {
  const { error } = await supabase.rpc("record_user_login");
  if (error) debugLog("[MOBILE AUTH] record login skipped", error.message);
};

const ensureProfile = async (name?: string) => {
  const { data, error } = await supabase.rpc("ensure_user_profile", {
    display_name: name?.trim() || null,
    signup_device_value: readDeviceLabel() || null,
    signup_ip_value: null
  });

  if (error) throw error;
  return normalizeProfile(data as Profile | null);
};

export const signIn = async (email: string, password: string): Promise<Session> => {
  const normalizedEmail = email.trim().toLowerCase();
  debugLog("[MOBILE AUTH] LOGIN_ATTEMPT", normalizedEmail);
  signInWithPasswordCalls += 1;
  debugLog("[MOBILE AUTH] signInWithPassword call", signInWithPasswordCalls, normalizedEmail);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password
  });

  if (error) {
    debugLog("[MOBILE AUTH] LOGIN_FAILED", normalizedEmail, error.message);
    throw error;
  }

  if (!data.session) {
    debugLog("[MOBILE AUTH] LOGIN_FAILED", normalizedEmail, "missing-session");
    throw new Error("Não foi possível autenticar.");
  }

  debugLog("[MOBILE AUTH] LOGIN_SUCCESS", data.session.user.id);
  debugLog("[MOBILE AUTH] SESSION FOUND", data.session.user.email);
  const profile = await ensureProfile();
  debugLog("[MOBILE AUTH] PROFILE_LOADED", profile?.id, profile?.status ?? profile?.approval_status);
  await recordLogin();
  return data.session;
};

export const signUp = async (name: string, email: string, password: string): Promise<{ user: User | null; session: Session | null }> => {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();
  debugLog("[MOBILE AUTH] SIGNUP START", normalizedEmail);

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: { name: trimmedName }
    }
  });

  if (error) {
    debugLog("[MOBILE AUTH] SIGNUP ERROR", error.message);
    throw error;
  }

  debugLog("[MOBILE AUTH] SIGNUP SUCCESS", data?.user?.id);
  if (data.session) {
    debugLog("[MOBILE AUTH] SESSION FOUND", data.session.user.email);
    await ensureProfile(trimmedName);
  }
  return data;
};

export const signOut = () => supabase.auth.signOut({ scope: "global" });

export const getProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  if (data) {
    const profile = normalizeProfile(data as Profile | null);
    debugLog("[MOBILE AUTH] ROLE FOUND", profile?.role, profile?.status);
    debugLog("[MOBILE AUTH] PROFILE_LOADED", profile?.id, profile?.status ?? profile?.approval_status);
    return profile;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData?.user) return null;

  const profile = await ensureProfile(userData.user.user_metadata?.name);
  debugLog("[MOBILE AUTH] ROLE FOUND", profile?.role, profile?.status);
  debugLog("[MOBILE AUTH] PROFILE_LOADED", profile?.id, profile?.status ?? profile?.approval_status);
  return profile;
};
