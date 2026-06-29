"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, UserRound, X } from "lucide-react";
import type { Match, Player } from "@gol-de-ouro/shared";
import { formatMatchupDisplayName, getTeamDisplayName, normalizeTeamNameWithAliases } from "@gol-de-ouro/shared";

type TeamFilter = "all" | "home" | "away";
type PositionGroupKey = "GOL" | "DEF" | "MEI" | "ATA" | "RS" | "OUT";
type PositionFilter = "ALL" | PositionGroupKey;

type PlayerPickerProps = {
  disabled?: boolean;
  label: string;
  match: Match;
  onChange: (value: { player: Player | null }) => void;
  players: Player[];
  selectedPlayerId?: string | null;
};

type MatchSide = {
  code?: string | null;
  id: "home" | "away";
  name: string;
};

type PlayerSection = {
  group: PositionGroupKey;
  label: string;
  players: Player[];
};

const POSITION_GROUP_ORDER: PositionGroupKey[] = ["GOL", "DEF", "MEI", "ATA", "RS", "OUT"];
const POSITION_FILTERS: PositionGroupKey[] = ["GOL", "DEF", "MEI", "ATA", "RS"];

const POSITION_GROUP_LABELS: Record<PositionGroupKey, string> = {
  ATA: "Atacantes",
  DEF: "Defensores",
  GOL: "Goleiros",
  MEI: "Meias",
  OUT: "Elenco",
  RS: "Reservas"
};

const POSITION_SHORT_LABELS: Record<PositionGroupKey, string> = {
  ATA: "ATA",
  DEF: "DEF",
  GOL: "GOL",
  MEI: "MEI",
  OUT: "OUT",
  RS: "RS"
};

const POSITION_META_LABELS: Record<PositionGroupKey, string> = {
  ATA: "Atacante",
  DEF: "Defensor",
  GOL: "Goleiro",
  MEI: "Meia",
  OUT: "Elenco",
  RS: "Reserva"
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const normalizeCode = (value?: string | null) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");

const normalizeTeamToken = (value?: string | null) =>
  normalizeTeamNameWithAliases(String(value ?? "").replace(/[_-]+/g, " ").trim());

const uniqueTokens = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));

const teamSideMatchesPlayer = (player: Pick<Player, "team_code" | "team_name">, side: MatchSide) => {
  const playerCodes = uniqueTokens([player.team_code, normalizeCode(player.team_code)]);
  const sideCodes = uniqueTokens([side.code, normalizeCode(side.code)]);
  if (playerCodes.length > 0 && sideCodes.some((code) => playerCodes.includes(code))) return true;

  const playerTeams = uniqueTokens([
    player.team_name,
    player.team_code,
    normalizeTeamToken(player.team_name),
    normalizeTeamToken(player.team_code)
  ]);
  const sideTeams = uniqueTokens([
    side.name,
    side.code,
    normalizeTeamToken(side.name),
    normalizeTeamToken(side.code)
  ]);

  return playerTeams.some((team) => sideTeams.includes(team));
};

const matchSideForPlayer = (player: Pick<Player, "team_code" | "team_name">, match: Match) => {
  const homeSide: MatchSide = { code: match.home_team_code, id: "home", name: match.home_team };
  const awaySide: MatchSide = { code: match.away_team_code, id: "away", name: match.away_team };
  const belongsHome = teamSideMatchesPlayer(player, homeSide);
  const belongsAway = teamSideMatchesPlayer(player, awaySide);

  if (belongsHome && !belongsAway) return homeSide;
  if (belongsAway && !belongsHome) return awaySide;
  if (belongsHome) return homeSide;
  return null;
};

const normalizePositionGroup = (value?: string | null): PositionGroupKey | null => {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "GOL" || normalized === "DEF" || normalized === "MEI" || normalized === "ATA" || normalized === "RS") {
    return normalized;
  }

  return null;
};

