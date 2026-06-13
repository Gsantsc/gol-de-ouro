const fs = require("fs");
const path = require("path");
const { buildWorldCup2026Dataset } = require("./world-cup-2026-dataset.cjs");

const rootDir = path.resolve(__dirname, "..");
const reportPath = path.join(rootDir, "AUTO_SYNC_VALIDATION_REPORT.md");

const assert = (condition, message, details = {}) => {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
};

const outcome = (home, away) => {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
};

const scorePrediction = (match, prediction) => {
  let points = 0;
  const officialOutcome = outcome(match.home_score, match.away_score);
  const predictedOutcome = prediction.predicted_winner ?? outcome(prediction.predicted_home_score, prediction.predicted_away_score);

  if (prediction.predicted_home_score === match.home_score && prediction.predicted_away_score === match.away_score) {
    points += 10;
  }
  if (predictedOutcome === officialOutcome) points += 5;
  if (
    prediction.predicted_home_score - prediction.predicted_away_score
    === match.home_score - match.away_score
  ) {
    points += 3;
  }

  return points;
};

const rankUsers = (predictions) =>
  predictions
    .reduce((rows, prediction) => {
      const current = rows.get(prediction.user_id) ?? { total_points: 0, user_id: prediction.user_id };
      current.total_points += prediction.points;
      rows.set(prediction.user_id, current);
      return rows;
    }, new Map())
    .values();

const buildMatches = () =>
  buildWorldCup2026Dataset().matches.map((match) => ({
    away_score: 0,
    away_team: match.awayTeam,
    home_score: 0,
    home_team: match.homeTeam,
    match_number: match.matchNumber,
    round: match.round,
    status: "fechado",
    stats: {
      group: match.group,
      match_number: match.matchNumber,
      stage: match.stage,
    },
  }));

const ensureStanding = (table, group, name) => {
  const key = `${group}:${name}`;
  if (!table.has(key)) {
    table.set(key, {
      drawn: 0,
      form: [],
      goal_difference: 0,
      goals_against: 0,
      goals_for: 0,
      group_code: group,
      lost: 0,
      played: 0,
      points: 0,
      position: 0,
      team_name: name,
      won: 0,
    });
  }
  return table.get(key);
};

const buildStandings = (matches) => {
  const table = new Map();

  for (const match of matches) {
    const group = match.stats.group;
    if (!group || match.status !== "encerrado") continue;
    const home = ensureStanding(table, group, match.home_team);
    const away = ensureStanding(table, group, match.away_team);
    const result = outcome(match.home_score, match.away_score);

    home.played += 1;
    away.played += 1;
    home.goals_for += match.home_score;
    home.goals_against += match.away_score;
    away.goals_for += match.away_score;
    away.goals_against += match.home_score;

    if (result === "home") {
      home.won += 1;
      home.points += 3;
      home.form.push("W");
      away.lost += 1;
      away.form.push("L");
    } else if (result === "away") {
      away.won += 1;
      away.points += 3;
      away.form.push("W");
      home.lost += 1;
      home.form.push("L");
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
      home.form.push("D");
      away.form.push("D");
    }
  }

  return [...table.values()]
    .map((team) => ({ ...team, goal_difference: team.goals_for - team.goals_against }))
    .sort((left, right) =>
      left.group_code.localeCompare(right.group_code)
      || right.points - left.points
      || right.goal_difference - left.goal_difference
      || right.goals_for - left.goals_for
      || left.team_name.localeCompare(right.team_name),
    )
    .map((team, index, ordered) => ({
      ...team,
      position: ordered.slice(0, index).filter((entry) => entry.group_code === team.group_code).length + 1,
    }));
};

const matchWinner = (match) => {
  if (match.home_score === match.away_score) return null;
  return match.home_score > match.away_score ? match.home_team : match.away_team;
};

const matchLoser = (match) => {
  if (match.home_score === match.away_score) return null;
  return match.home_score > match.away_score ? match.away_team : match.home_team;
};

const resolveGroupToken = (token, standings, usedThirdPlaceTeams) => {
  const winner = token.match(/^Winner Group ([A-L])$/i);
  if (winner) return standings.find((team) => team.group_code === winner[1] && team.position === 1 && team.played >= 3)?.team_name ?? null;

  const runner = token.match(/^Runner-up Group ([A-L])$/i);
  if (runner) return standings.find((team) => team.group_code === runner[1] && team.position === 2 && team.played >= 3)?.team_name ?? null;

  const third = token.match(/^Third Place Group ([A-L/]+)$/i);
  if (!third) return null;

  const allowed = new Set(third[1].split("/"));
  const selected = standings
    .filter((team) => team.position === 3 && team.played >= 3)
    .sort((left, right) =>
      right.points - left.points
      || right.goal_difference - left.goal_difference
      || right.goals_for - left.goals_for
      || left.team_name.localeCompare(right.team_name),
    )
    .find((team) => allowed.has(team.group_code) && !usedThirdPlaceTeams.has(team.team_name));

  if (!selected) return null;
  usedThirdPlaceTeams.add(selected.team_name);
  return selected.team_name;
};

