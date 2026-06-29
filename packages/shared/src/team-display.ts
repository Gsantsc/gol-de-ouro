const teamDisplayNamesPtBr: Record<string, string> = {
  algeria: "Argelia",
  argentina: "Argentina",
  australia: "Australia",
  austria: "Austria",
  belgium: "Belgica",
  "bosnia-herzegovina": "Bosnia e Herzegovina",
  brazil: "Brasil",
  canada: "Canada",
  "cabo verde": "Cabo Verde",
  "cape verde": "Cabo Verde",
  "cote d'ivoire": "Costa do Marfim",
  curacao: "Curacao",
  "curaçao": "Curacao",
  czechia: "Tchequia",
  ecuador: "Equador",
  egypt: "Egito",
  france: "Franca",
  germany: "Alemanha",
  ghana: "Gana",
  haiti: "Haiti",
  iran: "Ira",
  "ir iran": "Ira",
  iraq: "Iraque",
  "ivory coast": "Costa do Marfim",
  japan: "Japao",
  jordan: "Jordania",
  "korea republic": "Coreia do Sul",
  "south korea": "Coreia do Sul",
  mexico: "Mexico",
  morocco: "Marrocos",
  netherlands: "Paises Baixos",
  "new zealand": "Nova Zelandia",
  norway: "Noruega",
  paraguay: "Paraguai",
  qatar: "Catar",
  "saudi arabia": "Arabia Saudita",
  scotland: "Escocia",
  senegal: "Senegal",
  "south africa": "Africa do Sul",
  spain: "Espanha",
  sweden: "Suecia",
  switzerland: "Suica",
  tunisia: "Tunisia",
  turkey: "Turquia",
  turkiye: "Turquia",
  "türkiye": "Turquia",
  uruguay: "Uruguai",
  usa: "Estados Unidos",
  "united states": "Estados Unidos",
};

const teamAliases: Record<string, string> = {
  "brasil": "brazil",
  "brazil": "brazil",
  "estados unidos": "united states",
  "united states": "united states",
  "usa": "united states",
  "usmnt": "united states",
  "países baixos": "netherlands",
  "netherlands": "netherlands",
  "holanda": "netherlands",
  "japão": "japan",
  "japan": "japan",
  "espanha": "spain",
  "spain": "spain",
  "arábia saudita": "saudi arabia",
  "saudi arabia": "saudi arabia",
  "bélgica": "belgium",
  "belgium": "belgium",
  "irã": "iran",
  "iran": "iran",
  "frança": "france",
  "france": "france",
  "iraque": "iraq",
  "iraq": "iraq",
  "portugal": "portugal",
  "uzbequistão": "uzbekistan",
  "uzbekistan": "uzbekistan",
  "austrália": "australia",
  "australia": "australia",
  "tunísia": "tunisia",
  "tunisia": "tunisia",
  "suécia": "sweden",
  "sweden": "sweden",
};

const normalizeTeamName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export type KnockoutPlaceholderInfo =
  | { kind: "group"; group: string; rank: 1 | 2 | 3; raw: string }
  | { kind: "match"; matchNumber: number; raw: string; result: "winner" | "loser" }
  | { kind: "generic"; label: string | null; raw: string };

const cleanPlaceholderValue = (value?: string | null) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");

export const parseKnockoutPlaceholder = (value?: string | null): KnockoutPlaceholderInfo | null => {
  const raw = cleanPlaceholderValue(value);
  if (!raw) return null;

  const winnerGroup = raw.match(/^Winner Group ([A-L])$/i)
    ?? raw.match(/^Group ([A-L]) Winner$/i)
    ?? raw.match(/^(?:1st|1\u00ba|1o|First) Group ([A-L])$/i)
    ?? raw.match(/^Vencedor Grupo ([A-L])$/i);
  if (winnerGroup) return { group: winnerGroup[1].toUpperCase(), kind: "group", rank: 1, raw };

  const runnerGroup = raw.match(/^Runner-up Group ([A-L])$/i)
    ?? raw.match(/^Group ([A-L]) Runner-up$/i)
    ?? raw.match(/^Group ([A-L]) 2nd Place$/i)
    ?? raw.match(/^(?:2nd|2\u00ba|2o|Second) Group ([A-L])$/i)
    ?? raw.match(/^Segundo Grupo ([A-L])$/i)
    ?? raw.match(/^2(?:o|\u00ba) Grupo ([A-L])$/i);
  if (runnerGroup) return { group: runnerGroup[1].toUpperCase(), kind: "group", rank: 2, raw };

  const thirdGroup = raw.match(/^Third Place Group ([A-L](?:\/[A-L])*)$/i)
    ?? raw.match(/^Group ([A-L](?:\/[A-L])*) 3rd Place$/i)
    ?? raw.match(/^(?:3rd|3\u00ba|3o|Third) Group ([A-L](?:\/[A-L])*)$/i);
  if (thirdGroup) return { group: thirdGroup[1].toUpperCase(), kind: "group", rank: 3, raw };

  const winnerMatch = raw.match(/^Winner Match (\d+)$/i)
    ?? raw.match(/^Vencedor Jogo (\d+)$/i)
    ?? raw.match(/^W\s*(\d+)$/i);
  if (winnerMatch) return { kind: "match", matchNumber: Number(winnerMatch[1]), raw, result: "winner" };

  const loserMatch = raw.match(/^Loser Match (\d+)$/i)
    ?? raw.match(/^Perdedor Jogo (\d+)$/i)
    ?? raw.match(/^L\s*(\d+)$/i);
  if (loserMatch) return { kind: "match", matchNumber: Number(loserMatch[1]), raw, result: "loser" };

  if (/^(TBD|To be determined|A definir)$/i.test(raw)) return { kind: "generic", label: null, raw };
  if (/^(Round of 32|Round of 16|Quarterfinal|Semifinal|Final)\s+\d+\s+(Winner|Loser)$/i.test(raw)) {
    return { kind: "generic", label: raw.replace(/\s+/g, " "), raw };
  }
  if (/^(Best )?Third[- ]Place/i.test(raw)) return { kind: "generic", label: "3o colocado", raw };

  return null;
};

