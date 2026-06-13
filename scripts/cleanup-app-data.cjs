const {
  getSupabaseServiceKey,
  getSupabaseUrl,
  optionalEnv,
} = require("./env.cjs");

const args = process.argv.slice(2);
const execute = args.includes("--execute");
const emailArgIndex = args.indexOf("--keep-admin-email");
const confirmArgIndex = args.indexOf("--confirm-email");
const keepAdminEmail = (
  emailArgIndex >= 0
    ? args[emailArgIndex + 1]
    : optionalEnv("KEEP_ADMIN_EMAIL", optionalEnv("TEST_ADMIN_EMAIL", "gbieldev@hotmail.com"))
)?.trim().toLowerCase();
const confirmedEmail = (confirmArgIndex >= 0 ? args[confirmArgIndex + 1] : "")?.trim().toLowerCase();

if (!keepAdminEmail) {
  throw new Error("Informe --keep-admin-email email@admin.com.");
}

if (execute && confirmedEmail !== keepAdminEmail) {
  throw new Error(`Para executar, use --confirm-email ${keepAdminEmail}.`);
}

const SUPABASE_URL = getSupabaseUrl().replace(/\/$/, "");
const SERVICE_KEY = getSupabaseServiceKey();
const PAGE_SIZE = 1000;

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

const readJson = async (response, context, allowMissing = false) => {
  const text = await response.text();
  if (response.ok) return text ? JSON.parse(text) : null;

  if (allowMissing && (response.status === 400 || response.status === 404)) {
    return null;
  }

  throw new Error(`${context} failed with HTTP ${response.status}: ${text}`);
};

const rest = async (path, options = {}, allowMissing = true) => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      ...headers,
      Prefer: "return=representation",
      ...options.headers,
    },
  });
  return readJson(response, `REST ${path}`, allowMissing);
};

const authAdmin = async (path, options = {}) => {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/${path}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });
  return readJson(response, `Auth admin ${path}`);
};

const chunk = (values, size = 100) =>
  Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, (index + 1) * size));

const encodeIn = (ids) => ids.join(",");

const listRows = async (table, query) => {
  const result = await rest(`${table}?${query}`);
  return Array.isArray(result) ? result : [];
};

const deleteByFilter = async (summary, table, filter, estimate = null) => {
  if (!execute) {
    summary[table] = (summary[table] ?? 0) + (estimate ?? 0);
    return estimate ?? 0;
  }

  const result = await rest(`${table}?${filter}`, { method: "DELETE" });
  const count = Array.isArray(result) ? result.length : estimate ?? 0;
  summary[table] = (summary[table] ?? 0) + count;
  return count;
};

const deleteByIds = async (summary, table, ids, column = "id") => {
  if (!ids.length) return 0;
  let total = 0;
  for (const part of chunk(ids)) {
    total += await deleteByFilter(summary, table, `${column}=in.(${encodeIn(part)})`, part.length);
  }
  return total;
};

const listAuthUsers = async () => {
  const users = [];
  for (let page = 1; page < 100; page += 1) {
    const result = await authAdmin(`users?page=${page}&per_page=${PAGE_SIZE}`);
    const pageUsers = result?.users ?? [];
    users.push(...pageUsers);
    if (pageUsers.length < PAGE_SIZE) break;
  }
  return users;
};

