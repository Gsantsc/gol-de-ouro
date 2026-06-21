const fs = require("fs");
const path = require("path");
const {
  getSupabaseAnonKey,
  getSupabaseServiceKey,
  getSupabaseUrl,
  optionalEnv,
} = require("./env.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = getSupabaseAnonKey();
const SUPABASE_SERVICE_KEY = getSupabaseServiceKey();
const PREFIX = optionalEnv("QA_USER_FLOW_PREFIX", "QA_USER_FLOW");
const EMAIL_PREFIX = optionalEnv("QA_USER_FLOW_EMAIL_PREFIX", "qa-user-flow");
const EMAIL_DOMAIN = optionalEnv("QA_USER_FLOW_EMAIL_DOMAIN", "qa.local");
const PASSWORD = optionalEnv("QA_USER_FLOW_PASSWORD", "QaUserFlow#2026");
const PROVIDER = optionalEnv("QA_USER_FLOW_PROVIDER", "qa_user_flow");
const KEEP_DATA = process.argv.includes("--keep");
const ARTIFACT_PATH = path.join(process.cwd(), "artifacts", "qa-user-flow-evidence.json");
const HOUR_MS = 60 * 60 * 1000;

const headers = (token = SUPABASE_SERVICE_KEY) => ({
  apikey: token === SUPABASE_SERVICE_KEY ? SUPABASE_SERVICE_KEY : SUPABASE_ANON_KEY,
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
});

const readJson = async (response) => {
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
};

const rest = async (pathName, options = {}, token = SUPABASE_SERVICE_KEY) => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathName}`, {
    ...options,
    headers: {
      ...headers(token),
      ...options.headers,
    },
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body,
  });
  return readJson(response);
};

const authAdmin = async (pathName, options = {}) => {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/${pathName}`, {
    ...options,
    headers: {
      ...headers(SUPABASE_SERVICE_KEY),
      ...options.headers,
    },
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body,
  });
  return readJson(response);
};

const signIn = async (email) => {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    body: JSON.stringify({ email, password: PASSWORD }),
    headers: headers(SUPABASE_ANON_KEY),
    method: "POST",
  });
  return readJson(response);
};

const qaEmail = (index) => `${EMAIL_PREFIX}-${String(index).padStart(2, "0")}@${EMAIL_DOMAIN}`;

const listQaUsers = async () => {
  const users = await rest("users?select=id,email,name");
  return (users ?? []).filter((user) => user.email?.startsWith(`${EMAIL_PREFIX}-`) && user.email?.endsWith(`@${EMAIL_DOMAIN}`));
};

const listQaAuthUsers = async () => {
  const result = await authAdmin("users?page=1&per_page=1000");
  return (result?.users ?? []).filter((user) => user.email?.startsWith(`${EMAIL_PREFIX}-`) && user.email?.endsWith(`@${EMAIL_DOMAIN}`));
};

const deleteRows = async (table, ids, column = "id") => {
  if (!ids.length) return 0;
  await rest(`${table}?${column}=in.(${ids.join(",")})`, { method: "DELETE" });
  return ids.length;
};

const cleanup = async () => {
  const [qaUsers, qaAuthUsers, qaMatches, qaGroups, allPredictions] = await Promise.all([
    listQaUsers(),
    listQaAuthUsers(),
    rest("matches?select=id,provider_name&provider_name=eq.qa_user_flow"),
    rest(`groups?select=id,name&name=like.${PREFIX}%25`),
    rest("predictions?select=id,user_id,match_id"),
  ]);

  const userIds = qaUsers.map((user) => user.id);
  const matchIds = (qaMatches ?? []).map((match) => match.id);
  const groupIds = (qaGroups ?? []).map((group) => group.id);
  const predictionIds = (allPredictions ?? [])
    .filter((prediction) => userIds.includes(prediction.user_id) || matchIds.includes(prediction.match_id))
    .map((prediction) => prediction.id);

  const summary = {
    predictionAuditLogs: await deleteRows("prediction_audit_logs", predictionIds, "prediction_id"),
    predictions: await deleteRows("predictions", predictionIds),
    notifications: await deleteRows("notifications", userIds, "user_id"),
    achievements: await deleteRows("achievements", userIds, "user_id"),
    appInvites: await deleteRows("app_invites", userIds, "inviter_user_id"),
    groupInvites: await deleteRows("group_invites", groupIds, "group_id"),
    groupMembers: await deleteRows("group_members", groupIds, "group_id"),
    groups: await deleteRows("groups", groupIds),
    matches: await deleteRows("matches", matchIds),
    rankings: await deleteRows("rankings", userIds, "user_id"),
    users: await deleteRows("users", userIds),
    authUsers: 0,
  };

  for (const user of qaAuthUsers) {
    await authAdmin(`users/${user.id}`, { method: "DELETE" });
    summary.authUsers += 1;
  }

  return summary;
};

