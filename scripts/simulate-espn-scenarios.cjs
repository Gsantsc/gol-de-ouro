const scenarios = [
  {
    away_score: 1,
    away_team: "Japan",
    expected_status: "encerrado",
    home_score: 2,
    home_team: "Brazil",
    name: "Brasil 2 x 1 Japao",
    provider: "espn",
  },
  {
    away_score: 0,
    away_team: "South Africa",
    expected_status: "encerrado",
    home_score: 0,
    home_team: "Mexico",
    name: "Mexico 0 x 0 Africa do Sul",
    provider: "espn",
  },
];

const outcome = (home, away) => {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
};

console.log(JSON.stringify({
  dryRun: true,
  scenarios: scenarios.map((scenario, index) => ({
    ...scenario,
    both_teams_score: scenario.home_score > 0 && scenario.away_score > 0,
    eventId: `sim-espn-${String(index + 1).padStart(3, "0")}`,
    outcome: outcome(scenario.home_score, scenario.away_score),
    result_payload: {
      away_score: scenario.away_score,
      home_score: scenario.home_score,
      status: scenario.expected_status,
    },
  })),
}, null, 2));
