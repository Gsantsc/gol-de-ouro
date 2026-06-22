import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceSupabaseClient, runLiveResultsSync } from "@/server/sync-results";

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
    return false;
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role,approval_status,status,blocked,deleted_at")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError) throw profileError;

  const profileStatus = profile?.status ?? (profile?.blocked ? "suspended" : profile?.approval_status);
  return Boolean(
    profile
    && profile.role === "admin"
    && profileStatus === "approved"
    && !profile.blocked
    && !profile.deleted_at,
  );
};

// PROTECTED SYNC RESULTS ENDPOINT
export async function POST(request: NextRequest) {
  try {
    const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) {
      return NextResponse.json({ error: "Token de autorizacao nao enviado." }, { status: 401 });
    }

    const cronSecret = process.env.CRON_SECRET;
    let triggeredBy = "admin";

    if (cronSecret && accessToken === cronSecret) {
      triggeredBy = "cron";
    } else if (!await assertApprovedAdmin(accessToken)) {
      return NextResponse.json({ error: "Token invalido ou admin nao aprovado." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({})) as {
      dryRun?: boolean;
      force?: boolean;
      provider?: "espn" | "none";
    };
    const startedAt = new Date().toISOString();
    const supabase = createServiceSupabaseClient();
    const summary = await runLiveResultsSync({
      dryRun: body.dryRun === true,
      force: body.force === true || triggeredBy === "admin",
      provider: body.provider,
      supabase,
      triggeredBy,
    });
    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - new Date(startedAt).getTime();

    const response = {
      success: summary.status === "success" || summary.status === "partial_success",
      action: "sync-results",
      provider: body.provider || "espn",
      status: summary.status,
      startedAt,
      finishedAt,
      durationMs,
      summary: {
        checkedMatches: summary.checkedMatches,
        insertedMatches: 0,
        updatedMatches: summary.updatedMatches,
        skippedMatches: summary.checkedMatches - summary.updatedMatches,
        liveMatches: summary.liveMatches || 0,
        finishedMatches: summary.finishedMatches,
        scoredPredictions: summary.scoredPredictions,
        rankingUpdated: summary.rankingUpdated || 0,
        errorsCount: summary.errors.length
      },
      changedMatches: [],
      errors: summary.errors.map((error) => ({
        message: error
      }))
    };

    return NextResponse.json(response, { status: response.success ? 200 : 500 });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false,
        action: "sync-results",
        error: error instanceof Error ? error.message : "Erro ao atualizar resultados.",
      },
      { status: 500 },
    );
  }
}
