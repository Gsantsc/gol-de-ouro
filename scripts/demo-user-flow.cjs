const {
  getSupabaseServiceKey,
  getSupabaseUrl,
  optionalEnv,
} = require("./env.cjs");

const args = process.argv.slice(2);
const mode = args[0] === "cleanup" ? "cleanup" : "seed";
const dryRun = args.includes("--dry-run");

const PREFIX = optionalEnv("DEMO_USER_FLOW_PREFIX", "DEMO_USER_FLOW");
const PROVIDER = optionalEnv("DEMO_USER_FLOW_PROVIDER", "demo_user_flow");
const EMAIL_PREFIX = optionalEnv("DEMO_USER_FLOW_EMAIL_PREFIX", "demo-user-flow");
const EMAIL_DOMAIN = optionalEnv("DEMO_USER_FLOW_EMAIL_DOMAIN", "demo.local");
const PASSWORD = optionalEnv("DEMO_USER_FLOW_PASSWORD", "DemoUserFlow#2026");
const PARTICIPANT_COUNT = Number(optionalEnv("DEMO_USER_FLOW_PARTICIPANTS", "12"));
const TOURNAMENT_SLUG = optionalEnv("DEMO_USER_FLOW_TOURNAMENT_SLUG", "world_cup_2026");

const now = Date.now();
const hour = 60 * 60 * 1000;

const serviceHeaders = (serviceKey) => ({
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
});

const readJson = async (response) => {
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
};

const encodeFilter = (value) => encodeURIComponent(value);

const createClient = () => {
  const url = getSupabaseUrl();
  const serviceKey = getSupabaseServiceKey();

  const rest = async (path, options = {}) => {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      ...options,
      headers: {
        ...serviceHeaders(serviceKey),
        Prefer: "return=representation",
        ...options.headers,
      },
    });

    return readJson(response);
  };

  const authAdmin = async (path, options = {}) => {
    const response = await fetch(`${url}/auth/v1/admin${path}`, {
      ...options,
      headers: {
        ...serviceHeaders(serviceKey),
        ...options.headers,
      },
    });

    return readJson(response);
  };

  return { authAdmin, rest };
};

const demoEmail = (index) => `${EMAIL_PREFIX}-${String(index).padStart(2, "0")}@${EMAIL_DOMAIN}`;

const printPlan = () => {
  const participantCount = Number.isFinite(PARTICIPANT_COUNT) ? PARTICIPANT_COUNT : 12;
  console.log(JSON.stringify({
    dryRun: true,
    mode,
    prefix: PREFIX,
    provider: PROVIDER,
    tournamentSlug: TOURNAMENT_SLUG,
    participantCount,
    createsWhenSeeded: [
      "approved auth/public demo users",
      "one active demo league",
      "league members",
      "rankings",
      "open/live/finished demo matches",
      "user notifications",
    ],
    intentionallySkipped: [
      "predictions, because current DB trigger forbids deleting locked predictions during cleanup",
    ],
    cleanupTargets: [
      "notifications with demo titles/metadata",
      "group invites and members for demo groups",
      "demo groups",
      "demo rankings",
      "demo matches by provider",
      "demo auth/public users by email prefix",
    ],
  }, null, 2));
};

const listDemoUsers = async (rest) =>
  rest(`users?select=id,email,name&email=ilike.${encodeFilter(`${EMAIL_PREFIX}-%`)}`);

const deleteByIds = async (rest, table, ids) => {
  if (!ids.length) return 0;
  await rest(`${table}?id=in.(${ids.join(",")})`, { method: "DELETE" });
  return ids.length;
};

const deleteByColumnIds = async (rest, table, column, ids) => {
  if (!ids.length) return 0;
  await rest(`${table}?${column}=in.(${ids.join(",")})`, { method: "DELETE" });
  return ids.length;
};

