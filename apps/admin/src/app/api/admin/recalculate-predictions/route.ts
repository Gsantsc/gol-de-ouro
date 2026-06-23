import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceSupabaseClient } from "@/server/sync-results";
import { runRecalculatePredictions } from "@/server/recalculate-predictions";

const requiredEnv = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Variavel ${name} nao configurada.`);
  return value;
};

const createSupabaseForAdminSession = (accessToken: string) =>
  createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

const assertApprovedAdmin = async (accessToken: string) => {
  const supabase = createSupabaseForAdminSession(accessToken);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role,approval_status,status,blocked,deleted_at")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError) throw profileError;

  const profileStatus = profile?.status ?? (profile?.blocked ? "suspended" : profile?.approval_status);
  const approved = Boolean(
    profile
    && profile.role === "admin"
    && profileStatus === "approved"
    && !profile.blocked
    && !profile.deleted_at,
  );

  return approved ? authData.user.id : null;
};

export async function POST(request: NextRequest) {
  try {
    const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) {
      return NextResponse.json({ error: "Token de autorizacao nao enviado." }, { status: 401 });
    }

    const adminId = await assertApprovedAdmin(accessToken);
    if (!adminId) {
      return NextResponse.json({ error: "Token invalido ou admin nao aprovado." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({})) as {
      championship?: string;
      dryRun?: boolean;
    };

    const startedAt = new Date().toISOString();
    const supabase = createServiceSupabaseClient();
    const result = await runRecalculatePredictions({
      adminId,
      championship: body.championship ?? "world_cup_2026",
      dryRun: body.dryRun === true,
      supabase,
    });
    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - new Date(startedAt).getTime();

    if (result.status === "failed") {
      return NextResponse.json({ 
        success: false,
        action: "recalculate-predictions",
        error: result.message,
        startedAt,
        finishedAt,
        durationMs,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action: "recalculate-predictions",
      provider: "local",
      status: "success",
      startedAt,
      finishedAt,
      durationMs,
      summary: {
        checkedMatches: result.totalMatches,
        insertedMatches: 0,
        updatedMatches: result.predictionsUpdated,
        skippedMatches: result.skippedMatches,
        liveMatches: 0,
        finishedMatches: result.finishedMatches,
        scoredPredictions: result.predictionsUpdated,
        rankingUpdated: result.rankingsUpdated,
      },
      changedMatches: [],
      errors: [],
      message: result.message,
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false,
        action: "recalculate-predictions",
        error: error instanceof Error ? error.message : "Erro ao recalcular pontuacao.",
      },
      { status: 500 },
    );
  }
}