const resolveToken = (token, matchesByNumber, standings, usedThirdPlaceTeams) => {
  const groupTeam = resolveGroupToken(token, standings, usedThirdPlaceTeams);
  if (groupTeam) return groupTeam;

  const winner = token.match(/^Winner Match (\d+)$/i);
  if (winner) {
    const source = matchesByNumber.get(Number(winner[1]));
    return source ? matchWinner(source) : null;
  }

  const loser = token.match(/^Loser Match (\d+)$/i);
  if (loser) {
    const source = matchesByNumber.get(Number(loser[1]));
    return source ? matchLoser(source) : null;
  }

  return null;
};

const updateKnockout = (matches, standings) => {
  const matchesByNumber = new Map(matches.map((match) => [match.match_number, match]));
  const usedThirdPlaceTeams = new Set();
  let updated = 0;

  for (const match of [...matches].sort((left, right) => left.match_number - right.match_number)) {
    const home = resolveToken(match.home_team, matchesByNumber, standings, usedThirdPlaceTeams) ?? match.home_team;
    const away = resolveToken(match.away_team, matchesByNumber, standings, usedThirdPlaceTeams) ?? match.away_team;
    if (home === match.home_team && away === match.away_team) continue;
    match.home_team = home;
    match.away_team = away;
    updated += 1;
  }

  return updated;
};

const finish = (match, homeScore, awayScore) => {
  match.home_score = homeScore;
  match.away_score = awayScore;
  match.status = "encerrado";
};

const runCase1 = () => {
  const match = { away_score: 1, away_team: "Canada", home_score: 2, home_team: "Brazil", status: "encerrado" };
  const predictions = [
    { predicted_away_score: 1, predicted_home_score: 2, user_id: "usuario-a" },
    { predicted_away_score: 0, predicted_home_score: 1, user_id: "usuario-b" },
    { predicted_away_score: 0, predicted_home_score: 1, user_id: "usuario-c", predicted_winner: "away" },
  ].map((prediction) => ({ ...prediction, points: scorePrediction(match, prediction) }));
  const firstRun = predictions.map((prediction) => prediction.points).join(",");
  predictions.forEach((prediction) => {
    prediction.points = scorePrediction(match, prediction);
  });
  const secondRun = predictions.map((prediction) => prediction.points).join(",");
  const ranking = [...rankUsers(predictions)].sort((left, right) => right.total_points - left.total_points);

  assert(match.status === "encerrado", "Caso 1: partida nao encerrou.", match);
  assert(predictions.every((prediction) => prediction.points >= 0), "Caso 1: pontos nao preenchidos.", predictions);
  assert(ranking[0].user_id === "usuario-a", "Caso 1: usuario A deveria liderar.", ranking);
  assert(firstRun === secondRun, "Caso 1: pontuacao duplicou na segunda execucao.", { firstRun, secondRun });

  return { points: predictions, ranking };
};

const runCase2 = () => {
  const matches = buildMatches();
  const groupA = matches.filter((match) => match.stats.group === "A");
  const scores = [[2, 0], [1, 1], [0, 2], [1, 0], [0, 1], [1, 1]];
  groupA.forEach((match, index) => finish(match, scores[index][0], scores[index][1]));
  const standings = buildStandings(matches);
  const updated = updateKnockout(matches, standings);
  const groupAStandings = standings.filter((team) => team.group_code === "A");
  const first = groupAStandings.find((team) => team.position === 1);
  const second = groupAStandings.find((team) => team.position === 2);

  assert(groupAStandings.every((team) => team.played === 3), "Caso 2: played incorreto no Grupo A.", groupAStandings);
  assert(groupAStandings.every((team) => team.goal_difference === team.goals_for - team.goals_against), "Caso 2: saldo incorreto.", groupAStandings);
  assert(first?.team_name === "Mexico", "Caso 2: lider do Grupo A incorreto.", groupAStandings);
  assert(second?.team_name === "Korea Republic", "Caso 2: segundo do Grupo A incorreto.", groupAStandings);
  assert(matches.find((match) => match.match_number === 79)?.home_team === "Mexico", "Caso 2: Winner Group A nao foi aplicado.", matches.find((match) => match.match_number === 79));
  assert(matches.find((match) => match.match_number === 73)?.home_team === "Korea Republic", "Caso 2: Runner-up Group A nao foi aplicado.", matches.find((match) => match.match_number === 73));

  return { groupAStandings, knockoutUpdated: updated };
};

