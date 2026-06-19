const teamDisplayNamesPtBr: Record<string, string> = {
  algeria: "Argélia",
  argentina: "Argentina",
  australia: "Australia",
  austria: "Austria",
  belgium: "Bélgica",
  "bosnia-herzegovina": "Bósnia e Herzegovina",
  brazil: "Brasil",
  canada: "Canada",
  "cabo verde": "Cabo Verde",
  "cote d'ivoire": "Costa do Marfim",
  curacao: "Curaçao",
  czechia: "Tchequia",
  ecuador: "Equador",
  egypt: "Egito",
  france: "França",
  germany: "Alemanha",
  ghana: "Gana",
  haiti: "Haiti",
  "ir iran": "Irã",
  iraq: "Iraque",
  japan: "Japao",
  jordan: "Jordânia",
  "korea republic": "Coreia do Sul",
  mexico: "México",
  morocco: "Marrocos",
  netherlands: "Países Baixos",
  "new zealand": "Nova Zelandia",
  norway: "Noruega",
  paraguay: "Paraguai",
  qatar: "Catar",
  "saudi arabia": "Arábia Saudita",
  scotland: "Escócia",
  senegal: "Senegal",
  "south africa": "África do Sul",
  spain: "Espanha",
  sweden: "Suécia",
  switzerland: "Suíça",
  tunisia: "Tunísia",
  turkey: "Turquia",
  uruguay: "Uruguai",
  usa: "Estados Unidos"
};

const normalizeTeamName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const getTeamDisplayName = (teamName?: string | null, locale = "pt-BR") => {
  if (!teamName) return "";
  if (locale !== "pt-BR") return teamName;
  return teamDisplayNamesPtBr[normalizeTeamName(teamName)] ?? teamName;
};

export const formatMatchupDisplayName = (homeTeam?: string | null, awayTeam?: string | null, locale = "pt-BR") =>
  `${getTeamDisplayName(homeTeam, locale)} x ${getTeamDisplayName(awayTeam, locale)}`;
