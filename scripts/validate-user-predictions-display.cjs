/**
 * Validation script for user predictions display
 *
 * Offline mode (default): simulates helper logic and rendering safety scenarios.
 * Online mode: pass a user ID to validate predictions in Supabase.
 *
 * Usage:
 *   node scripts/validate-user-predictions-display.cjs
 *   node scripts/validate-user-predictions-display.cjs <user-id>
 */

const { createClient } = require("@supabase/supabase-js");

const VALID_TONES = new Set(["default", "green", "gold", "red", "blue"]);

const readStats = (match) => (match?.stats && typeof match.stats === "object" ? match.stats : {});

const isMatchKickoffInPast = (match, now = new Date()) => {
  const start = new Date(match.start_time);
  return !Number.isNaN(start.getTime()) && now.getTime() > start.getTime();
};

const isMatchLiveStatus = (match) => match?.status === "ao_vivo";

const isMatchFinishedForScoring = (match) => {
  if (match?.status === "encerrado") return true;
  const stats = readStats(match);
  const providerStatus = String(stats.espn_status ?? stats.espn_status_detail ?? "").toLowerCase();
  if (providerStatus.includes("final") || providerStatus.includes("post") || providerStatus.includes("encerr")) {
    return true;
  }
  if (stats.has_final_score === true || stats.hasFinalScore === true) return true;
  return false;
};

const isMatchProcessedForPrediction = (prediction, match, now = new Date()) => {
  if (!match) return false;
  if (isMatchFinishedForScoring(match)) return true;
  if (isMatchLiveStatus(match)) return false;
  if (!isMatchKickoffInPast(match, now)) return false;
  if (prediction.locked === true) return true;
  if ((prediction.points ?? 0) > 0) return true;
  return false;
};

const getPredictionDisplayStatus = (prediction, match) => {
  if (!match) {
    return "invalid_match";
  }

  if (isMatchProcessedForPrediction(prediction, match)) {
    return (prediction.points ?? 0) > 0 ? "scored_win" : "scored_zero";
  }

  if (isMatchLiveStatus(match)) {
    return "live";
  }

  return "waiting";
};

const getPredictionCategory = (prediction, match) => {
  if (!match) return "unavailable";
  if (isMatchProcessedForPrediction(prediction, match)) return "scored";
  if (isMatchLiveStatus(match)) return "live";
  return "waiting";
};

const getPredictionStatusLabel = (status) => {
  switch (status) {
    case "waiting":
      return "Aguardando";
    case "live":
      return "Ao vivo";
    case "scored_win":
      return "Pontuou";
    case "scored_zero":
      return "0 pts";
    case "invalid_match":
      return "Partida indisponivel";
    default:
      return "Indisponivel";
  }
};

const getPredictionStatusTone = (status) => {
  switch (status) {
    case "waiting":
      return "gold";
    case "live":
      return "blue";
    case "scored_win":
      return "green";
    case "scored_zero":
      return "red";
    case "invalid_match":
      return "default";
    default:
      return "default";
  }
};

const safeFormatDateTime = (value) => {
  if (!value) return "Data indisponivel";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponivel";
  return value;
};

const deriveUserPerformance = ({ matches, predictions, ranking }) => {
  const matchById = new Map((matches ?? []).map((match) => [match.id, match]));
  const finished = (predictions ?? []).filter((prediction) => {
    const match = matchById.get(prediction.match_id);
    return match ? isMatchProcessedForPrediction(prediction, match) : false;
  });

  const derivedCorrect = finished.filter((prediction) => (prediction.points ?? 0) > 0).length;
  const totalPoints = ranking?.total_points
    ?? finished.reduce((sum, prediction) => sum + Number(prediction.points ?? 0), 0);

  return {
    correctResults: ranking?.correct_results ?? derivedCorrect,
    finishedPredictions: finished.length,
    totalPoints
  };
};

