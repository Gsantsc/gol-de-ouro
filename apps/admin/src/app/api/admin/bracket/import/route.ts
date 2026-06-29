// EMERGENCY BRACKET IMPORT
// This endpoint is for emergency manual bracket import only.
// The primary flow should be: ESPN Sync → Supabase matches → App Mobile
// Use sync-matches API to automatically populate knockout matches from ESPN.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceSupabaseClient } from "@/server/sync-results";
import { importKnockoutBracket, type BracketImportInput } from "@/server/knockout-resolver";

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
  if (authError || !authData.user) return false;

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

export async function POST(request: NextRequest) {
  try {
    const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) {
      return NextResponse.json({ error: "Token de autorizacao nao enviado." }, { status: 401 });
    }

    if (!await assertApprovedAdmin(accessToken)) {
      return NextResponse.json({ error: "Token invalido ou admin nao aprovado." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({})) as BracketImportInput;
    const result = await importKnockoutBracket(createServiceSupabaseClient(), {
      championship: body.championship,
      dryRun: body.dryRun !== false,
      matches: body.matches,
      source: body.source,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erro ao importar chave de mata-mata.",
        ok: false,
      },
      { status: 500 },
    );
  }
}
