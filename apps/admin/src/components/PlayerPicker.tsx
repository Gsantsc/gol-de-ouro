"use client";

import { useMemo, useState } from "react";
import { Search, UserRound, X } from "lucide-react";
import type { Match, Player } from "@gol-de-ouro/shared";
import { formatMatchupDisplayName, getTeamDisplayName, normalizeTeamNameWithAliases } from "@gol-de-ouro/shared";

type PositionGroupKey = "GOL" | "DEF" | "MEI" | "ATA" | "RS" | "OUT";

type PlayerPickerProps = {
  disabled?: boolean;
  label: string;
  match: Match;
  onChange: (value: { player: Player | null }) => void;
  players: Player[];
  selectedPlayerId?: string | null;
};

const POSITION_GROUP_ORDER: PositionGroupKey[] = ["GOL", "DEF", "MEI", "ATA", "OUT", "RS"];

const POSITION_GROUP_LABELS: Record<PositionGroupKey, string> = {
  ATA: "ATA",
  DEF: "DEF",
  GOL: "GOL",
  MEI: "MEI",
  OUT: "Sem posicao",
  RS: "RS"
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

const matchTeam = (player: Player, teamName: string, teamCode?: string | null) => {
  if (teamCode && player.team_code && normalizeCode(player.team_code) === normalizeCode(teamCode)) return true;
  return normalizeTeamNameWithAliases(player.team_name) === normalizeTeamNameWithAliases(teamName);
};

const isPlaceholderTeam = (teamName?: string | null) => {
  const raw = String(teamName ?? "").trim();
  if (!raw) return true;
  const normalized = normalize(raw).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  const compact = raw.toUpperCase().replace(/\s+/g, "");
  if (/^(W|L)\d{1,3}(?:\/(?:W|L)?\d{1,3})*$/.test(compact)) return true;
  return [
    "a definir",
    "tbd",
    "to be determined",
    "winner match",
    "winner group",
    "runner up group",
    "third place group",
    "loser match",
  ].some((pattern) => normalized.includes(pattern));
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

const comparePlayers = (left: Player, right: Player) => {
  const leftReserve = isReservePlayer(left) ? 1 : 0;
  const rightReserve = isReservePlayer(right) ? 1 : 0;
  if (leftReserve !== rightReserve) return leftReserve - rightReserve;

  const leftOrder = left.roster_order ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.roster_order ?? Number.MAX_SAFE_INTEGER;
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;

  const leftNumber = left.shirt_number ?? Number.MAX_SAFE_INTEGER;
  const rightNumber = right.shirt_number ?? Number.MAX_SAFE_INTEGER;
  if (leftNumber !== rightNumber) return leftNumber - rightNumber;

  return left.name.localeCompare(right.name, "pt-BR");
};

const groupByPosition = (players: Player[]) =>
  POSITION_GROUP_ORDER.map((group) => ({
    group,
    label: POSITION_GROUP_LABELS[group],
    players: players
      .filter((player) => positionGroupFor(player) === group)
      .sort(comparePlayers)
  })).filter((group) => group.players.length > 0);

const playerLabel = (player?: Player | null) => {
  if (!player) return "Selecionar jogador";
  return [isReservePlayer(player) ? "[RS]" : null, player.shirt_number ? `#${player.shirt_number}` : null, player.name]
    .filter(Boolean)
    .join(" ");
};

const playerMeta = (player: Player) =>
  [player.position, player.shirt_number ? `#${player.shirt_number}` : null].filter(Boolean).join(" - ") || "Elenco";

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
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) ?? null;
  const groups = useMemo(() => {
    const filtered = (teamName: string, teamCode?: string | null) =>
      players
        .filter((player) => player.active && matchTeam(player, teamName, teamCode))
        .filter((player) => normalize(`${player.name} ${player.position ?? ""} ${player.position_group ?? ""}`).includes(normalize(query)));

    return [
      { code: match.home_team_code, name: match.home_team, positionGroups: groupByPosition(filtered(match.home_team, match.home_team_code)) },
      { code: match.away_team_code, name: match.away_team, positionGroups: groupByPosition(filtered(match.away_team, match.away_team_code)) }
    ];
  }, [match.away_team, match.away_team_code, match.home_team, match.home_team_code, players, query]);

  const display = playerLabel(selectedPlayer);

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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/72 px-4 py-6">
          <div className="max-h-[88vh] w-full max-w-2xl overflow-hidden rounded-lg border border-pitch-600 bg-pitch-800 shadow-panel">
            <header className="flex items-start justify-between gap-4 border-b border-pitch-600 p-4">
              <div>
                <p className="text-xs font-black uppercase text-gold">{label}</p>
                <h3 className="mt-1 text-xl font-black">{formatMatchupDisplayName(match.home_team, match.away_team)}</h3>
              </div>
              <button className="btn-icon" onClick={() => setOpen(false)} type="button">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="border-b border-pitch-600 p-4">
              <label className="flex items-center gap-2 rounded-md border border-pitch-600 bg-pitch-950/55 px-3 py-2">
                <Search className="h-4 w-4 text-white/40" />
                <input
                  autoFocus
                  className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/35"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar jogador"
                  value={query}
                />
              </label>
            </div>

            <div className="max-h-[58vh] overflow-y-auto p-4">
              <div className="space-y-5">
                {groups.map((group) => (
                  <section key={group.name}>
                    <p className="mb-2 text-xs font-black uppercase text-gold">{getTeamDisplayName(group.name)}</p>
                    {group.positionGroups.length ? (
                      <div className="space-y-3">
                        {group.positionGroups.map((positionGroup) => (
                          <div key={`${group.name}-${positionGroup.group}`}>
                            <p className="mb-2 text-[11px] font-black uppercase text-white/45">{positionGroup.label}</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {positionGroup.players.map((player) => {
                                const active = player.id === selectedPlayerId;
                                const reserve = isReservePlayer(player);
                                return (
                                  <button
                                    className={`rounded-md border px-3 py-3 text-left transition ${
                                      active ? "border-gold bg-gold text-black" : "border-pitch-600 bg-pitch-950/35 text-white hover:border-gold/45"
                                    }`}
                                    key={player.id}
                                    onClick={() => {
                                      onChange({ player });
                                      setOpen(false);
                                    }}
                                    type="button"
                                  >
                                    <span className="block font-black">
                                      {reserve ? <span className="mr-1 text-xs font-black opacity-70">[RS]</span> : null}
                                      {player.name}
                                    </span>
                                    <span className="mt-1 block text-xs font-bold opacity-65">
                                      {playerMeta(player)}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-md border border-dashed border-pitch-600 px-3 py-3 text-sm font-bold text-white/45">
                        {!query.trim() && !isPlaceholderTeam(group.name)
                          ? "Elenco ainda não sincronizado. Use 'Sincronizar jogadores' no Admin."
                          : "Nenhum jogador encontrado."}
                      </p>
                    )}
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
