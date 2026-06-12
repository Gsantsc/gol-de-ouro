import type { MatchStatus } from "../types";

// ESPN PROVIDER
export type EspnEventStatus = "scheduled" | "in" | "final" | "postponed" | "unknown";

export type EspnTeam = {
  abbreviation?: string | null;
  displayName: string;
  id?: string | null;
  logo?: string | null;
  score: number;
};

export type EspnMatch = {
  away: EspnTeam;
  date: string;
  eventId: string;
  home: EspnTeam;
  rawStatusName?: string | null;
  status: EspnEventStatus;
  statusDetail?: string | null;
  venue?: string | null;
};

export type EspnProviderOptions = {
  baseUrl?: string;
  leagueSlug?: string;
  timeoutMs?: number;
};

type EspnScoreboardResponse = {
  events?: EspnEvent[];
};

type EspnEvent = {
  competitions?: Array<{
    competitors?: Array<{
      homeAway?: "home" | "away";
      score?: string;
      team?: {
        abbreviation?: string;
        displayName?: string;
        id?: string;
        logo?: string;
        name?: string;
        shortDisplayName?: string;
      };
    }>;
    status?: EspnStatus;
    venue?: { fullName?: string };
  }>;
  date?: string;
  id?: string;
  status?: EspnStatus;
  venue?: { displayName?: string };
};

type EspnStatus = {
  type?: {
    completed?: boolean;
    name?: string;
    state?: string;
    detail?: string;
    shortDetail?: string;
  };
};

const defaultBaseUrl = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const defaultLeagueSlug = "fifa.world";

const toDateParam = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

const mapStatus = (status?: EspnStatus): EspnEventStatus => {
  const type = status?.type;
  if (type?.completed || type?.name === "STATUS_FULL_TIME") return "final";
  if (type?.state === "in" || type?.name?.includes("IN_PROGRESS")) return "in";
  if (type?.state === "pre") return "scheduled";
  if (type?.name?.includes("POSTPONED")) return "postponed";
  return "unknown";
};

export const espnStatusToMatchStatus = (status: EspnEventStatus, fallback: MatchStatus): MatchStatus => {
  if (status === "final") return "encerrado";
  if (status === "in") return "ao_vivo";
  return fallback;
};

const readTeam = (competitors: NonNullable<EspnEvent["competitions"]>[number]["competitors"], side: "home" | "away"): EspnTeam | null => {
  const item = competitors?.find((competitor) => competitor.homeAway === side);
  const team = item?.team;
  if (!item || !team) return null;

  return {
    abbreviation: team.abbreviation ?? null,
    displayName: team.displayName ?? team.shortDisplayName ?? team.name ?? "TBD",
    id: team.id ?? null,
    logo: team.logo ?? null,
    score: Number(item.score ?? 0),
  };
};

const mapEvent = (event: EspnEvent): EspnMatch | null => {
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors;
  const home = readTeam(competitors, "home");
  const away = readTeam(competitors, "away");
  if (!event.id || !event.date || !home || !away) return null;

  const status = competition?.status ?? event.status;

  return {
    away,
    date: event.date,
    eventId: event.id,
    home,
    rawStatusName: status?.type?.name ?? null,
    status: mapStatus(status),
    statusDetail: status?.type?.shortDetail ?? status?.type?.detail ?? null,
    venue: competition?.venue?.fullName ?? event.venue?.displayName ?? null,
  };
};

export const createEspnProvider = (options: EspnProviderOptions = {}) => {
  const baseUrl = options.baseUrl ?? defaultBaseUrl;
  const leagueSlug = options.leagueSlug ?? defaultLeagueSlug;
  const timeoutMs = options.timeoutMs ?? 20000;

  const fetchScoreboard = async (date = new Date()) => {
    const url = new URL(`${baseUrl}/${leagueSlug}/scoreboard`);
    url.searchParams.set("dates", toDateParam(date));

    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new Error(`ESPN scoreboard HTTP ${response.status}`);

    const json = (await response.json()) as EspnScoreboardResponse;
    return (json.events ?? []).map(mapEvent).filter((event): event is EspnMatch => Boolean(event));
  };

  const fetchMatch = async (eventId: string, date = new Date()) => {
    const events = await fetchScoreboard(date);
    return events.find((event) => event.eventId === eventId) ?? null;
  };

  const fetchLiveMatches = async (date = new Date()) => {
    const events = await fetchScoreboard(date);
    return events.filter((event) => event.status === "in");
  };

  const fetchFinishedMatches = async (date = new Date()) => {
    const events = await fetchScoreboard(date);
    return events.filter((event) => event.status === "final");
  };

  return { fetchFinishedMatches, fetchLiveMatches, fetchMatch, fetchScoreboard, name: "espn" as const };
};