export const isKnockoutPlaceholder = (value?: string | null) =>
  parseKnockoutPlaceholder(value) !== null;

export const normalizeBracketPhase = (round?: string | null, stage?: string | null, matchNumber?: number | null): string | null => {
  if (!round && !stage && matchNumber === undefined) return null;

  const normalizedRound = round?.toLowerCase().trim() ?? "";
  const normalizedStage = stage?.toLowerCase().trim() ?? "";

  // Try to parse from round/stage strings first
  if (/round of 32|1\/16|segundas|round of 32/i.test(normalizedRound) || /round of 32|1\/16|segundas/i.test(normalizedStage)) {
    return "round_of_32";
  }
  if (/round of 16|oitavas|1\/8/i.test(normalizedRound) || /round of 16|oitavas/i.test(normalizedStage)) {
    return "round_of_16";
  }
  if (/quarterfinal|quartas|quarter/i.test(normalizedRound) || /quarterfinal|quartas/i.test(normalizedStage)) {
    return "quarter_final";
  }
  if (/semifinal|semi/i.test(normalizedRound) || /semifinal|semi/i.test(normalizedStage)) {
    return "semi_final";
  }
  if (/third.?place|disputa.*3|3.*lugar/i.test(normalizedRound) || /third.?place/i.test(normalizedStage)) {
    return "third_place";
  }
  if (/final/i.test(normalizedRound) || /final/i.test(normalizedStage)) {
    return "final";
  }
  if (/group stage|group/i.test(normalizedRound) || /group stage/i.test(normalizedStage)) {
    return "group_stage";
  }

  // Fallback to match number ranges
  if (matchNumber !== undefined && matchNumber !== null) {
    if (matchNumber >= 73 && matchNumber <= 88) return "round_of_32";
    if (matchNumber >= 89 && matchNumber <= 96) return "round_of_16";
    if (matchNumber >= 97 && matchNumber <= 100) return "quarter_final";
    if (matchNumber === 101 || matchNumber === 102) return "semi_final";
    if (matchNumber === 103) return "third_place";
    if (matchNumber === 104) return "final";
  }

  return null;
};

export const formatTeamDisplayName = (teamName?: string | null, locale = "pt-BR") => {
  if (!teamName?.trim()) return "A definir";
  if (isKnockoutPlaceholder(teamName)) return "A definir";
  return getTeamDisplayName(teamName, locale);
};

export const getSeedLabel = (teamName?: string | null) => {
  const parsed = parseKnockoutPlaceholder(teamName);
  if (!parsed) return null;
  if (parsed.kind === "group") {
    if (parsed.rank === 1) return `1o Grupo ${parsed.group}`;
    if (parsed.rank === 2) return `2o Grupo ${parsed.group}`;
    return `3o Grupo ${parsed.group}`;
  }
  if (parsed.kind === "match") {
    return parsed.result === "winner"
      ? `Vencedor J${parsed.matchNumber}`
      : `Perdedor J${parsed.matchNumber}`;
  }
  return parsed.label;
};

export const getPlaceholderSeedLabel = getSeedLabel;

export const hasUndefinedParticipant = (match?: { home_team?: string | null; away_team?: string | null } | null) =>
  !match
  || !match.home_team?.trim()
  || !match.away_team?.trim()
  || isKnockoutPlaceholder(match.home_team)
  || isKnockoutPlaceholder(match.away_team);

export const normalizeTeamNameWithAliases = (value: string): string => {
  const normalized = normalizeTeamName(value);
  return teamAliases[normalized] ?? normalized;
};

export const getTeamDisplayName = (teamName?: string | null, locale = "pt-BR") => {
  if (!teamName) return "";
  if (isKnockoutPlaceholder(teamName)) return "A definir";
  if (locale !== "pt-BR") return teamName;
  return teamDisplayNamesPtBr[normalizeTeamName(teamName)] ?? teamName;
};

export const formatMatchupDisplayName = (homeTeam?: string | null, awayTeam?: string | null, locale = "pt-BR") =>
  `${formatTeamDisplayName(homeTeam, locale)} x ${formatTeamDisplayName(awayTeam, locale)}`;

export const isPlayerEligibleForMatch = (player: { team_code?: string; team_name: string }, match: { home_team: string; away_team: string }): boolean => {
  const playerTeamNormalized = normalizeTeamNameWithAliases(player.team_name);
  const homeTeamNormalized = normalizeTeamName(match.home_team);
  const awayTeamNormalized = normalizeTeamName(match.away_team);

  // Check by team_code first (more reliable)
  if (player.team_code) {
    const playerCodeNormalized = normalizeTeamName(player.team_code);
    const homeCodeNormalized = normalizeTeamName(match.home_team);
    const awayCodeNormalized = normalizeTeamName(match.away_team);

    if (playerCodeNormalized === homeCodeNormalized || playerCodeNormalized === awayCodeNormalized) {
      return true;
    }
  }

  // Fallback to team_name comparison
  return playerTeamNormalized === homeTeamNormalized || playerTeamNormalized === awayTeamNormalized;
};
