const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const ASSUMED_MATCH_LIVE_WINDOW_MINUTES = 180;

const calculatePredictionWindow = (startTime, lockMinutes = 60) => {
  const startAt = new Date(startTime);
  return {
    prediction_close_at: new Date(startAt.getTime() - lockMinutes * 60 * 1000).toISOString(),
    prediction_open_at: new Date(startAt.getTime() - 24 * HOUR_MS).toISOString(),
  };
};

const calculateMatchStatus = (match, now, lockMinutes = 60) => {
  if (match.status === "encerrado") return "encerrado";

  if (match.status === "ao_vivo") {
    const startAt = new Date(match.start_time);
    const liveWindowEndsAt = new Date(startAt.getTime() + ASSUMED_MATCH_LIVE_WINDOW_MINUTES * MINUTE_MS);
    if (now >= startAt && now <= liveWindowEndsAt) return "ao_vivo";
  }

  const windowPayload = calculatePredictionWindow(match.start_time, lockMinutes);
  const openAt = new Date(windowPayload.prediction_open_at);
  const closeAt = new Date(windowPayload.prediction_close_at);
  const startAt = new Date(match.start_time);

  if (now < openAt) return "fechado";
  if (now < closeAt) return "aberto";
  return "fechado";
};

const outcome = ({ awayScore, homeScore }) => {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
};

const normalize = (value) => {
  const next = String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return next || null;
};

const normalizeId = (value) => String(value ?? "").trim() || null;

const marketHit = (officialId, predictionId, officialText, predictionText) => {
  const nextOfficialId = normalizeId(officialId);
  const nextPredictionId = normalizeId(predictionId);
  if (nextOfficialId && nextPredictionId) return nextOfficialId === nextPredictionId;

  const nextOfficialText = normalize(officialText);
  const nextPredictionText = normalize(predictionText);
  return nextOfficialText !== null
    && nextPredictionText !== null
    && nextOfficialText === nextPredictionText;
};

const calculatePredictionPoints = (official, prediction) => {
  const exact = official.homeScore === prediction.homeScore && official.awayScore === prediction.awayScore;
  const winner = prediction.winner ?? outcome(prediction);
  const sameOutcome = outcome(official) === winner;
  const isNoGoalMatch = official.homeScore === 0 && official.awayScore === 0;
  const firstScorer =
    !isNoGoalMatch
    && marketHit(official.firstScorerId, prediction.firstScorerId, official.firstScorer, prediction.firstScorer);
  const bothTeamsScore =
    prediction.bothTeamsScore !== null
    && prediction.bothTeamsScore !== undefined
    && prediction.bothTeamsScore === (official.homeScore > 0 && official.awayScore > 0);
  const manOfMatch = marketHit(
    official.manOfMatchId,
    prediction.manOfMatchId,
    official.manOfMatch,
    prediction.manOfMatch,
  );

  let points = 0;
  if (exact) points += 10;
  if (sameOutcome) points += 5;
  if (firstScorer) points += 5;
  if (bothTeamsScore) points += 2;
  if (manOfMatch) points += 3;

  return points;
};

const match = {
  away_team: "South Africa",
  home_team: "Mexico",
  start_time: "2026-06-11T19:00:00.000Z",
  status: "fechado",
};

const cases = [
  ["2026-06-10T18:59:00.000Z", "fechado"],
  ["2026-06-10T19:00:00.000Z", "aberto"],
  ["2026-06-11T17:59:00.000Z", "aberto"],
  ["2026-06-11T18:00:00.000Z", "fechado"],
  ["2026-06-11T19:00:00.000Z", "fechado"],
  ["2026-06-11T22:00:00.000Z", "fechado"],
];

const failures = cases.flatMap(([now, expected]) => {
  const actual = calculateMatchStatus(match, new Date(now));
  return actual === expected ? [] : [{ actual, expected, now }];
});

const lockCases = [
  [60, "2026-06-11T17:59:00.000Z", "aberto"],
  [60, "2026-06-11T18:00:00.000Z", "fechado"],
  [90, "2026-06-11T17:29:00.000Z", "aberto"],
  [90, "2026-06-11T17:30:00.000Z", "fechado"],
  [120, "2026-06-11T16:59:00.000Z", "aberto"],
  [120, "2026-06-11T17:00:00.000Z", "fechado"],
  [180, "2026-06-11T15:59:00.000Z", "aberto"],
  [180, "2026-06-11T16:00:00.000Z", "fechado"],
  [180, "2026-06-11T19:00:00.000Z", "fechado"],
];

