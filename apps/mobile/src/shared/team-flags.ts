import { isKnockoutPlaceholder } from "./team-display";

// Team aliases and flag resolution for World Cup 2026 (48 teams)
// Provides centralized team name normalization and flag URL resolution with fallback chain

/**
 * Normalizes team name by removing accents and converting to lowercase
 */
export const normalizeTeamName = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/**
 * Team aliases mapping - maps various name variations to canonical names
 * Used for both display and flag resolution
 */
export const TEAM_ALIASES: Record<string, string> = {
  // English variations
  "united states": "USA",
  "us": "USA",
  "usa": "USA",
  "usmnt": "USA",
  "united states of america": "USA",
  
  "united kingdom": "England",
  "uk": "England",
  "eng": "England",
  
  "south korea": "South Korea",
  "korea republic": "South Korea",
  "korea": "South Korea",
  
  "czech republic": "Czechia",
  "czech": "Czechia",
  
  "ivory coast": "Côte d'Ivoire",
  "cote d'ivoire": "Côte d'Ivoire",
  
  "bosnia and herzegovina": "Bosnia and Herzegovina",
  "bosnia-herzegovina": "Bosnia and Herzegovina",
  
  "cape verde": "Cabo Verde",
  "cabo verde": "Cabo Verde",
  
  "new zealand": "New Zealand",
  "nz": "New Zealand",
  
  "saudi arabia": "Saudi Arabia",
  "saudi": "Saudi Arabia",
  
  "costa rica": "Costa Rica",
  
  "uruguay": "Uruguay",
  
  "ecuador": "Ecuador",
  
  "paraguay": "Paraguay",
  
  "bolivia": "Bolivia",
  
  "peru": "Peru",
  
  "venezuela": "Venezuela",
  
  "colombia": "Colombia",
  
  "chile": "Chile",
  
  "argentina": "Argentina",
  
  "brazil": "Brazil",
  "brasil": "Brazil",
  
  "germany": "Germany",
  "deutschland": "Germany",
  
  "france": "France",
  
  "spain": "Spain",
  "españa": "Spain",
  
  "italy": "Italy",
  "italia": "Italy",
  
  "netherlands": "Netherlands",
  "holland": "Netherlands",
  
  "belgium": "Belgium",
  
  "portugal": "Portugal",
  
  "switzerland": "Switzerland",
  
  "austria": "Austria",
  
  "denmark": "Denmark",
  
  "sweden": "Sweden",
  
  "norway": "Norway",
  
  "finland": "Finland",
  
  "poland": "Poland",
  
  "croatia": "Croatia",
  
  "serbia": "Serbia",
  
  "greece": "Greece",
  
  "turkey": "Turkey",
  
  "russia": "Russia",
  
  "ukraine": "Ukraine",
  
  "romania": "Romania",
  
  "hungary": "Hungary",
  
  "ireland": "Ireland",
  
  "scotland": "Scotland",
  
  "wales": "Wales",
  
  "northern ireland": "Northern Ireland",
  
  "mexico": "Mexico",
  
  "canada": "Canada",
  
  "japan": "Japan",
  
  "china": "China",
  
  "australia": "Australia",
  
  "morocco": "Morocco",
  
  "egypt": "Egypt",
  
  "tunisia": "Tunisia",
  
  "algeria": "Algeria",
  
  "senegal": "Senegal",
  
  "ghana": "Ghana",
  
  "nigeria": "Nigeria",
  
  "cameroon": "Cameroon",
  
  "south africa": "South Africa",
  
  "iran": "Iran",
  "ir iran": "Iran",
  
  "iraq": "Iraq",
  
  "jordan": "Jordan",
  
  "qatar": "Qatar",
  
  "united arab emirates": "United Arab Emirates",
  "uae": "United Arab Emirates",
  
  "oman": "Oman",
  
  "haiti": "Haiti",
  
  "jamaica": "Jamaica",
  
  "panama": "Panama",
  
  "curacao": "Curaçao",
  "curaçao": "Curaçao",
  
  "trinidad and tobago": "Trinidad and Tobago",
  
  "indonesia": "Indonesia",
  
  "malaysia": "Malaysia",
  
  "thailand": "Thailand",
  
  "vietnam": "Vietnam",
  
  "philippines": "Philippines",
  
  // Portuguese variations
  "estados unidos": "USA",
  "eua": "USA",
  "estados unidos da america": "USA",
  
  "reino unido": "England",
  
  "coreia do sul": "South Korea",
  
  "republica tcheca": "Czechia",
  
  "costa do marfim": "Côte d'Ivoire",
  
  "bosnia e herzegovina": "Bosnia and Herzegovina",
  
  "nova zelandia": "New Zealand",
  
  "arabia saudita": "Saudi Arabia",
  
  "alemanha": "Germany",
  
  "espanha": "Spain",
  
  "holanda": "Netherlands",
  
  "suica": "Switzerland",
  
  "dinamarca": "Denmark",
  
  "suecia": "Sweden",
  
  "noruega": "Norway",
  
  "finlandia": "Finland",
  
  "polonia": "Poland",
  
  "croacia": "Croatia",
  
  "servia": "Serbia",
  
  "grecia": "Greece",
  
  "turquia": "Turkey",
  
  "ucrania": "Ukraine",
  
  "romenia": "Romania",
  
  "hungria": "Hungary",
  
  "irlanda": "Ireland",
  
  "escocia": "Scotland",
  
  "gales": "Wales",
  
  "irlanda do norte": "Northern Ireland",
  
  "marrocos": "Morocco",
  
  "egito": "Egypt",
  
  "argelia": "Algeria",
  
  "gana": "Ghana",
  
  "camaroes": "Cameroon",
  
  "africa do sul": "South Africa",
  
  "ira": "Iran",
  
  "iraque": "Iraq",
  
  "jordania": "Jordan",
  
  "cata": "Qatar",
  
  "emirados arabes unidos": "United Arab Emirates",
  
  "trindade e tobago": "Trinidad and Tobago",
  
  "malasia": "Malaysia",
  
  "tailandia": "Thailand",
  
  "vietna": "Vietnam",
  
  "filipinas": "Philippines",

  "congo dr": "DR Congo",
  "dr congo": "DR Congo",
  "democratic republic of the congo": "DR Congo",
  "uzbekistan": "Uzbekistan",
  "turkiye": "Turkey",
};

