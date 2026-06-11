const HOUR_MS = 60 * 60 * 1000;

const calculatePredictionWindow = (startTime) => {
  const startAt = new Date(startTime);
  return {
    prediction_close_at: new Date(startAt.getTime() - HOUR_MS).toISOString(),
    prediction_open_at: new Date(startAt.getTime() - 24 * HOUR_MS).toISOString(),
  };
};

const calculateMatchStatus = (match, now) => {
  if (match.status === "encerrado") return "encerrado";

  const windowPayload = calculatePredictionWindow(match.start_time);
  const openAt = new Date(windowPayload.prediction_open_at);
  const closeAt = new Date(windowPayload.prediction_close_at);

  if (now < openAt) return "fechado";
  if (now < closeAt) return "aberto";
  return "ao_vivo";
};

const outcome = ({ awayScore, homeScore }) => {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
};

const normalize = (value) => {
  const next = String(value ?? "").trim().toLowerCase();
  return next || null;
};

const calculatePredictionPoints = (official, prediction) => {
  const exact = official.homeScore === prediction.homeScore && official.awayScore === prediction.awayScore;
  const winner = prediction.winner ?? outcome(prediction);
  const sameOutcome = outcome(official) === winner;
  const sameGoalDifference = official.homeScore - official.awayScore === prediction.homeScore - prediction.awayScore;
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
    && prediction.bothTeamsScore === (official.homeScore > 0 && official.awayScore > 0);
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
  ["2026-06-11T18:00:00.000Z", "ao_vivo"],
  ["2026-06-11T22:00:00.000Z", "ao_vivo"],
];

const failures = cases.flatMap(([now, expected]) => {
  const actual = calculateMatchStatus(match, new Date(now));
  return actual === expected ? [] : [{ actual, expected, now }];
});

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
  ["placar exato", official, { homeScore: 2, awayScore: 1 }, 18],
  ["vencedor correto", official, { homeScore: 1, awayScore: 0, winner: "home" }, 8],
  ["empate correto", { homeScore: 1, awayScore: 1 }, { homeScore: 2, awayScore: 2, winner: "draw" }, 8],
  ["diferenca de gols", official, { homeScore: 3, awayScore: 2, winner: "away" }, 3],
  ["primeiro jogador por id", official, { homeScore: 0, awayScore: 0, firstScorerId: "player-santiago-gimenez" }, 8],
  ["primeiro jogador legado", { ...official, firstScorerId: null }, { homeScore: 0, awayScore: 0, firstScorer: "hirving lozano" }, 8],
  ["sem gols", { homeScore: 0, awayScore: 0, firstGoalNoGoals: true }, { homeScore: 0, awayScore: 0, firstGoalNoGoals: true }, 36],
  ["ambos marcam", official, { homeScore: 0, awayScore: 0, bothTeamsScore: true }, 2],
  ["homem do jogo por id", official, { homeScore: 0, awayScore: 0, manOfMatchId: "player-edson-alvarez" }, 6],
  ["homem do jogo legado", { ...official, manOfMatchId: null }, { homeScore: 0, awayScore: 0, manOfMatch: "edson alvarez" }, 6],
  ["cartao vermelho", official, { homeScore: 0, awayScore: 0, redCard: true }, 2],
  [
    "combo ouro",
    official,
    { homeScore: 2, awayScore: 1, firstScorerId: "player-santiago-gimenez" },
    36,
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
    66,
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
    scoringCases: scoringCases.length,
    status: "ok",
    statusCases: cases.length,
  }, null, 2));
}