const main = async () => {
  const [publicUsers, authUsers] = await Promise.all([
    listRows("users", "select=id,email,role,status,approval_status,blocked,deleted_at"),
    listAuthUsers(),
  ]);

  const keepPublicUser = publicUsers.find((user) => user.email?.toLowerCase() === keepAdminEmail);
  const keepAuthUser = authUsers.find((user) => user.email?.toLowerCase() === keepAdminEmail);

  if (!keepPublicUser && !keepAuthUser) {
    throw new Error(`Admin ${keepAdminEmail} nao encontrado em public.users nem auth.users.`);
  }

  const targetPublicUsers = publicUsers.filter((user) => user.email?.toLowerCase() !== keepAdminEmail);
  const targetAuthUsers = authUsers.filter((user) => user.email?.toLowerCase() !== keepAdminEmail);
  const targetUserIds = [...new Set([
    ...targetPublicUsers.map((user) => user.id),
    ...targetAuthUsers.map((user) => user.id),
  ].filter(Boolean))];

  const [targetPredictions, ownedGroups, ownedCompetitions, ownedAppInvites, acceptedAppInvites, targetLineups] = await Promise.all([
    targetUserIds.length ? listRows("predictions", `select=id,user_id&user_id=in.(${encodeIn(targetUserIds)})`) : [],
    targetUserIds.length ? listRows("groups", `select=id,owner_id&owner_id=in.(${encodeIn(targetUserIds)})`) : [],
    targetUserIds.length ? listRows("competitions", `select=id,owner_id&owner_id=in.(${encodeIn(targetUserIds)})`) : [],
    targetUserIds.length ? listRows("app_invites", `select=id,inviter_user_id&inviter_user_id=in.(${encodeIn(targetUserIds)})`) : [],
    targetUserIds.length ? listRows("app_invites", `select=id,accepted_user_id&accepted_user_id=in.(${encodeIn(targetUserIds)})`) : [],
    targetUserIds.length ? listRows("lineup_predictions", `select=id,user_id&user_id=in.(${encodeIn(targetUserIds)})`) : [],
  ]);

  const targetPredictionIds = targetPredictions.map((row) => row.id);
  const ownedGroupIds = ownedGroups.map((row) => row.id);
  const ownedCompetitionIds = ownedCompetitions.map((row) => row.id);
  const targetLineupIds = targetLineups.map((row) => row.id);
  const appInviteIds = [...new Set([...ownedAppInvites, ...acceptedAppInvites].map((row) => row.id))];

  const allGroupMemberships = targetUserIds.length
    ? await listRows("group_members", `select=id,group_id,user_id&user_id=in.(${encodeIn(targetUserIds)})`)
    : [];
  const extraGroupIds = allGroupMemberships
    .filter((row) => ownedGroupIds.includes(row.group_id))
    .map((row) => row.group_id);
  const groupIds = [...new Set([...ownedGroupIds, ...extraGroupIds])];

  const summary = {};

  await deleteByIds(summary, "prediction_audit_logs", targetPredictionIds, "prediction_id");
  await deleteByIds(summary, "lineup_points", targetLineupIds, "lineup_prediction_id");
  await deleteByIds(summary, "lineup_predictions", targetLineupIds);
  await deleteByIds(summary, "predictions", targetPredictionIds);
  await deleteByIds(summary, "notifications", targetUserIds, "user_id");
  await deleteByIds(summary, "achievements", targetUserIds, "user_id");
  await deleteByIds(summary, "rankings", targetUserIds, "user_id");
  await deleteByIds(summary, "consent_logs", targetUserIds, "user_id");
  await deleteByIds(summary, "audit_logs", targetUserIds, "actor_id");
  await deleteByIds(summary, "error_logs", targetUserIds, "user_id");
  await deleteByIds(summary, "admin_logs", targetUserIds, "admin_id");
  await deleteByIds(summary, "app_feedback", targetUserIds, "user_id");
  await deleteByIds(summary, "app_invites", appInviteIds);

  await deleteByIds(summary, "competition_groups", ownedCompetitionIds, "competition_id");
  await deleteByIds(summary, "competitions", ownedCompetitionIds);
  await deleteByIds(summary, "group_invites", groupIds, "group_id");
  await deleteByIds(summary, "group_invites", targetUserIds, "created_by");
  await deleteByIds(summary, "group_members", groupIds, "group_id");
  await deleteByIds(summary, "group_members", targetUserIds, "user_id");
  await deleteByIds(summary, "groups", groupIds);

  await deleteByIds(summary, "users", targetUserIds);

  if (execute) {
    for (const user of targetAuthUsers) {
      await authAdmin(`users/${user.id}`, { method: "DELETE" });
      summary.auth_users = (summary.auth_users ?? 0) + 1;
    }

    if (keepPublicUser) {
      await rest(`users?id=eq.${keepPublicUser.id}`, {
        body: JSON.stringify({
          approval_status: "approved",
          blocked: false,
          deleted_at: null,
          role: "admin",
          status: "approved",
        }),
        headers: { Prefer: "return=representation" },
        method: "PATCH",
      }, false);
    }
  } else {
    summary.auth_users = targetAuthUsers.length;
  }

  console.log(JSON.stringify({
    mode: execute ? "execute" : "dry-run",
    supabaseHost: new URL(SUPABASE_URL).host,
    keepAdminEmail,
    keepAdminFound: {
      auth: Boolean(keepAuthUser),
      public: Boolean(keepPublicUser),
    },
    usersToRemove: targetUserIds.length,
    publicUsersToRemove: targetPublicUsers.length,
    authUsersToRemove: targetAuthUsers.length,
    summary,
    nextStep: execute
      ? "Limpeza executada. Faca logout/login no app e teste novo cadastro."
      : `Revise o resumo. Para executar: npm run cleanup:app-data -- --execute --keep-admin-email ${keepAdminEmail} --confirm-email ${keepAdminEmail}`,
  }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