/**
 * ISO country codes for flagcdn.com and other flag sources
 * Maps canonical team names to ISO 3166-1 alpha-2 codes
 */
export const TEAM_ISO_CODES: Record<string, string> = {
  "USA": "us",
  "England": "gb-eng",
  "South Korea": "kr",
  "Czechia": "cz",
  "Côte d'Ivoire": "ci",
  "Bosnia and Herzegovina": "ba",
  "Cabo Verde": "cv",
  "New Zealand": "nz",
  "Saudi Arabia": "sa",
  "Costa Rica": "cr",
  "Uruguay": "uy",
  "Ecuador": "ec",
  "Paraguay": "py",
  "Bolivia": "bo",
  "Peru": "pe",
  "Venezuela": "ve",
  "Colombia": "co",
  "Chile": "cl",
  "Argentina": "ar",
  "Brazil": "br",
  "Germany": "de",
  "France": "fr",
  "Spain": "es",
  "Italy": "it",
  "Netherlands": "nl",
  "Belgium": "be",
  "Portugal": "pt",
  "Switzerland": "ch",
  "Austria": "at",
  "Denmark": "dk",
  "Sweden": "se",
  "Norway": "no",
  "Finland": "fi",
  "Poland": "pl",
  "Croatia": "hr",
  "Serbia": "rs",
  "Greece": "gr",
  "Turkey": "tr",
  "Ukraine": "ua",
  "Romania": "ro",
  "Hungary": "hu",
  "Ireland": "ie",
  "Scotland": "gb-sct",
  "Wales": "gb-wls",
  "Northern Ireland": "gb-nir",
  "Mexico": "mx",
  "Canada": "ca",
  "Japan": "jp",
  "China": "cn",
  "Australia": "au",
  "Morocco": "ma",
  "Egypt": "eg",
  "Tunisia": "tn",
  "Algeria": "dz",
  "Senegal": "sn",
  "Ghana": "gh",
  "Nigeria": "ng",
  "Cameroon": "cm",
  "South Africa": "za",
  "Iran": "ir",
  "Iraq": "iq",
  "Jordan": "jo",
  "Qatar": "qa",
  "United Arab Emirates": "ae",
  "Oman": "om",
  "Haiti": "ht",
  "Jamaica": "jm",
  "Panama": "pa",
  "Curaçao": "cw",
  "Trinidad and Tobago": "tt",
  "Indonesia": "id",
  "Malaysia": "my",
  "Thailand": "th",
  "Vietnam": "vn",
  "Philippines": "ph",
  "DR Congo": "cd",
  "Uzbekistan": "uz",
};

/**
 * FIFA 3-letter country codes for FIFA flag source
 */
