const {
  getSupabaseServiceKey,
  getSupabaseUrl,
} = require("./env.cjs");

const args = process.argv.slice(2);
const execute = args.includes("--execute");
const confirmed = args.includes("--confirm-approved-auth-users");

if (execute && !confirmed) {
  throw new Error("Para executar, use --execute --confirm-approved-auth-users.");
}

const SUPABASE_URL = getSupabaseUrl().replace(/\/$/, "");
const SERVICE_KEY = getSupabaseServiceKey();
const PAGE_SIZE = 1000;

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

const readJson = async (response, context) => {
  const text = await response.text();
  if (response.ok) return text ? JSON.parse(text) : null;
  throw new Error(`${context} failed with HTTP ${response.status}: ${text}`);
};

const rest = async (path, options = {}) => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      ...headers,
      Prefer: "return=representation",
      ...options.headers,
    },
  });
  return readJson(response, `REST ${path}`);
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

const confirmAuthUser = (userId) =>
  authAdmin(`users/${userId}`, {
    body: JSON.stringify({ email_confirm: true }),
    method: "PUT",
  });

const main = async () => {
  const [publicUsers, authUsers] = await Promise.all([
    rest("users?select=id,email,role,status,approval_status,blocked,deleted_at"),
    listAuthUsers(),
  ]);
  const authById = new Map(authUsers.map((user) => [user.id, user]));
  const targets = publicUsers
    .filter((user) => !user.deleted_at && user.role !== "admin" && profileStatus(user) === "approved" && !user.blocked)
    .map((publicUser) => ({ authUser: authById.get(publicUser.id), publicUser }))
    .filter(({ authUser, publicUser }) =>
      authUser &&
      normalizeEmail(authUser.email) === normalizeEmail(publicUser.email) &&
      !authUser.email_confirmed_at &&
      !authUser.confirmed_at
    )
    .map(({ authUser, publicUser }) => ({
      email: normalizeEmail(publicUser.email),
      id: publicUser.id,
      status: profileStatus(publicUser),
      will_confirm: true,
      last_sign_in_at: authUser.last_sign_in_at ?? null,
    }));

  const summary = {
    dry_run: !execute,
    supabase_host: new URL(SUPABASE_URL).host,
    targets,
    target_count: targets.length,
  };

  if (execute) {
    for (const target of targets) {
      await confirmAuthUser(target.id);
    }
    summary.confirmed_count = targets.length;
  }

  console.log("[AUTH REPAIR] Confirmacao de email para usuarios approved");
  console.log(JSON.stringify(summary, null, 2));
};

main().catch((error) => {
  console.error("[AUTH REPAIR] Falhou:", error.message);
  process.exit(1);
});
