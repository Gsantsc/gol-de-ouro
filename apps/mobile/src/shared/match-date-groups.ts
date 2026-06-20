import type { Match } from "./types";
import { BRAZIL_TIME_ZONE, getMatchDisplayDateKey, getMatchKickoffValue } from "./time";

export type MatchDateGroup = {
  dateKey: string;
  label: string;
  matches: Match[];
};

const DEFAULT_TIME_ZONE = BRAZIL_TIME_ZONE;

export const formatMatchTime = (startTime: string, timeZone = DEFAULT_TIME_ZONE) =>
  new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone
  }).format(new Date(startTime));

export const formatMatchDate = (startTime: string, timeZone = DEFAULT_TIME_ZONE) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric"
  }).format(new Date(startTime));

export const formatMatchDayLabel = (startTime: string, timeZone = DEFAULT_TIME_ZONE) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    weekday: "long",
    year: "numeric"
  }).format(new Date(startTime));

export const formatMatchGroup = (match: Match) => {
  if (match.round) return match.round;
  return "Fase eliminatoria";
};

// MATCHES GROUP BY DAY
export const groupMatchesByDate = (matches: Match[], timeZone = DEFAULT_TIME_ZONE): MatchDateGroup[] => {
  const sortedMatches = [...matches].sort(
    (left, right) => new Date(getMatchKickoffValue(left)).getTime() - new Date(getMatchKickoffValue(right)).getTime(),
  );
  const groups = new Map<string, Match[]>();

  sortedMatches.forEach((match) => {
    const dateKey = getMatchDisplayDateKey(match, timeZone);
    const group = groups.get(dateKey) ?? [];
    group.push(match);
    groups.set(dateKey, group);
  });

  return Array.from(groups.entries()).map(([dateKey, groupedMatches]) => ({
    dateKey,
    label: formatMatchDayLabel(getMatchKickoffValue(groupedMatches[0]), timeZone),
    matches: groupedMatches
  }));
};
