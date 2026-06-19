const PROVIDER_NAME = "static-wc2026";
const CHAMPIONSHIP = "world_cup_2026";
const TOURNAMENT_NAME = "Copa do Mundo 2026";

const groups = [
  { name: "Grupo A", code: "A", teams: ["Mexico", "South Africa", "Korea Republic", "Czechia"] },
  { name: "Grupo B", code: "B", teams: ["Canada", "Switzerland", "Qatar", "Norway"] },
  { name: "Grupo C", code: "C", teams: ["Brazil", "Morocco", "Haiti", "Scotland"] },
  { name: "Grupo D", code: "D", teams: ["USA", "Paraguay", "Australia", "Turkey"] },
  { name: "Grupo E", code: "E", teams: ["Argentina", "Algeria", "Austria", "Jordan"] },
  { name: "Grupo F", code: "F", teams: ["France", "Colombia", "Ghana", "Iraq"] },
  { name: "Grupo G", code: "G", teams: ["Spain", "Saudi Arabia", "Cabo Verde", "New Zealand"] },
  { name: "Grupo H", code: "H", teams: ["England", "Japan", "Tunisia", "Panama"] },
  { name: "Grupo I", code: "I", teams: ["Germany", "Uruguay", "Uzbekistan", "Cote d'Ivoire"] },
  { name: "Grupo J", code: "J", teams: ["Portugal", "Ecuador", "Congo DR", "Curacao"] },
  { name: "Grupo K", code: "K", teams: ["Netherlands", "Senegal", "IR Iran", "Bosnia-Herzegovina"] },
  { name: "Grupo L", code: "L", teams: ["Belgium", "Croatia", "Egypt", "Sweden"] },
];

const venues = [
  { stadium: "Estadio Azteca", city: "Mexico City", country: "Mexico" },
  { stadium: "Estadio Akron", city: "Guadalajara", country: "Mexico" },
  { stadium: "Estadio BBVA", city: "Monterrey", country: "Mexico" },
  { stadium: "BMO Field", city: "Toronto", country: "Canada" },
  { stadium: "BC Place", city: "Vancouver", country: "Canada" },
  { stadium: "Mercedes-Benz Stadium", city: "Atlanta", country: "United States" },
  { stadium: "Gillette Stadium", city: "Foxborough", country: "United States" },
  { stadium: "AT&T Stadium", city: "Arlington", country: "United States" },
  { stadium: "NRG Stadium", city: "Houston", country: "United States" },
  { stadium: "Arrowhead Stadium", city: "Kansas City", country: "United States" },
  { stadium: "SoFi Stadium", city: "Inglewood", country: "United States" },
  { stadium: "Hard Rock Stadium", city: "Miami Gardens", country: "United States" },
  { stadium: "MetLife Stadium", city: "East Rutherford", country: "United States" },
  { stadium: "Lincoln Financial Field", city: "Philadelphia", country: "United States" },
  { stadium: "Levi's Stadium", city: "Santa Clara", country: "United States" },
  { stadium: "Lumen Field", city: "Seattle", country: "United States" },
];

const groupStageDates = {
  1: { A: "2026-06-11", B: "2026-06-12", C: "2026-06-13", D: "2026-06-13", E: "2026-06-14", F: "2026-06-14", G: "2026-06-15", H: "2026-06-15", I: "2026-06-16", J: "2026-06-16", K: "2026-06-17", L: "2026-06-17" },
  2: { A: "2026-06-18", B: "2026-06-18", C: "2026-06-19", D: "2026-06-19", E: "2026-06-20", F: "2026-06-20", G: "2026-06-21", H: "2026-06-21", I: "2026-06-22", J: "2026-06-22", K: "2026-06-23", L: "2026-06-23" },
  3: { A: "2026-06-24", B: "2026-06-24", C: "2026-06-24", D: "2026-06-25", E: "2026-06-25", F: "2026-06-25", G: "2026-06-26", H: "2026-06-26", I: "2026-06-26", J: "2026-06-27", K: "2026-06-27", L: "2026-06-27" },
};

const timeSlots = ["16:00:00", "19:00:00", "22:00:00", "01:00:00"];
const groupPairings = [
  { matchday: 1, pairs: [[0, 1], [2, 3]] },
  { matchday: 2, pairs: [[0, 2], [3, 1]] },
  { matchday: 3, pairs: [[3, 0], [1, 2]] },
];

const toIso = (date, time) => `${date}T${time}.000Z`;
const kickoffOverrides = {
  "static-wc2026-korea-republic-czechia": "2026-06-12T02:00:00.000Z",
  "static-wc2026-mexico-south-africa": "2026-06-11T19:00:00.000Z",
};
const predictionWindow = (startTime) => {
  const startAt = new Date(startTime);
  return {
    prediction_close_at: new Date(startAt.getTime() - 60 * 60 * 1000).toISOString(),
    prediction_open_at: new Date(startAt.getTime() - 24 * 60 * 60 * 1000).toISOString(),
  };
};

const externalIdFor = (matchNumber, homeTeam, awayTeam) => {
  if (homeTeam === "Mexico" && awayTeam === "South Africa") return "static-wc2026-mexico-south-africa";
  if (homeTeam === "Korea Republic" && awayTeam === "Czechia") return "static-wc2026-korea-republic-czechia";
  return `static-wc2026-${String(matchNumber).padStart(3, "0")}`;
};