const runCase3 = () => {
  const matches = buildMatches().filter((match) => match.match_number >= 89 && match.match_number <= 100);
  matches.filter((match) => match.match_number >= 89 && match.match_number <= 96).forEach((match, index) => {
    match.home_team = `R16 Home ${index + 1}`;
    match.away_team = `R16 Away ${index + 1}`;
    finish(match, 2 + index, 1);
  });
  const updated = updateKnockout(matches, []);

  assert(matches.find((match) => match.match_number === 97)?.home_team === "R16 Home 1", "Caso 3: quartas home 97 incorreto.");
  assert(matches.find((match) => match.match_number === 97)?.away_team === "R16 Home 2", "Caso 3: quartas away 97 incorreto.");
  assert(updated === 4, "Caso 3: quartas deveriam atualizar 4 jogos.", { updated });

  return { knockoutUpdated: updated, quarterfinals: matches.filter((match) => match.match_number >= 97) };
};

const runCase4 = () => {
  const matches = buildMatches().filter((match) => match.match_number >= 97 && match.match_number <= 102);
  matches.filter((match) => match.match_number >= 97 && match.match_number <= 100).forEach((match, index) => {
    match.home_team = `QF Home ${index + 1}`;
    match.away_team = `QF Away ${index + 1}`;
    finish(match, 3, index % 2);
  });
  const updated = updateKnockout(matches, []);

  assert(matches.find((match) => match.match_number === 101)?.home_team === "QF Home 1", "Caso 4: semifinal 101 home incorreto.");
  assert(matches.find((match) => match.match_number === 101)?.away_team === "QF Home 2", "Caso 4: semifinal 101 away incorreto.");
  assert(matches.find((match) => match.match_number === 102)?.home_team === "QF Home 3", "Caso 4: semifinal 102 home incorreto.");
  assert(updated === 2, "Caso 4: semifinais deveriam atualizar 2 jogos.", { updated });

  return { knockoutUpdated: updated, semifinals: matches.filter((match) => match.match_number >= 101) };
};

const runCase5 = () => {
  const matches = buildMatches().filter((match) => match.match_number >= 101 && match.match_number <= 104);
  const semi101 = matches.find((match) => match.match_number === 101);
  const semi102 = matches.find((match) => match.match_number === 102);
  semi101.home_team = "Brazil";
  semi101.away_team = "Argentina";
  semi102.home_team = "France";
  semi102.away_team = "Germany";
  finish(semi101, 2, 1);
  finish(semi102, 0, 1);
  const updated = updateKnockout(matches, []);

  assert(matches.find((match) => match.match_number === 104)?.home_team === "Brazil", "Caso 5: final home incorreto.");
  assert(matches.find((match) => match.match_number === 104)?.away_team === "Germany", "Caso 5: final away incorreto.");
  assert(matches.find((match) => match.match_number === 103)?.home_team === "Argentina", "Caso 5: terceiro lugar home incorreto.");
  assert(matches.find((match) => match.match_number === 103)?.away_team === "France", "Caso 5: terceiro lugar away incorreto.");
  assert(updated === 2, "Caso 5: final e terceiro lugar deveriam atualizar 2 jogos.", { updated });

  return { final: matches.find((match) => match.match_number === 104), knockoutUpdated: updated, thirdPlace: matches.find((match) => match.match_number === 103) };
};

const cases = [
  ["Caso 1 - Brasil 2 x 1 Canada", runCase1],
  ["Caso 2 - Grupo A finalizado", runCase2],
  ["Caso 3 - Oitavas finalizadas", runCase3],
  ["Caso 4 - Quartas finalizadas", runCase4],
  ["Caso 5 - Semi finalizada", runCase5],
];

const results = cases.map(([name, run]) => {
  try {
    return { name, ok: true, result: run() };
  } catch (error) {
    return {
      details: error.details,
      error: error.message,
      name,
      ok: false,
    };
  }
});

const approved = results.every((result) => result.ok);
const report = [
  "# Auto Sync Validation Report",
  "",
  `Status final: ${approved ? "aprovado" : "reprovado"}`,
  "",
  ...results.flatMap((result) => [
    `## ${result.name}`,
    "",
    `Resultado: ${result.ok ? "aprovado" : "reprovado"}`,
    "",
    "```json",
    JSON.stringify(result.ok ? result.result : { error: result.error, details: result.details }, null, 2),
    "```",
    "",
  ]),
  "## Pendencias encontradas",
  "",
  approved ? "- Nenhuma pendencia encontrada nas simulacoes offline." : "- Corrigir casos reprovados antes de liberar o beta.",
  "",
].join("\n");

fs.writeFileSync(reportPath, report, "utf8");
console.log(JSON.stringify({ approved, reportPath, results: results.map(({ name, ok }) => ({ name, ok })) }, null, 2));