const buildRows = (predictions, matches) => {
  const safePredictions = Array.isArray(predictions) ? predictions : [];
  const safeMatches = Array.isArray(matches) ? matches : [];

  return safePredictions.map((prediction) => {
    const match = safeMatches.find((item) => item.id === prediction.match_id) ?? null;
    return {
      category: getPredictionCategory(prediction, match),
      displayStatus: getPredictionDisplayStatus(prediction, match),
      match,
      prediction
    };
  });
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const runOfflineScenarios = () => {
  console.log("=== Offline predictions display validation ===\n");

  const matchFinished = { id: "m1", status: "encerrado", start_time: "2026-06-10T18:00:00.000Z" };
  const matchLive = { id: "m2", status: "ao_vivo", start_time: "2026-06-11T18:00:00.000Z" };
  const matchWaiting = { id: "m3", status: "agendado", start_time: "2026-06-12T18:00:00.000Z" };
  const matches = [matchFinished, matchLive, matchWaiting];

  const scenarios = [
    {
      name: "usuario sem palpites",
      predictions: [],
      matches,
      expect: { all: 0, scored: 0, waiting: 0, live: 0, unavailable: 0 }
    },
    {
      name: "usuario com 1 palpite valido",
      predictions: [{ id: "p1", match_id: "m3", points: 0, predicted_home_score: 1, predicted_away_score: 0 }],
      matches,
      expect: { all: 1, scored: 0, waiting: 1, live: 0, unavailable: 0 }
    },
    {
      name: "palpite pontuado com pontos",
      predictions: [{ id: "p2", match_id: "m1", points: 12, predicted_home_score: 2, predicted_away_score: 1 }],
      matches,
      expect: { all: 1, scored: 1, waiting: 0, live: 0, unavailable: 0, status: "scored_win" }
    },
    {
      name: "palpite pontuado com 0 pontos",
      predictions: [{ id: "p3", match_id: "m1", points: 0, predicted_home_score: 0, predicted_away_score: 0 }],
      matches,
      expect: { all: 1, scored: 1, waiting: 0, live: 0, unavailable: 0, status: "scored_zero" }
    },
    {
      name: "palpite aguardando resultado",
      predictions: [{ id: "p4", match_id: "m3", points: 0, predicted_home_score: 1, predicted_away_score: 1 }],
      matches,
      expect: { all: 1, scored: 0, waiting: 1, live: 0, unavailable: 0, status: "waiting" }
    },
    {
      name: "palpite ao vivo",
      predictions: [{ id: "p5", match_id: "m2", points: 0, predicted_home_score: 2, predicted_away_score: 2 }],
      matches,
      expect: { all: 1, scored: 0, waiting: 0, live: 1, unavailable: 0, status: "live" }
    },
    {
      name: "match inexistente",
      predictions: [{ id: "p6", match_id: "missing", points: 0, predicted_home_score: 1, predicted_away_score: 0 }],
      matches,
      expect: { all: 1, scored: 0, waiting: 0, live: 0, unavailable: 1, status: "invalid_match" }
    },
    {
      name: "player inexistente",
      predictions: [{
        id: "p7",
        match_id: "m3",
        points: 0,
        predicted_first_scorer_id: "missing-player",
        predicted_man_of_match_id: "missing-player-2"
      }],
      matches,
      expect: { all: 1, waiting: 1 }
    },
    {
      name: "data invalida",
      predictions: [{ id: "p8", match_id: "m3", points: 0, submitted_at: "invalid-date" }],
      matches: [{ ...matchWaiting, start_time: "invalid-date" }],
      expect: { all: 1, waiting: 1, formatted: "Data indisponivel" }
    },
    {
      name: "ranking null",
      predictions: [{ id: "p9", match_id: "m1", points: 5 }],
      matches,
      expect: { all: 1, scored: 1, totalPoints: 5 }
    },
    {
      name: "categoria e tone validos",
      predictions: [{ id: "p10", match_id: "m1", points: 3 }],
      matches,
      expect: { all: 1, scored: 1, category: "scored", tone: "green", label: "Pontuou" }
    },
    {
      name: "palpite processado com match nao encerrado mas locked",
      predictions: [{
        id: "p11",
        match_id: "m4",
        locked: true,
        points: 8,
        predicted_home_score: 1,
        predicted_away_score: 0
      }],
      matches: [...matches, {
        id: "m4",
        status: "fechado",
        start_time: "2026-06-01T18:00:00.000Z"
      }],
      expect: { all: 1, scored: 1, status: "scored_win" }
    },
    {
      name: "palpite processado com 0 pts e match espn final",
      predictions: [{
        id: "p12",
        match_id: "m5",
        locked: true,
        points: 0,
        predicted_home_score: 0,
        predicted_away_score: 0
      }],
      matches: [...matches, {
        id: "m5",
        status: "ao_vivo",
        start_time: "2026-06-01T20:00:00.000Z",
        stats: { espn_status: "STATUS_FINAL" }
      }],
      expect: { all: 1, scored: 1, status: "scored_zero" }
    },
    {
      name: "ranking total bate com soma de points processados",
      predictions: [
        { id: "p13", match_id: "m1", points: 12 },
        { id: "p14", match_id: "m1", points: 0 }
      ],
      matches,
      expect: { all: 2, scored: 2, totalPoints: 12, finishedPredictions: 2 }
    },
    {
      name: "contador processados nao usa points > 0",
      predictions: [
        { id: "p15", match_id: "m1", points: 0 },
        { id: "p16", match_id: "m1", points: 5 }
      ],
      matches,
      expect: { all: 2, scored: 2 }
    }
  ];

  let passed = 0;

  for (const scenario of scenarios) {
    const rows = buildRows(scenario.predictions, scenario.matches);
    const counts = {
      all: rows.length,
      scored: rows.filter((row) => row.category === "scored").length,
      waiting: rows.filter((row) => row.category === "waiting").length,
      live: rows.filter((row) => row.category === "live").length,
      unavailable: rows.filter((row) => row.category === "unavailable").length
    };

    assert(counts.all === scenario.expect.all, `${scenario.name}: all count mismatch`);
    if (scenario.expect.scored !== undefined) assert(counts.scored === scenario.expect.scored, `${scenario.name}: scored count mismatch`);
    if (scenario.expect.waiting !== undefined) assert(counts.waiting === scenario.expect.waiting, `${scenario.name}: waiting count mismatch`);
    if (scenario.expect.live !== undefined) assert(counts.live === scenario.expect.live, `${scenario.name}: live count mismatch`);
    if (scenario.expect.unavailable !== undefined) assert(counts.unavailable === scenario.expect.unavailable, `${scenario.name}: unavailable count mismatch`);

    if (scenario.expect.status) {
      assert(rows[0]?.displayStatus === scenario.expect.status, `${scenario.name}: status mismatch`);
    }

    if (scenario.expect.formatted) {
      const row = rows[0];
      const formatted = safeFormatDateTime(row.match?.start_time ?? row.prediction.submitted_at);
      assert(formatted === scenario.expect.formatted, `${scenario.name}: date formatting mismatch`);
    }

    if (scenario.expect.totalPoints !== undefined || scenario.expect.finishedPredictions !== undefined) {
      const performance = deriveUserPerformance({
        matches: scenario.matches,
        predictions: scenario.predictions,
        ranking: null
      });
      if (scenario.expect.totalPoints !== undefined) {
        assert(performance.totalPoints === scenario.expect.totalPoints, `${scenario.name}: total points mismatch`);
      }
      if (scenario.expect.finishedPredictions !== undefined) {
        assert(performance.finishedPredictions === scenario.expect.finishedPredictions, `${scenario.name}: finished count mismatch`);
      }
    }

    if (scenario.expect.category) {
      assert(getPredictionCategory(scenario.predictions[0], scenario.matches[0]) === scenario.expect.category, `${scenario.name}: category mismatch`);
    }

    if (scenario.expect.tone) {
      const tone = getPredictionStatusTone(rows[0].displayStatus);
      assert(tone === scenario.expect.tone, `${scenario.name}: tone mismatch`);
      assert(VALID_TONES.has(tone), `${scenario.name}: invalid tone ${tone}`);
    }

    if (scenario.expect.label) {
      assert(getPredictionStatusLabel(rows[0].displayStatus) === scenario.expect.label, `${scenario.name}: label mismatch`);
    }

    console.log(`PASS - ${scenario.name}`);
    passed += 1;
  }

  const comboPredictions = [
    { id: "c1", match_id: "m1", points: 10 },
    { id: "c2", match_id: "m1", points: 0 },
    { id: "c3", match_id: "m3", points: 0 },
    { id: "c4", match_id: "m2", points: 0 },
    { id: "c5", match_id: "m2", points: 0 },
    { id: "c6", match_id: "missing", points: 0 }
  ];
  const comboRows = buildRows(comboPredictions, matches);
  assert(comboRows.length === 6, "combo scenario: expected 6 predictions visible");
  assert(comboRows.filter((row) => row.category === "scored").length === 2, "combo scenario: scored count");
  assert(comboRows.filter((row) => row.category === "waiting").length === 1, "combo scenario: waiting count");
  assert(comboRows.filter((row) => row.category === "live").length === 2, "combo scenario: live count");
  assert(comboRows.filter((row) => row.category === "unavailable").length === 1, "combo scenario: unavailable count");
  console.log("PASS - combo de 6 palpites sem perda");

  console.log(`\nValidation: PASSED (${passed + 1} checks)\n`);
  return true;
};

const validateUserPredictionsDisplay = async (userId) => {
  require("dotenv").config({ path: ".env.local" });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log(`\n=== Validating predictions display for user: ${userId} ===\n`);

  const { data: predictions, error: predictionsError } = await supabase
    .from("predictions")
    .select("*")
    .eq("user_id", userId);

  if (predictionsError) {
    throw predictionsError;
  }

  if (!predictions || predictions.length === 0) {
    console.log("No predictions found for this user");
    return true;
  }

  const matchIds = predictions.map((prediction) => prediction.match_id);
  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("*")
    .in("id", matchIds);

  if (matchesError) {
    throw matchesError;
  }

  const rows = buildRows(predictions, matches ?? []);
  const counts = {
    all: rows.length,
    scored: rows.filter((row) => row.category === "scored").length,
    waiting: rows.filter((row) => row.category === "waiting").length,
    live: rows.filter((row) => row.category === "live").length,
    unavailable: rows.filter((row) => row.category === "unavailable").length
  };

  console.log("Category breakdown:", counts);
  rows.forEach((row) => {
    const tone = getPredictionStatusTone(row.displayStatus);
    assert(VALID_TONES.has(tone), `Invalid tone for prediction ${row.prediction.id}: ${tone}`);
    console.log(`- ${row.prediction.id}: ${row.category} (${row.displayStatus}), points=${row.prediction.points ?? 0}`);
  });

  assert(counts.all === predictions.length, "Total predictions do not match rendered rows");
  console.log("\nOnline validation: PASSED\n");
  return true;
};

const main = async () => {
  const userId = process.argv[2];

  try {
    if (!userId) {
      runOfflineScenarios();
      process.exit(0);
    }

    await validateUserPredictionsDisplay(userId);
    process.exit(0);
  } catch (error) {
    console.error("Validation failed:", error);
    process.exit(1);
  }
};

main();
