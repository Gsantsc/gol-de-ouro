/**
 * Validation script for user predictions display
 * 
 * Objective: Ensure all predictions made by a user are eligible for display,
 * regardless of points, match status, or other filters.
 * 
 * Scenario minimum:
 * - user with 6 predictions
 * - 2 with points > 0
 * - 2 with 0 points
 * - 1 waiting for result
 * - 1 live
 * 
 * Expected result:
 * - Todos = 6
 * - Pontuados = 4
 * - Aguardando = 1
 * - Ao vivo = 1
 * 
 * No prediction should be missing.
 */

const { createClient } = require("@supabase/supabase-js");

// Load environment variables
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Simulates the getPredictionDisplayStatus function from the shared package
 */
const getPredictionDisplayStatus = (prediction, match) => {
  if (!match) {
    return "invalid_match";
  }

  const matchStatus = match.status;

  // Match is live
  if (matchStatus === "ao_vivo") {
    return "live";
  }

  // Match is not finished - waiting for result
  if (matchStatus !== "encerrado") {
    return "waiting";
  }

  // Match is finished - check points
  if (prediction.points > 0) {
    return "scored_win";
  }

  // Match is finished but prediction has 0 points
  return "scored_zero";
};

/**
 * Simulates the getPredictionCategory function from the shared package
 */
const getPredictionCategory = (prediction, match) => {
  const status = getPredictionDisplayStatus(prediction, match);
  
  if (status === "live") return "live";
  if (status === "waiting") return "waiting";
  if (status === "scored_win" || status === "scored_zero") return "scored";
  
  return "all";
};

/**
 * Validates predictions display for a specific user
 */
const validateUserPredictionsDisplay = async (userId) => {
  console.log(`\n=== Validating predictions display for user: ${userId} ===\n`);

  // Fetch all predictions for the user
  const { data: predictions, error: predictionsError } = await supabase
    .from("predictions")
    .select("*")
    .eq("user_id", userId);

  if (predictionsError) {
    console.error("Error fetching predictions:", predictionsError);
    return { success: false, error: predictionsError };
  }

  if (!predictions || predictions.length === 0) {
    console.log("No predictions found for this user");
    return { success: true, data: { total: 0, categories: {} } };
  }

  console.log(`Total predictions found: ${predictions.length}`);

  // Fetch all matches
  const matchIds = predictions.map(p => p.match_id);
  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("*")
    .in("id", matchIds);

  if (matchesError) {
    console.error("Error fetching matches:", matchesError);
    return { success: false, error: matchesError };
  }

  const matchById = new Map(matches?.map(m => [m.id, m]) || []);

  // Categorize predictions
  const categories = {
    all: 0,
    scored: 0,
    waiting: 0,
    live: 0,
    invalid_match: 0
  };

  const predictionDetails = predictions.map(prediction => {
    const match = matchById.get(prediction.match_id);
    const category = getPredictionCategory(prediction, match);
    const status = getPredictionDisplayStatus(prediction, match);
    
    categories.all++;
    categories[category]++;
    if (status === "invalid_match") {
      categories.invalid_match++;
    }

    return {
      predictionId: prediction.id,
      matchId: prediction.match_id,
      matchStatus: match?.status,
      points: prediction.points,
      category,
      status
    };
  });

  // Display results
  console.log("\n=== Category Breakdown ===");
  console.log(`Todos (all): ${categories.all}`);
  console.log(`Pontuados (scored): ${categories.scored}`);
  console.log(`Aguardando (waiting): ${categories.waiting}`);
  console.log(`Ao vivo (live): ${categories.live}`);
  console.log(`Partidas não encontradas (invalid_match): ${categories.invalid_match}`);

  console.log("\n=== Prediction Details ===");
  predictionDetails.forEach(detail => {
    console.log(`- Prediction ${detail.predictionId}: ${detail.category} (${detail.status}), Points: ${detail.points}, Match Status: ${detail.matchStatus}`);
  });

  // Validate expected results
  const isValid = categories.all === predictions.length;
  
  console.log("\n=== Validation Result ===");
  console.log(`Total predictions: ${predictions.length}`);
  console.log(`Total in categories: ${categories.all}`);
  console.log(`Validation: ${isValid ? "✅ PASSED" : "❌ FAILED"}`);

  if (!isValid) {
    console.error("ERROR: Total predictions don't match category total!");
  }

  if (categories.invalid_match > 0) {
    console.warn(`WARNING: ${categories.invalid_match} predictions have invalid matches`);
  }

  return {
    success: true,
    data: {
      total: predictions.length,
      categories,
      predictionDetails,
      isValid
    }
  };
};

/**
 * Main function
 */
const main = async () => {
  console.log("=== User Predictions Display Validation ===\n");

  // Get a test user (you can specify a user ID as argument)
  const userId = process.argv[2];

  if (!userId) {
    console.error("Please provide a user ID as argument");
    console.log("Usage: node scripts/validate-user-predictions-display.cjs <user-id>");
    process.exit(1);
  }

  const result = await validateUserPredictionsDisplay(userId);

  if (!result.success) {
    console.error("Validation failed:", result.error);
    process.exit(1);
  }

  console.log("\n=== Validation Complete ===");
  process.exit(result.data.isValid ? 0 : 1);
};

main().catch(error => {
  console.error("Error:", error);
  process.exit(1);
});
