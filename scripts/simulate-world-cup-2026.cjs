const { buildWorldCup2026Dataset } = require("./world-cup-2026-dataset.cjs");

const dataset = buildWorldCup2026Dataset();
const seedScore = (matchNumber) => {
  const home = (matchNumber * 7 + 3) % 4;
  const away = (matchNumber * 5 + 1) % 4;
  return { away, home };
};

const outcome = ({ away, home }) => {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
};

const simulations = dataset.matches.map((match) => {
  const score = seedScore(match.matchNumber);
  return {
    away_score: score.away,
    away_team: match.awayTeam,
    home_score: score.home,
    home_team: match.homeTeam,
    match_number: match.matchNumber,
    outcome: outcome(score),
    provider_external_id: match.providerExternalId,
    round: match.round,
    stage: match.stage,
  };
});

const byStage = simulations.reduce((acc, match) => {
  acc[match.stage] = (acc[match.stage] ?? 0) + 1;
  return acc;
}, {});

console.log(JSON.stringify({
  championship: dataset.championship,
  groups: dataset.groups.length,
  matches: simulations.length,
  sample: simulations.slice(0, 8),
  stages: byStage,
  teams: dataset.teams.length,
}, null, 2));
