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

export const normalizeTeamNameWithAliases = (value: string): string => {
  const normalized = normalizeTeamName(value);
  return teamAliases[normalized] ?? normalized;
};

export const getTeamDisplayName = (teamName?: string | null, locale = "pt-BR") => {
  if (!teamName) return "";
  if (locale !== "pt-BR") return teamName;
  return teamDisplayNamesPtBr[normalizeTeamName(teamName)] ?? teamName;
};

export const formatMatchupDisplayName = (homeTeam?: string | null, awayTeam?: string | null, locale = "pt-BR") =>
  `${getTeamDisplayName(homeTeam, locale)} x ${getTeamDisplayName(awayTeam, locale)}`;