export const TEAM_FIFA_CODES: Record<string, string> = {
  "USA": "USA",
  "England": "ENG",
  "South Korea": "KOR",
  "Czechia": "CZE",
  "Côte d'Ivoire": "CIV",
  "Bosnia and Herzegovina": "BIH",
  "Cabo Verde": "CPV",
  "New Zealand": "NZL",
  "Saudi Arabia": "KSA",
  "Costa Rica": "CRC",
  "Uruguay": "URU",
  "Ecuador": "ECU",
  "Paraguay": "PAR",
  "Bolivia": "BOL",
  "Peru": "PER",
  "Venezuela": "VEN",
  "Colombia": "COL",
  "Chile": "CHI",
  "Argentina": "ARG",
  "Brazil": "BRA",
  "Germany": "GER",
  "France": "FRA",
  "Spain": "ESP",
  "Italy": "ITA",
  "Netherlands": "NED",
  "Belgium": "BEL",
  "Portugal": "POR",
  "Switzerland": "SUI",
  "Austria": "AUT",
  "Denmark": "DEN",
  "Sweden": "SWE",
  "Norway": "NOR",
  "Finland": "FIN",
  "Poland": "POL",
  "Croatia": "CRO",
  "Serbia": "SRB",
  "Greece": "GRE",
  "Turkey": "TUR",
  "Ukraine": "UKR",
  "Romania": "ROU",
  "Hungary": "HUN",
  "Ireland": "IRL",
  "Scotland": "SCO",
  "Wales": "WAL",
  "Northern Ireland": "NIR",
  "Mexico": "MEX",
  "Canada": "CAN",
  "Japan": "JPN",
  "China": "CHN",
  "Australia": "AUS",
  "Morocco": "MAR",
  "Egypt": "EGY",
  "Tunisia": "TUN",
  "Algeria": "ALG",
  "Senegal": "SEN",
  "Ghana": "GHA",
  "Nigeria": "NGA",
  "Cameroon": "CMR",
  "South Africa": "RSA",
  "Iran": "IRN",
  "Iraq": "IRQ",
  "Jordan": "JOR",
  "Qatar": "QAT",
  "United Arab Emirates": "UAE",
  "Oman": "OMN",
  "Haiti": "HAI",
  "Jamaica": "JAM",
  "Panama": "PAN",
  "Curaçao": "CUW",
  "Trinidad and Tobago": "TTO",
  "Indonesia": "IDN",
  "Malaysia": "MAS",
  "Thailand": "THA",
  "Vietnam": "VIE",
  "Philippines": "PHI",
  "DR Congo": "COD",
  "Uzbekistan": "UZB",
};

/**
 * Resolves team name to canonical name using aliases
 */
export const resolveTeamName = (name: string): string => {
  const normalized = normalizeTeamName(name);
  return TEAM_ALIASES[normalized] || name;
};

/**
 * Gets flag URL from flagcdn.com (PNG)
 * Fallback source in the chain
 */
export const getFlagCdnUrl = (teamName: string): string | null => {
  const canonical = resolveTeamName(teamName);
  const isoCode = TEAM_ISO_CODES[canonical];
  return isoCode ? `https://flagcdn.com/w80/${isoCode}.png` : null;
};

/**
 * Gets flag URL from flagcdn.com (SVG)
 * Primary source in the chain
 */
export const getFlagCdnSvgUrl = (teamName: string): string | null => {
  const canonical = resolveTeamName(teamName);
  const isoCode = TEAM_ISO_CODES[canonical];
  return isoCode ? `https://flagcdn.com/w80/${isoCode}.svg` : null;
};

/**
 * Gets flag URL from FIFA (PNG)
 * Secondary fallback source
 */
export const getFifaFlagUrl = (teamName: string): string | null => {
  const canonical = resolveTeamName(teamName);
  const fifaCode = TEAM_FIFA_CODES[canonical];
  return fifaCode ? `https://digitalhub.fifa.com/transform/${fifaCode}.png` : null;
};

/**
 * Resolves flag URL with fallback chain:
 * 1. PNG from flagcdn.com (primary, best RN/PWA support)
 * 2. SVG from flagcdn.com
 * 3. FIFA flag
 * 4. null (use placeholder)
 */
export const resolveFlagUrl = (teamName: string): string | null =>
  getFlagUrlCandidates(teamName)[0] ?? null;

export const isPlaceholderTeam = (teamName: string) =>
  isKnockoutPlaceholder(teamName)
  || /^(TBD|Winner |Loser |Runner-up |Third Place |Group |Quarterfinal|Round of|Semifinal)/i.test(teamName.trim());

export const getFlagUrlCandidates = (teamName: string, logoUrl?: string | null): string[] => {
  const urls: string[] = [];
  const trimmedLogo = logoUrl?.trim();

  if (trimmedLogo) urls.push(trimmedLogo);
  if (isPlaceholderTeam(teamName)) return urls;

  const png = getFlagCdnUrl(teamName);
  const svg = getFlagCdnSvgUrl(teamName);
  const fifa = getFifaFlagUrl(teamName);

  if (png) urls.push(png);
  if (svg) urls.push(svg);
  if (fifa) urls.push(fifa);

  return [...new Set(urls)];
};

export const resolveFlagUrlForTeam = (teamName: string, logoUrl?: string | null): string | null =>
  getFlagUrlCandidates(teamName, logoUrl)[0] ?? null;

export const enrichMatchFlagUrls = <
  T extends {
    home_team: string;
    away_team: string;
    home_team_logo_url?: string | null;
    away_team_logo_url?: string | null;
  }
>(match: T): T => ({
  ...match,
  home_team_logo_url: resolveFlagUrlForTeam(match.home_team, match.home_team_logo_url),
  away_team_logo_url: resolveFlagUrlForTeam(match.away_team, match.away_team_logo_url)
});

/**
 * Gets team initials for placeholder
 */
export const getTeamInitials = (name: string): string => {
  const canonical = resolveTeamName(name);
  return canonical
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
    || "??";
};
