const {
  getSupabaseServiceKey,
  getSupabaseUrl,
  optionalEnv,
} = require("./env.cjs");

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const adminEmailArgIndex = args.indexOf("--admin-email");
const adminEmail = (
  adminEmailArgIndex >= 0
    ? args[adminEmailArgIndex + 1]
    : optionalEnv("KEEP_ADMIN_EMAIL", optionalEnv("TEST_ADMIN_EMAIL", "gbieldev@hotmail.com"))
)?.trim().toLowerCase();

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

const rest = async (path, options = {}, allowMissing = false) => {
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

const normalizeEmail = (value) => value?.trim().toLowerCase() ?? "";

const profileStatus = (profile) => profile.status ?? (profile.blocked ? "suspended" : profile.approval_status ?? "unknown");

const summarizePublicUser = (user) => ({
  blocked: Boolean(user.blocked),
  email: normalizeEmail(user.email),
  id: user.id,
  role: user.role ?? null,
  status: profileStatus(user),
});

const summarizeAuthUser = (user) => ({
  banned_until: user.banned_until ?? null,
  confirmed: Boolean(user.email_confirmed_at ?? user.confirmed_at),
  email: normalizeEmail(user.email),
  email_confirmed_at: user.email_confirmed_at ?? user.confirmed_at ?? null,
  id: user.id,
  last_sign_in_at: user.last_sign_in_at ?? null,
});

const listRows = async (table, query, allowMissing = false) => {
  const result = await rest(`${table}?${query}`, {}, allowMissing);
  return {
    exists: Array.isArray(result),
    rows: Array.isArray(result) ? result : [],
  };
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

const groupDuplicates = (rows, readKey) => {
  const groups = new Map();
  for (const row of rows) {
    const key = readKey(row);
    if (!key) continue;
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
  }
  return [...groups.entries()]
    .filter(([, values]) => values.length > 1)
    .map(([email, values]) => ({ email, ids: values.map((value) => value.id) }));
};

const statusSummary = (users) =>
  users.reduce((summary, user) => {
    const status = profileStatus(user);
    summary[status] = (summary[status] ?? 0) + 1;
    return summary;
  }, {});

const main = async () => {
  const [publicUsersResult, optionalProfilesResult, authUsers] = await Promise.all([
    listRows("users", "select=id,email,name,role,status,approval_status,blocked,deleted_at,created_at,updated_at"),
    listRows("profiles", "select=id,email,role,status,approval_status,blocked,deleted_at", true),
    listAuthUsers(),
  ]);

  const publicUsers = publicUsersResult.rows.filter((user) => !user.deleted_at);
  const profilesRows = optionalProfilesResult.rows.filter((profile) => !profile.deleted_at);
  const authById = new Map(authUsers.map((user) => [user.id, user]));
  const authByEmail = new Map(authUsers.map((user) => [normalizeEmail(user.email), user]).filter(([email]) => email));
  const publicById = new Map(publicUsers.map((user) => [user.id, user]));
  const publicByEmail = new Map(publicUsers.map((user) => [normalizeEmail(user.email), user]).filter(([email]) => email));

  const approvedPublicUsers = publicUsers.filter((user) => profileStatus(user) === "approved" && !user.blocked);
  const approvedWithoutAuthById = approvedPublicUsers
    .filter((user) => !authById.has(user.id))
    .map((user) => {
      const authBySameEmail = authByEmail.get(normalizeEmail(user.email));
      return {
        ...summarizePublicUser(user),
        auth_user_with_same_email: authBySameEmail ? summarizeAuthUser(authBySameEmail) : null,
      };
    });

  const authWithoutPublicUserById = authUsers
    .filter((user) => !publicById.has(user.id))
    .map((user) => {
      const publicBySameEmail = publicByEmail.get(normalizeEmail(user.email));
      return {
        ...summarizeAuthUser(user),
        public_user_with_same_email: publicBySameEmail ? summarizePublicUser(publicBySameEmail) : null,
      };
    });

  const emailMismatches = publicUsers
    .map((user) => {
      const authUser = authById.get(user.id);
      if (!authUser) return null;
      const publicEmail = normalizeEmail(user.email);
      const authEmail = normalizeEmail(authUser.email);
      return publicEmail && authEmail && publicEmail !== authEmail
        ? {
            auth_email: authEmail,
            id: user.id,
            public_email: publicEmail,
            status: profileStatus(user),
          }
        : null;
    })
    .filter(Boolean);

  const unconfirmedAuthUsers = authUsers
    .filter((user) => user.email && !user.email_confirmed_at && !user.confirmed_at)
    .map(summarizeAuthUser);

  const now = Date.now();
  const authBannedUsers = authUsers
    .filter((user) => user.banned_until && new Date(user.banned_until).getTime() > now)
    .map(summarizeAuthUser);

  const issues = {
    approved_without_auth_user_by_id: approvedWithoutAuthById,
    auth_users_without_public_user_by_id: authWithoutPublicUserById,
    auth_banned_users: authBannedUsers,
    duplicate_auth_emails: groupDuplicates(authUsers, (user) => normalizeEmail(user.email)),
    duplicate_public_user_emails: groupDuplicates(publicUsers, (user) => normalizeEmail(user.email)),
    email_mismatches_by_id: emailMismatches,
    unconfirmed_auth_users: unconfirmedAuthUsers,
  };

  const blockingIssueCount = Object.values(issues).reduce((total, values) => total + values.length, 0);
  const report = {
    ok: blockingIssueCount === 0,
    checked_at: new Date().toISOString(),
    supabase_host: new URL(SUPABASE_URL).host,
    admin_email: adminEmail,
    tables: {
      auth_users: authUsers.length,
      profiles_table: optionalProfilesResult.exists ? profilesRows.length : "not found",
      public_users: publicUsers.length,
    },
    public_user_status_summary: statusSummary(publicUsers),
    profiles_table_note: optionalProfilesResult.exists
      ? "Tabela profiles existe e foi lida; o app usa public.users como profile principal."
      : "Tabela profiles nao existe neste schema; o app usa public.users como profile principal.",
    rate_limit_note: "O Supabase Auth Admin API nao expoe bloqueios temporarios de rate limit por usuario. Procure Too many requests nos logs de Auth se precisar auditar isso.",
    issues,
  };

  console.log("[AUTH DIAGNOSTIC] Relatorio de consistencia Auth x public.users");
  console.log(JSON.stringify(report, null, 2));

  if (strict && !report.ok) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error("[AUTH DIAGNOSTIC] Falhou:", error.message);
  process.exit(1);
});
