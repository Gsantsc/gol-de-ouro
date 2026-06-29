// World Cup 2026 Knockout Fixtures - Round of 32 (Matches 73-88)
// This file contains the official bracket matchups for the initial knockout stage
// These are used to backfill matches 73-88 with real teams when the ESPN provider
// still shows placeholders like "Winner Group", "Runner-up Group", or "A definir"

export type KnockoutFixture = {
  matchNumber: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamCode: string;
  awayTeamCode: string;
  bracketPhase: string;
  bracketOrder: number;
};

export const WORLD_CUP_2026_KNOCKOUT_FIXTURES: KnockoutFixture[] = [
  // Round of 32 / 1/16 de final
  {
    matchNumber: 73,
    homeTeam: "South Africa",
    awayTeam: "Canada",
    homeTeamCode: "RSA",
    awayTeamCode: "CAN",
    bracketPhase: "round_of_32",
    bracketOrder: 73,
  },
  {
    matchNumber: 74,
    homeTeam: "Germany",
    awayTeam: "Paraguay",
    homeTeamCode: "GER",
    awayTeamCode: "PAR",
    bracketPhase: "round_of_32",
    bracketOrder: 74,
  },
  {
    matchNumber: 75,
    homeTeam: "Netherlands",
    awayTeam: "Morocco",
    homeTeamCode: "NED",
    awayTeamCode: "MAR",
    bracketPhase: "round_of_32",
    bracketOrder: 75,
  },
  {
    matchNumber: 76,
    homeTeam: "Brazil",
    awayTeam: "Japan",
    homeTeamCode: "BRA",
    awayTeamCode: "JPN",
    bracketPhase: "round_of_32",
    bracketOrder: 76,
  },
  {
    matchNumber: 77,
    homeTeam: "France",
    awayTeam: "Sweden",
    homeTeamCode: "FRA",
    awayTeamCode: "SWE",
    bracketPhase: "round_of_32",
    bracketOrder: 77,
  },
  {
    matchNumber: 78,
    homeTeam: "Côte d'Ivoire",
    awayTeam: "Norway",
    homeTeamCode: "CIV",
    awayTeamCode: "NOR",
    bracketPhase: "round_of_32",
    bracketOrder: 78,
  },
  {
    matchNumber: 79,
    homeTeam: "Mexico",
    awayTeam: "Ecuador",
    homeTeamCode: "MEX",
    awayTeamCode: "ECU",
    bracketPhase: "round_of_32",
    bracketOrder: 79,
  },
  {
    matchNumber: 80,
    homeTeam: "England",
    awayTeam: "Congo DR",
    homeTeamCode: "ENG",
    awayTeamCode: "COD",
    bracketPhase: "round_of_32",
    bracketOrder: 80,
  },
  {
    matchNumber: 81,
    homeTeam: "United States",
    awayTeam: "Bosnia and Herzegovina",
    homeTeamCode: "USA",
    awayTeamCode: "BIH",
    bracketPhase: "round_of_32",
    bracketOrder: 81,
  },
  {
    matchNumber: 82,
    homeTeam: "Belgium",
    awayTeam: "Senegal",
    homeTeamCode: "BEL",
    awayTeamCode: "SEN",
    bracketPhase: "round_of_32",
    bracketOrder: 82,
  },
  {
    matchNumber: 83,
    homeTeam: "Portugal",
    awayTeam: "Croatia",
    homeTeamCode: "POR",
    awayTeamCode: "CRO",
    bracketPhase: "round_of_32",
    bracketOrder: 83,
  },
  {
    matchNumber: 84,
    homeTeam: "Spain",
    awayTeam: "Austria",
    homeTeamCode: "ESP",
    awayTeamCode: "AUT",
    bracketPhase: "round_of_32",
    bracketOrder: 84,
  },
  {
    matchNumber: 85,
    homeTeam: "Switzerland",
    awayTeam: "Algeria",
    homeTeamCode: "SUI",
    awayTeamCode: "ALG",
    bracketPhase: "round_of_32",
    bracketOrder: 85,
  },
  {
    matchNumber: 86,
    homeTeam: "Argentina",
    awayTeam: "Cape Verde",
    homeTeamCode: "ARG",
    awayTeamCode: "CPV",
    bracketPhase: "round_of_32",
    bracketOrder: 86,
  },
  {
    matchNumber: 87,
    homeTeam: "Colombia",
    awayTeam: "Ghana",
    homeTeamCode: "COL",
    awayTeamCode: "GHA",
    bracketPhase: "round_of_32",
    bracketOrder: 87,
  },
  {
    matchNumber: 88,
    homeTeam: "Australia",
    awayTeam: "Egypt",
    homeTeamCode: "AUS",
    awayTeamCode: "EGY",
    bracketPhase: "round_of_32",
    bracketOrder: 88,
  },
];

// Helper function to check if a team name is a placeholder
export const isKnockoutPlaceholder = (teamName: string): boolean => {
  const placeholderPatterns = [
    "winner group",
    "runner-up group",
    "third place group",
    "a definir",
    "tbd",
    "to be determined",
  ];
  const lowerName = teamName.toLowerCase();
  return placeholderPatterns.some((pattern) => lowerName.includes(pattern));
};

// Helper function to get fixture by match number
export const getKnockoutFixture = (matchNumber: number): KnockoutFixture | null => {
  return WORLD_CUP_2026_KNOCKOUT_FIXTURES.find((f) => f.matchNumber === matchNumber) ?? null;
};