const cleanup = async () => {
  if (dryRun) {
    printPlan();
    return;
  }

  const { authAdmin, rest } = createClient();
  const [users, groups, matches, notifications] = await Promise.all([
    listDemoUsers(rest),
    rest("groups?select=id,name,invite_code"),
    rest(`matches?select=id,provider_name&provider_name=eq.${encodeFilter(PROVIDER)}`),
    rest("notifications?select=id,title,metadata"),
  ]);

  const userIds = (users ?? []).map((user) => user.id);
  const groupIds = (groups ?? [])
    .filter((group) => group.name?.startsWith(PREFIX) || group.invite_code?.startsWith("DEMO-USER-FLOW"))
    .map((group) => group.id);
  const matchIds = (matches ?? []).map((match) => match.id);
  const notificationIds = (notifications ?? [])
    .filter((notification) => notification.title?.startsWith(PREFIX) || notification.metadata?.demo === PREFIX)
    .map((notification) => notification.id);

  const summary = {
    achievements: 0,
    groupInvites: 0,
    groupMembers: 0,
    groups: 0,
    matches: 0,
    notifications: 0,
    rankings: 0,
    users: 0,
  };

  if (groupIds.length) {
    await rest(`group_invites?group_id=in.(${groupIds.join(",")})`, { method: "DELETE" });
    summary.groupInvites = groupIds.length;
    await rest(`group_members?group_id=in.(${groupIds.join(",")})`, { method: "DELETE" });
    summary.groupMembers = groupIds.length;
  }

  summary.notifications = await deleteByIds(rest, "notifications", notificationIds);
  summary.groups = await deleteByIds(rest, "groups", groupIds);
  summary.achievements = await deleteByColumnIds(rest, "achievements", "user_id", userIds);
  summary.rankings = await deleteByColumnIds(rest, "rankings", "user_id", userIds);
  summary.matches = await deleteByIds(rest, "matches", matchIds);

  for (const user of users ?? []) {
    await authAdmin(`/users/${user.id}`, { method: "DELETE" }).catch(async () => {
      await rest(`users?id=eq.${user.id}`, { method: "DELETE" });
    });
    summary.users += 1;
  }

  console.log(JSON.stringify({ mode: "cleanup", prefix: PREFIX, summary }, null, 2));
};

const upsertRows = async (rest, table, conflict, rows) =>
  rest(`${table}?on_conflict=${conflict}`, {
    body: JSON.stringify(rows),
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    method: "POST",
  });

const ensureTournament = async (rest) => {
  const tournaments = await rest("tournaments?select=id,name,type,slug,active,deleted_at");
  const existing = (tournaments ?? []).find(
    (tournament) =>
      !tournament.deleted_at &&
      (tournament.slug === TOURNAMENT_SLUG || tournament.slug === "world_cup" || tournament.type === "world_cup"),
  );

  if (existing) return existing;

  const inserted = await rest("tournaments", {
    body: JSON.stringify({
      active: true,
      name: "Copa do Mundo 2026",
      slug: TOURNAMENT_SLUG,
      type: "world_cup",
    }),
    method: "POST",
  });

  return inserted[0];
};

const ensureAuthUser = async ({ authAdmin, rest }, index, role = "user") => {
  const email = demoEmail(index);
  const name = index === 1 ? `${PREFIX} Gabriel Demo` : `${PREFIX} Participante ${index}`;
  const existingPublic = await rest(`users?select=id,email&email=eq.${encodeFilter(email)}`);

  let userId = existingPublic?.[0]?.id;

  if (!userId) {
    const created = await authAdmin("/users", {
      body: JSON.stringify({
        email,
        email_confirm: true,
        password: PASSWORD,
        user_metadata: { name, role },
      }),
      method: "POST",
    });
    userId = created.id;
  } else {
    await authAdmin(`/users/${userId}`, {
      body: JSON.stringify({
        email_confirm: true,
        password: PASSWORD,
        user_metadata: { name, role },
      }),
      method: "PUT",
    }).catch(() => null);
  }

  await upsertRows(rest, "users", "id", [{
    approval_status: "approved",
    blocked: false,
    deleted_at: null,
    email,
    id: userId,
    name,
    role,
    status: "approved",
  }]);

  return { email, id: userId, name };
};

