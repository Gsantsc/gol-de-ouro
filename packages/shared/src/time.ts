export { getPredictionWindowState } from "./prediction-window-service";
export type { PredictionWindowState } from "./prediction-window-service";

export const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

export type MatchDateTimeInput = {
  start_time?: string | null;
  start_time_utc?: string | null;
};

export const getMatchKickoffValue = (match: MatchDateTimeInput | string) =>
  typeof match === "string" ? match : match.start_time_utc ?? match.start_time ?? "";

export const formatMatchDateTime = (match: MatchDateTimeInput | string, timeZone = BRAZIL_TIME_ZONE) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone,
  }).format(new Date(getMatchKickoffValue(match)));

export const getMatchDisplayDateKey = (match: MatchDateTimeInput | string, timeZone = BRAZIL_TIME_ZONE) =>
  new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).format(new Date(getMatchKickoffValue(match)));

export const formatDateTimePtBr = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BRAZIL_TIME_ZONE,
  }).format(new Date(value));

export const formatFullDatePtBr = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: BRAZIL_TIME_ZONE,
  }).format(new Date(value));
