import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { updateMatchStatuses } from "@/lib/match-status-service";

const requiredEnv = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Variável ${name} não configurada.`);
  return value;
};

const createSupabaseForRequest = (accessToken: string) =>
  createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });

export async function POST(request: NextRequest) {
  try {
    const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) {
      return NextResponse.json({ error: "Sessão administrativa não enviada." }, { status: 401 });
    }

    const supabase = createSupabaseForRequest(accessToken);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role,approval_status,status,blocked,deleted_at")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    const profileStatus = profile?.status ?? (profile?.blocked ? "suspended" : profile?.approval_status);
    if (
      !profile ||
      profile.role !== "admin" ||
      profileStatus !== "approved" ||
      profile.blocked ||
      profile.deleted_at
    ) {
      return NextResponse.json({ error: "Apenas admin aprovado pode atualizar status das partidas." }, { status: 403 });
    }

    // LOCAL MATCH STATUS JOB
    return NextResponse.json(await updateMatchStatuses(supabase));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar status das partidas." },
      { status: 500 },
    );
  }
}
