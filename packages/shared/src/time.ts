export { getPredictionWindowState } from "./prediction-window-service";
export type { PredictionWindowState } from "./prediction-window-service";

export const formatDateTimePtBr = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export const formatFullDatePtBr = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
