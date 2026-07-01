const predictionOutcome = ({ awayScore, homeScore }) => {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
};

const normalizeMarketText = (value) => {
  const normalized = value
    ?.trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return normalized || null;
};

const normalizeMarketId = (value) => value?.trim() || null;

const marketHit = (officialId, predictionId, officialText, predictionText) => {
  const normalizedOfficialId = normalizeMarketId(officialId);
  const normalizedPredictionId = normalizeMarketId(predictionId);

  if (normalizedOfficialId && normalizedPredictionId) {
    return normalizedOfficialId === normalizedPredictionId;
  }

  const normalizedOfficialText = normalizeMarketText(officialText);
  const normalizedPredictionText = normalizeMarketText(predictionText);

  return normalizedOfficialText !== null
    && normalizedPredictionText !== null
    && normalizedOfficialText === normalizedPredictionText;
};

const calculatePredictionPoints = (official, prediction) => {
  const exact = official.homeScore === prediction.homeScore && official.awayScore === prediction.awayScore;
  const winner = prediction.winner ?? predictionOutcome(prediction);
  const sameOutcome = predictionOutcome(official) === winner;
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

module.exports = {
  calculatePredictionPoints,
};