const createQaUser = async (index, options = {}) => {
  const email = qaEmail(index);
  const approvalStatus = options.approvalStatus ?? "approved";
  const blocked = options.blocked ?? false;
  const name = `${PREFIX} ${options.label ?? "Participante"} ${index}`;
  const status = blocked ? "suspended" : approvalStatus;
  const authUser = await authAdmin("users", {
    body: {
      email,
      email_confirm: true,
      password: PASSWORD,
      user_metadata: { name },
    },
    method: "POST",
  });

  const userId = authUser.id;
  await rest(`users?id=eq.${userId}`, {
    body: {
      approval_status: approvalStatus,
      blocked,
      email,
      id: userId,
      name,
      role: "player",
      status,
    },
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    method: "POST",
  });

  const session = await signIn(email);
  return {
    accessToken: session.access_token,
    approvalStatus,
    blocked,
    email,
    id: userId,
    name,
    status,
  };
};

const calculatePoints = (official, prediction) => {
  const outcome = (score) => {
    if (score.home > score.away) return "home";
    if (score.away > score.home) return "away";
    return "draw";
  };
  const normalize = (value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    return normalized || null;
  };
  const exact = official.home === prediction.home && official.away === prediction.away;
  const sameOutcome = outcome(official) === (prediction.winner ?? outcome(prediction));
  const sameGoalDifference = official.home - official.away === prediction.home - prediction.away;
  const firstScorer =
    (official.firstGoalNoGoals && prediction.firstGoalNoGoals)
    || (
      official.firstScorerId
      && prediction.firstScorerId
      && official.firstScorerId === prediction.firstScorerId
    )
    || (
      !official.firstScorerId
      && !prediction.firstScorerId
      && normalize(official.firstScorer)
      && normalize(official.firstScorer) === normalize(prediction.firstScorer)
    );
  const bothTeamsScore =
    prediction.bothTeamsScore !== null
    && prediction.bothTeamsScore !== undefined
    && prediction.bothTeamsScore === (official.home > 0 && official.away > 0);
  const manOfMatch =
    (
      official.manOfMatchId
      && prediction.manOfMatchId
      && official.manOfMatchId === prediction.manOfMatchId
    )
    || (
      !official.manOfMatchId
      && !prediction.manOfMatchId
      && normalize(official.manOfMatch)
      && normalize(official.manOfMatch) === normalize(prediction.manOfMatch)
    );
  const redCard =
    prediction.redCard !== null
    && prediction.redCard !== undefined
    && official.redCard !== null
    && official.redCard !== undefined
    && prediction.redCard === official.redCard;

  let points = 0;
  if (exact) points += 10;
  if (sameOutcome) points += 5;
  if (sameGoalDifference) points += 3;
  if (firstScorer) points += 8;
  if (bothTeamsScore) points += 2;
  if (manOfMatch) points += 6;
  if (redCard) points += 2;
  if (exact && firstScorer) points += 10;
  if (exact && sameOutcome && sameGoalDifference && firstScorer && bothTeamsScore && manOfMatch && redCard) points += 20;
  return points;
};

const assert = (condition, message, details = {}) => {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
};

const findPlayer = async (teamName, playerName) => {
  const players = await rest(
    `players?select=id,name,team_name&team_name=eq.${encodeURIComponent(teamName)}&name=eq.${encodeURIComponent(playerName)}&active=eq.true&deleted_at=is.null`
  );
  const player = players?.[0];
  assert(player?.id, `Jogador ${playerName} (${teamName}) nao encontrado. Rode npm run seed:players:wc2026.`, { playerName, teamName });
  return player;
};