const buildGroupStageMatches = () => {
  const matches = [];
  let matchNumber = 1;
  for (const pairingSet of groupPairings) {
    for (const group of groups) {
      const groupIndex = groups.findIndex((entry) => entry.code === group.code);
      for (const [pairIndex, pair] of pairingSet.pairs.entries()) {
        const venue = venues[(matchNumber - 1) % venues.length];
        const date = groupStageDates[pairingSet.matchday][group.code];
        const time = timeSlots[(groupIndex + pairIndex + pairingSet.matchday) % timeSlots.length];
        const homeTeam = group.teams[pair[0]];
        const awayTeam = group.teams[pair[1]];
        const providerExternalId = externalIdFor(matchNumber, homeTeam, awayTeam);
        const startTime = kickoffOverrides[providerExternalId] ?? toIso(date, time);
        matches.push({ awayTeam, city: venue.city, country: venue.country, group: group.code, homeTeam, matchNumber, providerExternalId, round: `Grupo ${group.code} - Rodada ${pairingSet.matchday}`, stage: "group", stadium: venue.stadium, startTime, ...predictionWindow(startTime) });
        matchNumber += 1;
      }
    }
  }
  return matches;
};

const roundOf32 = [
  ["Runner-up Group A", "Runner-up Group B"], ["Winner Group E", "Third Place Group A/B/C/D/F"], ["Winner Group F", "Runner-up Group C"], ["Winner Group C", "Third Place Group F/H/I/J/K"],
  ["Winner Group I", "Third Place Group C/D/F/G/H"], ["Runner-up Group E", "Runner-up Group I"], ["Winner Group A", "Third Place Group C/E/F/H/I"], ["Winner Group L", "Third Place Group E/H/I/J/K"],
  ["Winner Group D", "Third Place Group B/E/F/I/J"], ["Winner Group G", "Third Place Group A/E/H/I/J"], ["Runner-up Group K", "Runner-up Group L"], ["Winner Group H", "Runner-up Group J"],
  ["Winner Group B", "Third Place Group E/F/G/I/J"], ["Winner Group J", "Runner-up Group H"], ["Runner-up Group D", "Runner-up Group G"], ["Winner Group K", "Third Place Group D/E/I/J/L"],
];

const buildKnockoutMatches = () => {
  const matches = [];
  const push = ({ awayTeam, date, homeTeam, matchNumber, round, stage, time = "19:00:00", venueIndex }) => {
    const venue = venues[venueIndex % venues.length];
    const startTime = toIso(date, time);
    matches.push({ awayTeam, city: venue.city, country: venue.country, group: null, homeTeam, matchNumber, providerExternalId: `static-wc2026-${String(matchNumber).padStart(3, "0")}`, round, stage, stadium: venue.stadium, startTime, ...predictionWindow(startTime) });
  };
  const r32Dates = ["2026-06-28", "2026-06-28", "2026-06-29", "2026-06-29", "2026-06-30", "2026-06-30", "2026-07-01", "2026-07-01", "2026-07-02", "2026-07-02", "2026-07-02", "2026-07-02", "2026-07-03", "2026-07-03", "2026-07-03", "2026-07-03"];
  roundOf32.forEach(([homeTeam, awayTeam], index) => push({ awayTeam, date: r32Dates[index], homeTeam, matchNumber: 73 + index, round: "Round of 32", stage: "round_of_32", time: timeSlots[index % timeSlots.length], venueIndex: 4 + index }));
  const r16Dates = ["2026-07-04", "2026-07-04", "2026-07-05", "2026-07-05", "2026-07-06", "2026-07-06", "2026-07-07", "2026-07-07"];
  for (let index = 0; index < 8; index += 1) push({ awayTeam: `Winner Match ${74 + index * 2}`, date: r16Dates[index], homeTeam: `Winner Match ${73 + index * 2}`, matchNumber: 89 + index, round: "Round of 16", stage: "round_of_16", time: timeSlots[(index + 1) % timeSlots.length], venueIndex: 8 + index });
  const qfDates = ["2026-07-09", "2026-07-10", "2026-07-11", "2026-07-11"];
  for (let index = 0; index < 4; index += 1) push({ awayTeam: `Winner Match ${90 + index * 2}`, date: qfDates[index], homeTeam: `Winner Match ${89 + index * 2}`, matchNumber: 97 + index, round: "Quarterfinal", stage: "quarterfinal", time: timeSlots[index % timeSlots.length], venueIndex: 12 + index });
  push({ awayTeam: "Winner Match 98", date: "2026-07-14", homeTeam: "Winner Match 97", matchNumber: 101, round: "Semifinal", stage: "semifinal", time: "22:00:00", venueIndex: 7 });
  push({ awayTeam: "Winner Match 100", date: "2026-07-15", homeTeam: "Winner Match 99", matchNumber: 102, round: "Semifinal", stage: "semifinal", time: "22:00:00", venueIndex: 5 });
  push({ awayTeam: "Loser Match 102", date: "2026-07-18", homeTeam: "Loser Match 101", matchNumber: 103, round: "Third place", stage: "third_place", time: "20:00:00", venueIndex: 11 });
  push({ awayTeam: "Winner Match 102", date: "2026-07-19", homeTeam: "Winner Match 101", matchNumber: 104, round: "Final", stage: "final", time: "19:00:00", venueIndex: 12 });
  return matches;
};

const buildWorldCup2026Dataset = () => {
  const matches = [...buildGroupStageMatches(), ...buildKnockoutMatches()];
  const teams = groups.flatMap((group) => group.teams.map((name, index) => ({ group: group.code, name, seed: index + 1 })));
  return { championship: CHAMPIONSHIP, groups, matches, providerName: PROVIDER_NAME, teams, tournamentName: TOURNAMENT_NAME };
};

module.exports = { buildWorldCup2026Dataset, CHAMPIONSHIP, PROVIDER_NAME, TOURNAMENT_NAME };