const inferPositionGroup = (position?: string | null): PositionGroupKey | null => {
  const normalized = normalize(position ?? "");
  if (!normalized) return null;
  if (/(goleir|goalkeeper|\bgk\b)/i.test(normalized)) return "GOL";
  if (/(zagueir|lateral|defensor|defender|defesa|back)/i.test(normalized)) return "DEF";
  if (/(meia|meio|volante|midfield|midfielder)/i.test(normalized)) return "MEI";
  if (/(atacante|ponta|forward|striker|winger|ataque)/i.test(normalized)) return "ATA";
  if (/(reserva|reserve|\brs\b)/i.test(normalized)) return "RS";
  return null;
};

const isReservePlayer = (player: Player) =>
  Boolean(player.is_reserve) || normalizePositionGroup(player.position_group) === "RS";

const positionGroupFor = (player: Player): PositionGroupKey => {
  if (isReservePlayer(player)) return "RS";
  return normalizePositionGroup(player.position_group) ?? inferPositionGroup(player.position) ?? "OUT";
};

const playerShirtNumber = (player: Player) => player.shirt_number ?? null;

const playerDedupKey = (player: Player) =>
  player.id || `${normalize(player.name)}:${normalizeCode(player.team_code)}:${playerShirtNumber(player) ?? "sem-camisa"}`;