const runScenario = async () => {
  const setupCleanup = await cleanup();
  const users = [];
  for (let index = 1; index <= 12; index += 1) {
    users.push(await createQaUser(index));
  }

  const tournaments = await rest("tournaments?select=id,name,slug,type&slug=eq.world_cup_2026");
  const tournament = tournaments?.[0] ?? (await rest("tournaments?select=id,name,slug,type&type=eq.world_cup"))?.[0];
  assert(tournament?.id, "Campeonato da Copa do Mundo não encontrado.");

  const startTime = new Date(Date.now() + 2 * HOUR_MS).toISOString();
  const match = (await rest("matches", {
    body: {
      away_score: 0,
      away_team: "Canada",
      championship: "world_cup_2026",
      home_score: 0,
      home_team: "Mexico",
      prediction_close_at: new Date(Date.now() + HOUR_MS).toISOString(),
      prediction_open_at: new Date(Date.now() - 22 * HOUR_MS).toISOString(),
      provider_external_id: `${PREFIX}-mexico-canada`,
      provider_name: PROVIDER,
      round: "QA Jornada",
      stadium: "Estádio QA",
      start_time: startTime,
      status: "aberto",
      tournament_id: tournament.id,
    },
    method: "POST",
  }))[0];

  const santiagoGimenez = await findPlayer("Mexico", "Santiago Gimenez");
  const edsonAlvarez = await findPlayer("Mexico", "Edson Alvarez");
  const alphonsoDavies = await findPlayer("Canada", "Alphonso Davies");
  const jonathanDavid = await findPlayer("Canada", "Jonathan David");

  const accessGuardCases = [
    { approvalStatus: "pending", blocked: false, expectedStatus: "pending", index: 91 },
    { approvalStatus: "rejected", blocked: false, expectedStatus: "rejected", index: 92 },
    { approvalStatus: "approved", blocked: true, expectedStatus: "suspended", index: 93 },
  ];
  const accessGuardResults = [];

  for (const guardCase of accessGuardCases) {
    const guard = await createQaUser(guardCase.index, {
      approvalStatus: guardCase.approvalStatus,
      blocked: guardCase.blocked,
      label: "Bloqueio",
    });

    let rejected = false;
    let message = null;
    try {
      await rest("predictions", {
        body: {
          match_id: match.id,
          predicted_away_score: 0,
          predicted_both_teams_score: false,
          predicted_home_score: 0,
          predicted_red_card: false,
          predicted_winner: "draw",
          user_id: guard.id,
        },
        method: "POST",
      }, guard.accessToken);
    } catch (error) {
      rejected = true;
      message = error.message;
    }

    accessGuardResults.push({
      blocked: guard.blocked,
      expectedStatus: guardCase.expectedStatus,
      message,
      rejected,
    });
  }

  const group = await rest("rpc/create_group", {
    body: {
      group_name: `${PREFIX} Liga Familia`,
      target_championship_id: tournament.id,
    },
    method: "POST",
  }, users[0].accessToken);

  for (const user of users.slice(1)) {
    await rest("rpc/join_group_by_invite", {
      body: { invite: group.invite_code },
      method: "POST",
    }, user.accessToken);
  }

  assert(group.invite_token && group.invite_url, "Grupo nao retornou token/url de convite.", group);
  const originalGroupInvite = {
    token: group.invite_token,
    url: group.invite_url,
  };
  const regeneratedGroup = await rest("rpc/regenerate_group_invite", {
    body: {
      app_base_url: "http://localhost:3000",
      target_group_id: group.id,
    },
    method: "POST",
  }, users[0].accessToken);
  assert(regeneratedGroup.invite_token !== originalGroupInvite.token, "Regenerar convite nao trocou token.", {
    originalGroupInvite,
    regenerated: regeneratedGroup.invite_token,
  });
  assert(regeneratedGroup.invite_url.includes("/invite/"), "URL de grupo nao usa fluxo /invite/:token.", regeneratedGroup);

  let oldGroupInviteRejected = false;
  try {
    await rest("rpc/join_group_by_invite", {
      body: { invite: originalGroupInvite.token },
      method: "POST",
    }, users[1].accessToken);
  } catch {
    oldGroupInviteRejected = true;
  }

  await rest("rpc/join_group_by_invite", {
    body: { invite: regeneratedGroup.invite_url },
    method: "POST",
  }, users[1].accessToken);

  const deactivatedGroup = await rest("rpc/deactivate_group_invite", {
    body: { target_group_id: group.id },
    method: "POST",
  }, users[0].accessToken);
  assert(deactivatedGroup.invite_active === false, "Desativar convite nao marcou link como inativo.", deactivatedGroup);

  let inactiveGroupInviteRejected = false;
  try {
    await rest("rpc/join_group_by_invite", {
      body: { invite: regeneratedGroup.invite_token },
      method: "POST",
    }, users[2].accessToken);
  } catch {
    inactiveGroupInviteRejected = true;
  }

  const appInvite = await rest("rpc/create_app_invite", {
    body: {
      app_base_url: "http://localhost:3000",
      invited_email: null,
    },
    method: "POST",
  }, users[0].accessToken);
  assert(appInvite.invite_token && appInvite.invite_url.includes("/invite/app/"), "Convite do app nao gerou token/url.", appInvite);

  const acceptedAppInvite = await rest("rpc/accept_app_invite", {
    body: { invite: appInvite.invite_url },
    method: "POST",
  }, users[1].accessToken);
  assert(acceptedAppInvite.status === "accepted", "Convite do app nao foi aceito.", acceptedAppInvite);

  const appInviteToRevoke = await rest("rpc/create_app_invite", {
    body: {
      app_base_url: "http://localhost:3000",
      invited_email: null,
    },
    method: "POST",
  }, users[0].accessToken);
  const revokedAppInvite = await rest("rpc/revoke_app_invite", {
    body: { target_invite_id: appInviteToRevoke.id },
    method: "POST",
  }, users[0].accessToken);
  assert(revokedAppInvite.status === "revoked", "Convite do app nao foi revogado.", revokedAppInvite);

  const picks = [
    { home: 1, away: 0, winner: "home", firstScorerId: santiagoGimenez.id, firstGoalNoGoals: false, bothTeamsScore: false, manOfMatchId: edsonAlvarez.id, redCard: false },
    { home: 1, away: 0, winner: "home", firstScorerId: santiagoGimenez.id, firstGoalNoGoals: false, bothTeamsScore: false, manOfMatchId: edsonAlvarez.id, redCard: false },
    { home: 2, away: 0, winner: "home", firstScorerId: santiagoGimenez.id, firstGoalNoGoals: false, bothTeamsScore: false, manOfMatchId: edsonAlvarez.id, redCard: false },
    { home: 0, away: 1, winner: "away", firstScorerId: alphonsoDavies.id, firstGoalNoGoals: false, bothTeamsScore: false, manOfMatchId: jonathanDavid.id, redCard: true },
    { home: 1, away: 1, winner: "draw", firstScorerId: santiagoGimenez.id, firstGoalNoGoals: false, bothTeamsScore: true, manOfMatchId: edsonAlvarez.id, redCard: false },
    { home: 0, away: 0, winner: "draw", firstScorerId: null, firstGoalNoGoals: true, bothTeamsScore: false, manOfMatchId: null, redCard: false },
    { home: 3, away: 2, winner: "home", firstScorerId: santiagoGimenez.id, firstGoalNoGoals: false, bothTeamsScore: true, manOfMatchId: edsonAlvarez.id, redCard: true },
    { home: 4, away: 3, winner: "home", firstScorerId: santiagoGimenez.id, firstGoalNoGoals: false, bothTeamsScore: true, manOfMatchId: edsonAlvarez.id, redCard: true },
    { home: 2, away: 2, winner: "draw", firstScorerId: santiagoGimenez.id, firstGoalNoGoals: false, bothTeamsScore: true, manOfMatchId: edsonAlvarez.id, redCard: true },
    { home: 3, away: 0, winner: "home", firstScorerId: santiagoGimenez.id, firstGoalNoGoals: false, bothTeamsScore: false, manOfMatchId: edsonAlvarez.id, redCard: true },
    { home: 0, away: 2, winner: "away", firstScorerId: alphonsoDavies.id, firstGoalNoGoals: false, bothTeamsScore: false, manOfMatchId: jonathanDavid.id, redCard: false },
    { home: 2, away: 1, winner: "home", firstScorerId: santiagoGimenez.id, firstGoalNoGoals: false, bothTeamsScore: true, manOfMatchId: edsonAlvarez.id, redCard: true },
  ];

  for (const [index, user] of users.entries()) {
    const pick = picks[index];
    await rest("predictions", {
      body: {
        match_id: match.id,
        predicted_away_score: pick.away,
        predicted_both_teams_score: pick.bothTeamsScore,
        predicted_first_goal_no_goals: pick.firstGoalNoGoals,
        predicted_first_scorer: null,
        predicted_first_scorer_id: pick.firstScorerId,
        predicted_home_score: pick.home,
        predicted_man_of_match: null,
        predicted_man_of_match_id: pick.manOfMatchId,
        predicted_red_card: pick.redCard,
        predicted_winner: pick.winner,
        user_id: user.id,
      },
      method: "POST",
    }, user.accessToken);
  }

  const editedPrediction = (await rest(`predictions?user_id=eq.${users[0].id}&match_id=eq.${match.id}`, {
    body: {
      predicted_away_score: 1,
      predicted_both_teams_score: true,
      predicted_first_goal_no_goals: false,
      predicted_first_scorer: null,
      predicted_first_scorer_id: santiagoGimenez.id,
      predicted_home_score: 2,
      predicted_man_of_match: null,
      predicted_man_of_match_id: edsonAlvarez.id,
      predicted_red_card: true,
      predicted_winner: "home",
    },
    method: "PATCH",
  }, users[0].accessToken))[0];

  await rest(`matches?id=eq.${match.id}`, {
    body: { start_time: new Date(Date.now() + 30 * 60 * 1000).toISOString() },
    method: "PATCH",
  });
  const statusUpdates = await rest("rpc/refresh_match_statuses", { body: {}, method: "POST" });

  let editAfterCloseRejected = false;
  try {
    await rest(`predictions?user_id=eq.${users[0].id}&match_id=eq.${match.id}`, {
      body: {
        predicted_away_score: 0,
        predicted_both_teams_score: false,
        predicted_home_score: 0,
        predicted_winner: "draw",
      },
      method: "PATCH",
    }, users[0].accessToken);
  } catch (error) {
    editAfterCloseRejected = /janela|Palpites encerrad|Palpites encerram|fechada/i.test(error.message);
  }

  await rest(`matches?id=eq.${match.id}`, {
    body: {
      away_score: 1,
      first_goal_no_goals: false,
      first_goal_scorer: null,
      first_goal_scorer_id: santiagoGimenez.id,
      home_score: 2,
      man_of_match: null,
      man_of_match_id: edsonAlvarez.id,
      red_card_happened: true,
      status: "encerrado",
    },
    method: "PATCH",
  });

  const [predictions, rankings, achievements, notifications, members] = await Promise.all([
    rest(`predictions?select=*&match_id=eq.${match.id}`),
    rest(`rankings?select=*&user_id=in.(${users.map((user) => user.id).join(",")})`),
    rest(`achievements?select=*&user_id=eq.${users[0].id}`),
    rest(`notifications?select=*&user_id=eq.${users[0].id}`),
    rest(`group_members?select=*&group_id=eq.${group.id}`),
  ]);

  const predictionByUser = new Map(predictions.map((prediction) => [prediction.user_id, prediction]));
  const rankingByUser = new Map(rankings.map((ranking) => [ranking.user_id, ranking]));
  const expectedMainPoints = calculatePoints(
    { home: 2, away: 1, firstScorerId: santiagoGimenez.id, firstGoalNoGoals: false, manOfMatchId: edsonAlvarez.id, redCard: true },
    {
      home: 2,
      away: 1,
      winner: "home",
      firstScorerId: santiagoGimenez.id,
      firstGoalNoGoals: false,
      bothTeamsScore: true,
      manOfMatchId: edsonAlvarez.id,
      redCard: true,
    },
  );
  const mainPrediction = predictionByUser.get(users[0].id);
  const mainRanking = rankingByUser.get(users[0].id);
  const firstPrediction = achievements.find((achievement) => achievement.badge === "Primeiro Palpite");
  const top10 = achievements.find((achievement) => achievement.badge === "Top 10 da Semana");

  assert(editedPrediction.predicted_home_score === 2 && editedPrediction.predicted_away_score === 1, "Edição enquanto aberto não persistiu.", editedPrediction);
  assert(
    accessGuardResults.every((result) => result.rejected),
    "Usuario pending/rejected/suspended conseguiu palpitar.",
    accessGuardResults,
  );
  assert(editedPrediction.predicted_winner === "home", "Vencedor do palpite oficial nao persistiu.", editedPrediction);
  assert(editedPrediction.predicted_first_scorer_id === santiagoGimenez.id, "Primeiro marcador por ID nao persistiu.", editedPrediction);
  assert(editedPrediction.predicted_first_scorer === null, "Nome legado do primeiro marcador foi salvo indevidamente.", editedPrediction);
  assert(editedPrediction.predicted_first_goal_no_goals === false, "Flag sem gols divergente.", editedPrediction);
  assert(editedPrediction.predicted_both_teams_score === true, "Ambos marcam nao persistiu.", editedPrediction);
  assert(editedPrediction.predicted_man_of_match_id === edsonAlvarez.id, "Homem do jogo por ID nao persistiu.", editedPrediction);
  assert(editedPrediction.predicted_man_of_match === null, "Nome legado do homem do jogo foi salvo indevidamente.", editedPrediction);
  assert(editedPrediction.predicted_red_card === true, "Cartao vermelho nao persistiu.", editedPrediction);
  assert(editAfterCloseRejected, "Edição após fechamento não foi rejeitada.");
  assert(oldGroupInviteRejected, "Token antigo de grupo continuou valido apos regenerar.");
  assert(inactiveGroupInviteRejected, "Token de grupo inativo continuou permitindo entrada.");
  assert(mainPrediction.points === expectedMainPoints, "Pontuação do palpite principal divergente.", mainPrediction);
  assert(mainRanking.total_points === expectedMainPoints, "Ranking principal não refletiu a pontuação.", mainRanking);
  assert(mainRanking.correct_results === 1, "Acertos do ranking principal divergentes.", mainRanking);
  assert(mainRanking.exact_scores === 1, "Placares exatos do ranking principal divergentes.", mainRanking);
  assert(members.length === 12, "Liga não possui 12 participantes.", { members: members.length });
  assert(Boolean(firstPrediction?.unlocked_at), "Conquista Primeiro Palpite não desbloqueou.", firstPrediction);
  assert(Boolean(top10?.unlocked_at), "Conquista Top 10 da Semana não desbloqueou.", top10);
  assert(notifications.some((notification) => notification.metadata?.event === "prediction_created"), "Notificação de criação ausente.");
  assert(notifications.some((notification) => notification.metadata?.event === "prediction_updated"), "Notificação de edição ausente.");
  assert(notifications.some((notification) => notification.metadata?.event === "prediction_scored"), "Notificação de pontuação ausente.");

  const sortedRankings = [...rankings].sort((left, right) => right.total_points - left.total_points || right.exact_scores - left.exact_scores);
  const evidence = {
    achievements: achievements.map(({ badge, goal, progress, unlocked_at }) => ({ badge, goal, progress, unlocked: Boolean(unlocked_at) })),
    accessGuards: accessGuardResults,
    editAfterCloseRejected,
    editedPrediction: {
      away: editedPrediction.predicted_away_score,
      bothTeamsScore: editedPrediction.predicted_both_teams_score,
      firstGoalNoGoals: editedPrediction.predicted_first_goal_no_goals,
      firstScorerId: editedPrediction.predicted_first_scorer_id,
      firstScorerNameText: editedPrediction.predicted_first_scorer,
      home: editedPrediction.predicted_home_score,
      manOfMatchId: editedPrediction.predicted_man_of_match_id,
      manOfMatchNameText: editedPrediction.predicted_man_of_match,
      redCard: editedPrediction.predicted_red_card,
      winner: editedPrediction.predicted_winner,
    },
    group: {
      inactiveGroupInviteRejected,
      inviteActiveAfterDeactivate: deactivatedGroup.invite_active,
      members: members.length,
      newInviteUrl: regeneratedGroup.invite_url,
      name: group.name,
      oldGroupInviteRejected,
    },
    appInvite: {
      acceptedStatus: acceptedAppInvite.status,
      revokedStatus: revokedAppInvite.status,
      url: appInvite.invite_url,
    },
    match: {
      away: match.away_team,
      home: match.home_team,
      statusUpdates,
    },
    notifications: notifications.map(({ metadata, title }) => ({ event: metadata?.event, title })),
    predictions: predictions.length,
    rankingTop3: sortedRankings.slice(0, 3).map((ranking) => ({
      exact_scores: ranking.exact_scores,
      total_points: ranking.total_points,
      user_id: ranking.user_id,
    })),
    setupCleanup,
  };

  fs.mkdirSync(path.dirname(ARTIFACT_PATH), { recursive: true });
  fs.writeFileSync(ARTIFACT_PATH, JSON.stringify(evidence, null, 2));
  return evidence;
};

const main = async () => {
  let evidence;
  try {
    evidence = await runScenario();
    console.log(JSON.stringify({ artifact: ARTIFACT_PATH, status: "ok", evidence }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      details: error.details ?? null,
      error: error instanceof Error ? error.message : String(error),
      status: "failed",
    }, null, 2));
    process.exitCode = 1;
  } finally {
    if (!KEEP_DATA) {
      const finalCleanup = await cleanup();
      console.log(JSON.stringify({ finalCleanup }, null, 2));
    }
  }
};

main();
