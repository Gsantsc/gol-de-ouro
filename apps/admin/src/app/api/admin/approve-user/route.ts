import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const requiredEnv = (names: string | string[]) => {
  const candidates = Array.isArray(names) ? names : [names];
  for (const name of candidates) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(`Configure ${candidates.join(" ou ")} no ambiente do Admin.`);
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

const createServiceSupabase = () =>
  createClient(
    requiredEnv(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]),
    requiredEnv(["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY"]),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

const normalizeEmail = (value?: string | null) => value?.trim().toLowerCase() ?? "";

const assertApprovedAdmin = async (accessToken: string) => {
  const supabase = createSupabaseForAdminSession(accessToken);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { ok: false as const, error: "Sessão administrativa inválida.", status: 401 };
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
    return { ok: false as const, error: "Apenas admin aprovado pode aprovar usuários.", status: 403 };
  }

  return { ok: true as const, supabase };
};

const isUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function POST(request: NextRequest) {
  try {
    const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) {
      return NextResponse.json({ error: "Sessão administrativa não enviada." }, { status: 401 });
    }

    const admin = await assertApprovedAdmin(accessToken);
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const body = await request.json().catch(() => ({})) as { userId?: unknown };
    if (!isUuid(body.userId)) {
      return NextResponse.json({ error: "Usuário inválido para aprovação." }, { status: 400 });
    }

    const serviceSupabase = createServiceSupabase();
    const { data: targetProfile, error: targetProfileError } = await serviceSupabase
      .from("users")
      .select("id,email,role,status,approval_status,blocked,deleted_at")
      .eq("id", body.userId)
      .maybeSingle();
    if (targetProfileError) throw targetProfileError;
    if (!targetProfile || targetProfile.deleted_at) {
      return NextResponse.json({ error: "Usuário não encontrado em public.users." }, { status: 404 });
    }
    if (targetProfile.role === "admin") {
      return NextResponse.json({ error: "Administradores não são aprovados por esta ação." }, { status: 403 });
    }

    const { data: authData, error: authUserError } = await serviceSupabase.auth.admin.getUserById(body.userId);
    if (authUserError || !authData.user) {
      return NextResponse.json(
        { error: "Usuário não existe em auth.users. Peça para ele criar o cadastro novamente." },
        { status: 409 },
      );
    }

    if (normalizeEmail(authData.user.email) !== normalizeEmail(targetProfile.email)) {
      return NextResponse.json(
        { error: "Email do Auth não bate com o email do profile. Não aprove antes de corrigir o cadastro." },
        { status: 409 },
      );
    }

    const alreadyConfirmed = Boolean(authData.user.email_confirmed_at ?? authData.user.confirmed_at);
    if (!alreadyConfirmed) {
      const { error: confirmError } = await serviceSupabase.auth.admin.updateUserById(body.userId, {
        email_confirm: true,
      });
      if (confirmError) throw confirmError;
    }

    const { error: approvalError } = await admin.supabase.rpc("approve_user", { target_user_id: body.userId });
    if (approvalError) throw approvalError;

    return NextResponse.json({
      email_confirmed: true,
      ok: true,
      user_id: body.userId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao aprovar usuário." },
      { status: 500 },
    );
  }
}