const dedupePlayersForRender = (players: Player[]) => {
  const seen = new Set<string>();
  return players.filter((player) => {
    const key = playerDedupKey(player);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const comparePlayers = (left: Player, right: Player) => {
  const leftReserve = isReservePlayer(left) ? 1 : 0;
  const rightReserve = isReservePlayer(right) ? 1 : 0;
  if (leftReserve !== rightReserve) return leftReserve - rightReserve;

  const leftOrder = left.roster_order ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.roster_order ?? Number.MAX_SAFE_INTEGER;
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;

  const leftNumber = playerShirtNumber(left) ?? Number.MAX_SAFE_INTEGER;
  const rightNumber = playerShirtNumber(right) ?? Number.MAX_SAFE_INTEGER;
  if (leftNumber !== rightNumber) return leftNumber - rightNumber;

  return left.name.localeCompare(right.name, "pt-BR");
};

const sortPickerPlayers = (players: Player[]) =>
  [...players].sort((left, right) => {
    const leftGroup = POSITION_GROUP_ORDER.indexOf(positionGroupFor(left));
    const rightGroup = POSITION_GROUP_ORDER.indexOf(positionGroupFor(right));
    if (leftGroup !== rightGroup) return leftGroup - rightGroup;
    return comparePlayers(left, right);
  });

const playerLabel = (player?: Player | null) => {
  if (!player) return "Selecionar jogador";
  return [isReservePlayer(player) ? "[RS]" : null, playerShirtNumber(player) ? `#${playerShirtNumber(player)}` : null, player.name]
    .filter(Boolean)
    .join(" ");
};

const playerPositionLabel = (player: Player) => POSITION_META_LABELS[positionGroupFor(player)];

export const PlayerPicker = ({
  disabled = false,
  label,
  match,
  onChange,
  players,
  selectedPlayerId
}: PlayerPickerProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all");
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("ALL");
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) ?? null;
  const homeSide = useMemo<MatchSide>(
    () => ({ code: match.home_team_code, id: "home", name: match.home_team }),
    [match.home_team, match.home_team_code],
  );
  const awaySide = useMemo<MatchSide>(
    () => ({ code: match.away_team_code, id: "away", name: match.away_team }),
    [match.away_team, match.away_team_code],
  );
  const display = playerLabel(selectedPlayer);

  const allPlayers = useMemo(
    () => sortPickerPlayers(dedupePlayersForRender(players.filter((player) => player.active && matchSideForPlayer(player, match)))),
    [match, players],
  );

  const teamTabs = useMemo(() => [
    { context: null, id: "all" as const, label: "Todos", value: allPlayers.length },
    {
      context: "Casa",
      id: "home" as const,
      label: getTeamDisplayName(match.home_team),
      value: allPlayers.filter((player) => teamSideMatchesPlayer(player, homeSide)).length,
    },
    {
      context: "Visitante",
      id: "away" as const,
      label: getTeamDisplayName(match.away_team),
      value: allPlayers.filter((player) => teamSideMatchesPlayer(player, awaySide)).length,
    },
  ], [allPlayers, awaySide, homeSide, match.away_team, match.home_team]);

  const teamFilteredPlayers = useMemo(() => {
    if (teamFilter === "home") return allPlayers.filter((player) => teamSideMatchesPlayer(player, homeSide));
    if (teamFilter === "away") return allPlayers.filter((player) => teamSideMatchesPlayer(player, awaySide));
    return allPlayers;
  }, [allPlayers, awaySide, homeSide, teamFilter]);

  const positionCounts = useMemo(() => {
    const counts = new Map<PositionGroupKey, number>();
    teamFilteredPlayers.forEach((player) => {
      const group = positionGroupFor(player);
      counts.set(group, (counts.get(group) ?? 0) + 1);
    });
    return counts;
  }, [teamFilteredPlayers]);

  const hasReservePlayers = (positionCounts.get("RS") ?? 0) > 0;
  const positionChipOptions = POSITION_FILTERS.filter((position) => position !== "RS" || hasReservePlayers);

  const visiblePlayers = useMemo(() => {
    const normalizedQuery = normalize(query.trim());
    return teamFilteredPlayers.filter((player) => {
      const playerGroup = positionGroupFor(player);
      const shirtNumber = playerShirtNumber(player);
      const matchesPosition = positionFilter === "ALL" || playerGroup === positionFilter;
      const matchesSearch = !normalizedQuery || normalize([
        player.name,
        player.position ?? "",
        player.position_group ?? "",
        playerGroup,
        player.team_name,
        player.team_code,
        shirtNumber ? String(shirtNumber) : "",
      ].join(" ")).includes(normalizedQuery);

      return matchesPosition && matchesSearch;
    });
  }, [positionFilter, query, teamFilteredPlayers]);

  const sections = useMemo<PlayerSection[]>(
    () => POSITION_GROUP_ORDER.flatMap((group) => {
      const sectionPlayers = visiblePlayers.filter((player) => positionGroupFor(player) === group);
      return sectionPlayers.length ? [{ group, label: POSITION_GROUP_LABELS[group], players: sectionPlayers }] : [];
    }),
    [visiblePlayers],
  );

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setTeamFilter("all");
    setPositionFilter("ALL");
  }, [open]);

  const resetFilters = () => {
    setQuery("");
    setTeamFilter("all");
    setPositionFilter("ALL");
  };

  const closeModal = () => setOpen(false);

  return (
    <div className="min-w-0">
      <p className="mb-1 text-sm font-black text-white/70">{label}</p>
      <button
        className="input flex min-h-12 w-full items-center justify-between gap-3 text-left"
        disabled={disabled}
        onClick={() => setOpen(true)}
        type="button"
      >
        <span className={selectedPlayer ? "truncate text-white" : "truncate text-white/45"}>
          {display}
        </span>
        <UserRound className="h-4 w-4 shrink-0 text-gold" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/72 px-3 py-5 sm:px-4 sm:py-6">
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-pitch-600 bg-pitch-800 shadow-panel">
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-pitch-600 p-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase text-gold">{label}</p>
                <h3 className="mt-1 truncate text-xl font-black">{formatMatchupDisplayName(match.home_team, match.away_team)}</h3>
              </div>
              <button aria-label="Fechar seletor" className="btn-icon" onClick={closeModal} type="button">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="shrink-0 space-y-3 border-b border-pitch-600 bg-pitch-800 p-4">
              <label className="flex min-h-11 items-center gap-2 rounded-md border border-pitch-600 bg-pitch-950/55 px-3">
                <Search className="h-4 w-4 shrink-0 text-white/40" />
                <input
                  autoFocus
                  className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/35"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar jogador"
                  value={query}
                />
              </label>

              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-white/45">Time</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {teamTabs.map((tab) => {
                    const active = teamFilter === tab.id;
                    return (
                      <button
                        aria-pressed={active}
                        className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-left text-xs font-black transition ${
                          active ? "border-gold bg-gold text-black" : "border-pitch-600 bg-pitch-950/40 text-white/70 hover:border-gold/35 hover:text-white"
                        }`}
                        key={tab.id}
                        onClick={() => setTeamFilter(tab.id)}
                        type="button"
                      >
                        <span className="flex min-w-0 flex-col leading-tight">
                          {tab.context ? <span className={active ? "text-[9px] uppercase text-black/60" : "text-[9px] uppercase text-white/40"}>{tab.context}</span> : null}
                          <span className="max-w-32 truncate">{tab.label}</span>
                        </span>
                        <span className={active ? "text-black/70" : "text-gold"}>{tab.value}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-white/45">Posição</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {[{ id: "ALL" as const, label: "Todos", value: teamFilteredPlayers.length }, ...positionChipOptions.map((position) => ({
                    id: position,
                    label: POSITION_SHORT_LABELS[position],
                    value: positionCounts.get(position) ?? 0,
                  }))].map((chip) => {
                    const active = positionFilter === chip.id;
                    return (
                      <button
                        aria-pressed={active}
                        className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black transition ${
                          active ? "border-gold bg-gold text-black" : "border-pitch-600 bg-pitch-950/40 text-white/70 hover:border-gold/35 hover:text-white"
                        }`}
                        key={chip.id}
                        onClick={() => setPositionFilter(chip.id)}
                        type="button"
                      >
                        <span>{chip.label}</span>
                        <span className={active ? "text-black/70" : "text-gold"}>{chip.value}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {sections.length ? (
                <div className="space-y-4">
                  {sections.map((section) => (
                    <section key={section.group}>
                      <div className="sticky top-0 z-10 -mx-4 mb-2 flex items-center justify-between border-b border-pitch-600 bg-pitch-800/95 px-4 py-2 backdrop-blur">
                        <p className="text-xs font-black uppercase text-gold">{section.label}</p>
                        <p className="text-xs font-black text-white/40">{section.players.length}</p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {section.players.map((player) => {
                          const active = player.id === selectedPlayerId;
                          const reserve = isReservePlayer(player);
                          const shirtNumber = playerShirtNumber(player);
                          const side = matchSideForPlayer(player, match);
                          const metaParts = [
                            playerPositionLabel(player),
                            teamFilter === "all" ? getTeamDisplayName(side?.name ?? player.team_name) : null,
                          ].filter(Boolean);

                          return (
                            <button
                              className={`flex min-w-0 items-center gap-3 rounded-md border px-3 py-2 text-left transition ${
                                active ? "border-gold bg-gold text-black" : "border-pitch-600 bg-pitch-950/35 text-white hover:border-gold/45 hover:bg-pitch-950/55"
                              }`}
                              key={playerDedupKey(player)}
                              onClick={() => {
                                onChange({ player });
                                closeModal();
                              }}
                              type="button"
                            >
                              <span className={`flex h-9 w-11 shrink-0 items-center justify-center rounded-md border text-xs font-black ${
                                active ? "border-black/25 bg-black/10 text-black" : "border-gold/25 bg-gold/10 text-gold"
                              }`}
                              >
                                {shirtNumber ?? "--"}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-black">{player.name}</span>
                                <span className={`mt-0.5 block truncate text-xs font-bold ${active ? "text-black/65" : "text-white/55"}`}>
                                  {metaParts.join(" - ")}
                                </span>
                              </span>
                              {reserve ? (
                                <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black ${
                                  active ? "border-black/25 bg-black/10 text-black" : "border-gold/35 bg-gold/10 text-gold"
                                }`}
                                >
                                  RS
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-pitch-600 bg-pitch-950/25 px-4 py-10 text-center">
                  <p className="text-sm font-black text-white">Nenhum jogador encontrado</p>
                  <p className="mt-2 max-w-sm text-xs font-bold leading-5 text-white/50">Tente buscar por outro nome ou limpar os filtros.</p>
                  <button className="btn-ghost mt-4 min-h-9 px-3 py-1.5 text-xs" onClick={resetFilters} type="button">
                    Limpar filtros
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
