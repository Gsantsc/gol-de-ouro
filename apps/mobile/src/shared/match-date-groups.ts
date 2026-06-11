import type { Match } from "./types";

export type MatchDateGroup = {
  dateKey: string;
  label: string;
  matches: Match[];
};

const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

const dateKeyFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric"
  });

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
  const formatter = dateKeyFormatter(timeZone);
  const sortedMatches = [...matches].sort(
    (left, right) => new Date(left.start_time).getTime() - new Date(right.start_time).getTime(),
  );
  const groups = new Map<string, Match[]>();

  sortedMatches.forEach((match) => {
    const dateKey = formatter.format(new Date(match.start_time));
    const group = groups.get(dateKey) ?? [];
    group.push(match);
    groups.set(dateKey, group);
  });

  return Array.from(groups.entries()).map(([dateKey, groupedMatches]) => ({
    dateKey,
    label: formatMatchDayLabel(groupedMatches[0].start_time, timeZone),
    matches: groupedMatches
  }));
};
