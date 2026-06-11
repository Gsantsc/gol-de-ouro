const { optionalEnv, requireEnv } = require("./env.cjs");

const API_FOOTBALL_BASE_URL = optionalEnv("API_FOOTBALL_BASE_URL", "https://v3.football.api-sports.io");

let requestCount = 0;

const getApiFootballKey = () =>
  requireEnv("API_FOOTBALL_KEY", "Nunca use API_FOOTBALL_KEY como NEXT_PUBLIC ou EXPO_PUBLIC.");

const fetchApiFootball = async (path, params = {}) => {
  const apiKey = getApiFootballKey();
  const url = new URL(`${API_FOOTBALL_BASE_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  requestCount += 1;

  const response = await fetch(url.toString(), {
    headers: {
      "x-apisports-key": apiKey,
    },
    signal: AbortSignal.timeout(30000),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`API-Football HTTP ${response.status}: ${text}`);
  }

  const errors = payload.errors;
  if (
    errors &&
    ((Array.isArray(errors) && errors.length > 0) ||
      (typeof errors === "object" && Object.keys(errors).length > 0) ||
      (typeof errors === "string" && errors.trim() !== ""))
  ) {
    throw new Error(`API-Football errors: ${JSON.stringify(errors)}`);
  }

  return {
    paging: payload.paging,
    requestCount,
    response: payload.response ?? [],
    results: payload.results ?? 0,
  };
};

module.exports = {
  fetchApiFootball,
  getApiFootballRequestCount: () => requestCount,
};