const seed = async () => {
  if (dryRun) {
    printPlan();
    return;
  }

  await cleanup();

  const client = createClient();
  const tournament = await ensureTournament(client.rest);
  const participantTotal = Math.max(3, Number.isFinite(PARTICIPANT_COUNT) ? PARTICIPANT_COUNT : 12);
  const users = [];

  for (let index = 1; index <= participantTotal; index += 1) {
    users.push(await ensureAuthUser(client, index));
  }

  const matchesPayload = [
    {
      away_score: 0,
      away_team: optionalEnv("DEMO_USER_FLOW_NEXT_AWAY", "South Africa"),
      championship: TOURNAMENT_SLUG,
      home_score: 0,
      home_team: optionalEnv("DEMO_USER_FLOW_NEXT_HOME", "Mexico"),
      prediction_close_at: new Date(now + hour).toISOString(),
      prediction_open_at: new Date(now - hour).toISOString(),
      provider_external_id: `${PREFIX}-next`,
      provider_name: PROVIDER,
      round: "Demo",
      start_time: new Date(now + 2 * hour).toISOString(),
      status: "aberto",
      tournament_id: tournament.id,
    },
    {
      away_score: 1,
      away_team: optionalEnv("DEMO_USER_FLOW_FINISHED_AWAY", "Argentina"),
      championship: TOURNAMENT_SLUG,
      home_score: 2,
      home_team: optionalEnv("DEMO_USER_FLOW_FINISHED_HOME", "Brazil"),
      prediction_close_at: new Date(now - 26 * hour).toISOString(),
      prediction_open_at: new Date(now - 49 * hour).toISOString(),
      provider_external_id: `${PREFIX}-finished`,
      provider_name: PROVIDER,
      round: "Demo",
      start_time: new Date(now - 25 * hour).toISOString(),
      status: "encerrado",
      tournament_id: tournament.id,
    },
    {
      away_score: 0,
      away_team: optionalEnv("DEMO_USER_FLOW_LIVE_AWAY", "Portugal"),
      championship: TOURNAMENT_SLUG,
      home_score: 0,
      home_team: optionalEnv("DEMO_USER_FLOW_LIVE_HOME", "France"),
      prediction_close_at: new Date(now - hour).toISOString(),
      prediction_open_at: new Date(now - 25 * hour).toISOString(),
      provider_external_id: `${PREFIX}-live`,
      provider_name: PROVIDER,
      round: "Demo",
      start_time: new Date(now - 15 * 60 * 1000).toISOString(),
      status: "ao_vivo",
      tournament_id: tournament.id,
    },
  ];

  const matches = await client.rest("matches", {
    body: JSON.stringify(matchesPayload),
    method: "POST",
  });
  const inviteCode = "DEMO-USER-FLOW";
  const groups = await upsertRows(client.rest, "groups", "invite_code", [{
    championship_id: tournament.id,
    closed_at: null,
    deleted_at: null,
    invite_code: inviteCode,
    name: `${PREFIX} Liga Familia`,
    owner_id: users[0].id,
  }]);
  const group = groups[0];
  const existingMembers = await client.rest(`group_members?select=user_id&group_id=eq.${group.id}`);
  const existingMemberIds = new Set((existingMembers ?? []).map((member) => member.user_id));
  const memberRows = users
    .filter((user) => !existingMemberIds.has(user.id))
    .map((user, index) => ({
      group_id: group.id,
      role: index === 0 ? "owner" : "member",
      user_id: user.id,
    }));

  if (memberRows.length) {
    await client.rest("group_members", {
      body: JSON.stringify(memberRows),
      method: "POST",
    });
  }

  await upsertRows(client.rest, "rankings", "user_id", users.map((user, index) => ({
    correct_results: index === 0 ? 0 : Math.max(0, 19 - index),
    exact_scores: index === 0 ? 0 : Math.max(0, 9 - Math.floor(index / 2)),
    total_points: index === 0 ? 0 : Math.max(5, 101 - index * 5),
    user_id: user.id,
  })));

  await client.rest("notifications", {
    body: JSON.stringify([
      {
        body: "O proximo palpite demo encerra em menos de uma hora.",
        metadata: { demo: PREFIX },
        title: `${PREFIX}: palpite encerrando`,
        user_id: users[0].id,
      },
      {
        body: "Sua liga demo esta pronta para validar ranking e participantes.",
        metadata: { demo: PREFIX },
        title: `${PREFIX}: liga criada`,
        user_id: users[0].id,
      },
    ]),
    method: "POST",
  });

  console.log(JSON.stringify({
    mode: "seed",
    prefix: PREFIX,
    credentials: {
      email: users[0].email,
      password: PASSWORD,
    },
    created: {
      group: group.name,
      matches: matches.length,
      participants: users.length,
      tournament: tournament.name,
    },
    note: "Predictions are intentionally not seeded because locked predictions cannot be deleted by cleanup.",
  }, null, 2));
};

if (mode === "cleanup") {
  cleanup().catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else {
  seed().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