for (const [lockMinutes, now, expected] of lockCases) {
  const actual = calculateMatchStatus(match, new Date(now), lockMinutes);
  if (actual !== expected) failures.push({ actual, expected, lockMinutes, now });
}

const liveMatch = { ...match, status: "ao_vivo" };
const finishedMatch = { ...match, status: "encerrado" };
const staleLiveMatch = { ...match, status: "ao_vivo" };
const statusFilterCases = [
  ["future open appears in Aberto", match, "2026-06-11T17:59:00.000Z", "aberto"],
  ["future closed does not appear in Aberto", match, "2026-06-11T18:00:00.000Z", "fechado"],
  ["real live appears in Ao vivo", liveMatch, "2026-06-11T19:30:00.000Z", "ao_vivo"],
  ["finished does not appear in Ao vivo", finishedMatch, "2026-06-11T19:30:00.000Z", "encerrado"],
  ["finished appears in Encerrado", finishedMatch, "2026-06-12T19:30:00.000Z", "encerrado"],
  ["stale live does not stay Ao vivo", staleLiveMatch, "2026-06-12T02:01:00.000Z", "fechado"],
];

for (const [label, targetMatch, now, expected] of statusFilterCases) {
  const actual = calculateMatchStatus(targetMatch, new Date(now));
  if (actual !== expected) failures.push({ actual, expected, label, now });
}

const official = {
  awayScore: 1,
  firstScorer: "Hirving Lozano",
  firstScorerId: "player-santiago-gimenez",
  firstGoalNoGoals: false,
  homeScore: 2,
  manOfMatch: "Edson Alvarez",
  manOfMatchId: "player-edson-alvarez",
  redCard: true,
};

const scoringCases = [
  ["placar exato", official, { homeScore: 2, awayScore: 1 }, 15],
  ["vencedor correto", official, { homeScore: 1, awayScore: 0, winner: "home" }, 5],
  ["empate correto", { homeScore: 1, awayScore: 1 }, { homeScore: 2, awayScore: 2, winner: "draw" }, 5],
  ["diferenca de gols nao pontua isoladamente", official, { homeScore: 3, awayScore: 2, winner: "away" }, 0],
  ["primeiro jogador por id", official, { homeScore: 0, awayScore: 0, firstScorerId: "player-santiago-gimenez" }, 5],
  ["primeiro jogador legado", { ...official, firstScorerId: null }, { homeScore: 0, awayScore: 0, firstScorer: "hirving lozano" }, 5],
  ["sem gols sem bonus de primeiro jogador", { homeScore: 0, awayScore: 0, firstGoalNoGoals: true }, { homeScore: 0, awayScore: 0, firstGoalNoGoals: true }, 15],
  ["ambos marcam", official, { homeScore: 0, awayScore: 0, bothTeamsScore: true }, 2],
  ["homem do jogo por id", official, { homeScore: 0, awayScore: 0, manOfMatchId: "player-edson-alvarez" }, 3],
  ["homem do jogo legado", { ...official, manOfMatchId: null }, { homeScore: 0, awayScore: 0, manOfMatch: "edson alvarez" }, 3],
  ["cartao vermelho nao pontua", official, { homeScore: 0, awayScore: 0, redCard: true }, 0],
  [
    "combo ouro",
    official,
    { homeScore: 2, awayScore: 1, firstScorerId: "player-santiago-gimenez" },
    20,
  ],
  [
    "combo perfeito",
    official,
    {
      bothTeamsScore: true,
      awayScore: 1,
      firstScorerId: "player-santiago-gimenez",
      homeScore: 2,
      manOfMatchId: "player-edson-alvarez",
      redCard: true,
      winner: "home",
    },
    25,
  ],
];

for (const [label, officialResult, prediction, expected] of scoringCases) {
  const actual = calculatePredictionPoints(officialResult, prediction);
  if (actual !== expected) failures.push({ actual, expected, label });
}

if (failures.length) {
  console.error(JSON.stringify({ failures }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    match: `${match.home_team} x ${match.away_team}`,
    lockCases: lockCases.length,
    scoringCases: scoringCases.length,
    status: "ok",
    statusCases: cases.length,
  }, null, 2));
}
