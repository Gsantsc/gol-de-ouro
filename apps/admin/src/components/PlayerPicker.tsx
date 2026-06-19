"use client";

import { useMemo, useState } from "react";
import { Search, UserRound, X } from "lucide-react";
import type { Match, Player } from "@gol-de-ouro/shared";
import { formatMatchupDisplayName, getTeamDisplayName } from "@gol-de-ouro/shared";

type PlayerPickerProps = {
  disabled?: boolean;
  label: string;
  match: Match;
  noGoals?: boolean;
  onChange: (value: { noGoals?: boolean; player: Player | null }) => void;
  players: Player[];
  selectedPlayerId?: string | null;
  showNoGoals?: boolean;
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const matchTeam = (player: Player, teamName: string) =>
  normalize(player.team_name) === normalize(teamName);

const playerLabel = (player?: Player | null) => {
  if (!player) return "Selecionar jogador";
  return [player.shirt_number ? `#${player.shirt_number}` : null, player.name]
    .filter(Boolean)
    .join(" ");
};

export const PlayerPicker = ({
  disabled = false,
  label,
  match,
  noGoals = false,
  onChange,
  players,
  selectedPlayerId,
  showNoGoals = false
}: PlayerPickerProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) ?? null;
  const groups = useMemo(() => {
    const filtered = (teamName: string) =>
      players
        .filter((player) => player.active && matchTeam(player, teamName))
        .filter((player) => normalize(`${player.name} ${player.position ?? ""}`).includes(normalize(query)))
        .sort((left, right) => left.name.localeCompare(right.name));

    return [
      { name: match.home_team, players: filtered(match.home_team) },
      { name: match.away_team, players: filtered(match.away_team) }
    ];
  }, [match.away_team, match.home_team, players, query]);

  const display = noGoals ? "Sem gols" : playerLabel(selectedPlayer);

  return (
    <div className="min-w-0">
      <p className="mb-1 text-sm font-black text-white/70">{label}</p>
      <button
        className="input flex min-h-12 w-full items-center justify-between gap-3 text-left"
        disabled={disabled}
        onClick={() => setOpen(true)}
        type="button"
      >
        <span className={selectedPlayer || noGoals ? "truncate text-white" : "truncate text-white/45"}>
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
              {showNoGoals && (
                <button
                  className={`mb-3 flex w-full items-center justify-between rounded-md border px-3 py-3 text-left transition ${
                    noGoals ? "border-gold bg-gold text-black" : "border-pitch-600 bg-pitch-950/35 text-white"
                  }`}
                  onClick={() => {
                    onChange({ noGoals: true, player: null });
                    setOpen(false);
                  }}
                  type="button"
                >
                  <span className="font-black">Sem gols</span>
                  <span className="text-xs font-black uppercase opacity-70">0 x 0</span>
                </button>
              )}

              <div className="space-y-5">
                {groups.map((group) => (
                  <section key={group.name}>
                    <p className="mb-2 text-xs font-black uppercase text-gold">{getTeamDisplayName(group.name)}</p>
                    {group.players.length ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {group.players.map((player) => {
                          const active = player.id === selectedPlayerId && !noGoals;
                          return (
                            <button
                              className={`rounded-md border px-3 py-3 text-left transition ${
                                active ? "border-gold bg-gold text-black" : "border-pitch-600 bg-pitch-950/35 text-white hover:border-gold/45"
                              }`}
                              key={player.id}
                              onClick={() => {
                                onChange({ noGoals: false, player });
                                setOpen(false);
                              }}
                              type="button"
                            >
                              <span className="block font-black">{player.name}</span>
                              <span className="mt-1 block text-xs font-bold opacity-65">
                                {[player.position, player.shirt_number ? `#${player.shirt_number}` : null].filter(Boolean).join(" · ") || "Elenco"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="rounded-md border border-dashed border-pitch-600 px-3 py-3 text-sm font-bold text-white/45">
                        Nenhum jogador encontrado.
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
