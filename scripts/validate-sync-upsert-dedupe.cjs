const dedupeStandingsPayload = (rows) => {
  const payloadByConflictKey = new Map();

  for (const standing of rows) {
    const key = `${standing.tournament_id}:${standing.team_name}`;
    payloadByConflictKey.set(key, standing);
  }

  return [...payloadByConflictKey.values()];
};

const dedupeRankingsPayload = (rows) => {
  const payloadByUserId = new Map();

  for (const row of rows) {
    payloadByUserId.set(row.user_id, row);
  }

  return [...payloadByUserId.values()];
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const runStandingsDuplicateScenario = () => {
  const tournamentId = "11111111-1111-1111-1111-111111111111";
  const duplicatePayload = [
    {
      tournament_id: tournamentId,
      team_name: "Brazil",
      group_code: "G",
      played: 2,
      points: 4,
    },
    {
      tournament_id: tournamentId,
      team_name: "Brazil",
      group_code: "H",
      played: 3,
      points: 6,
    },
  ];

  const deduped = dedupeStandingsPayload(duplicatePayload);
  assert(deduped.length === 1, "standings_upsert_duplicate_payload: expected one row after dedupe");
  assert(deduped[0].played === 3, "standings_upsert_duplicate_payload: last duplicate should win");

  const keys = new Set(deduped.map((row) => `${row.tournament_id}:${row.team_name}`));
  assert(keys.size === deduped.length, "standings_upsert_duplicate_payload: upsert keys must be unique");

  return {
    after: deduped.length,
    before: duplicatePayload.length,
    removed: duplicatePayload.length - deduped.length,
  };
};

const runRankingsDuplicateScenario = () => {
  const duplicatePayload = [
    { user_id: "user-1", total_points: 10, correct_results: 1, exact_scores: 0 },
    { user_id: "user-1", total_points: 12, correct_results: 2, exact_scores: 1 },
    { user_id: "user-2", total_points: 8, correct_results: 1, exact_scores: 0 },
  ];

  const deduped = dedupeRankingsPayload(duplicatePayload);
  assert(deduped.length === 2, "rankings duplicate payload: expected two users after dedupe");

  const keys = new Set(deduped.map((row) => row.user_id));
  assert(keys.size === deduped.length, "rankings duplicate payload: upsert keys must be unique");

  return {
    after: deduped.length,
    before: duplicatePayload.length,
    removed: duplicatePayload.length - deduped.length,
  };
};

const scenarios = [
  ["standings_upsert_duplicate_payload", runStandingsDuplicateScenario],
  ["rankings_upsert_duplicate_payload", runRankingsDuplicateScenario],
];

let passed = 0;

for (const [name, run] of scenarios) {
  const result = run();
  console.log(`PASS - ${name}`, result);
  passed += 1;
}

console.log(`\nValidation: PASSED (${passed}/${scenarios.length})\n`);
