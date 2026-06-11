// LEAGUE AUDIT
// SUPPORTED CHAMPIONSHIPS
import type { ChampionshipKey, EventType, MatchStatus, TournamentType } from "./types";

// Fonte única de verdade para campeonatos suportados
// API-Football IDs verificados para API-Football v3
export const SUPPORTED_CHAMPIONSHIPS = [
  {
    key: "world_cup_2026",
    name: "Copa do Mundo 2026",
    apiFootballId: 1,
    season: 2026,
    enabled: true,
  },
  {
    key: "libertadores",
    name: "Libertadores da América",
    apiFootballId: 13,
    season: 2026,
    enabled: true,
  },
  {
    key: "sul_americana",
    name: "Copa Sul-Americana",
    apiFootballId: 11,
    season: 2026,
    enabled: true,
  },
  {
    key: "brasileirao_a",
    name: "Campeonato Brasileiro Série A",
    apiFootballId: 71,
    season: 2026,
    enabled: true,
  },
  {
    key: "copa_do_brasil",
    name: "Copa do Brasil",
    apiFootballId: 73,
    season: 2026,
    enabled: true,
  },
  {
    key: "champions_league",
    name: "UEFA Champions League",
    apiFootballId: 2,
    season: 2026,
    enabled: true,
  },
] as const;

export const TOURNAMENT_LABELS: Record<TournamentType, string> = {
  world_cup: "Copa do Mundo",
  champions_league: "Champions League",
  libertadores: "Libertadores",
  brasileirao: "Brasileirao",
};

export const CHAMPIONSHIP_LABELS: Record<ChampionshipKey, string> = {
  world_cup_2026: "Copa do Mundo 2026",
  brasileirao_a: "Campeonato Brasileiro Série A",
  copa_do_brasil: "Copa do Brasil",
  champions_league: "Champions League",
  libertadores: "Libertadores",
  sul_americana: "Sul-Americana",
};

export const CHAMPIONSHIP_KEYS = Object.keys(CHAMPIONSHIP_LABELS) as ChampionshipKey[];

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  aberto: "Aberto",
  fechado: "Fechado",
  ao_vivo: "Ao vivo",
  encerrado: "Encerrado",
};

export const EVENT_LABELS: Record<EventType, string> = {
  goal: "Gol",
  yellow_card: "Cartao amarelo",
  red_card: "Cartao vermelho",
  substitution: "Substituicao",
};

export const PREDICTION_SCORE_MIN = 0;
export const PREDICTION_SCORE_MAX = 30;
