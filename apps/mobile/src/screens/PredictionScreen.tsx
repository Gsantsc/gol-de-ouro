import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, View } from "react-native";
import { CheckCircle2, Clock, Minus, Plus, Search, Send, UserRound, X } from "lucide-react-native";
import type { Match, Player, Prediction } from "../shared";
import {
  PREDICTION_SCORE_MAX,
  PREDICTION_SCORE_MIN,
  canCreatePrediction,
  formatDateTimePtBr,
  formatMatchupDisplayName,
  formatTeamDisplayName,
  getSeedLabel,
  getTeamDisplayName,
  hasUndefinedParticipant,
  isKnockoutPlaceholder,
  isPlayerEligibleForMatch,
  normalizeTeamNameWithAliases,
  predictionOutcome
} from "../shared";
import { AppButton, Card, IconButton, Screen, Subtitle, Title, ToastBanner } from "../components/ui";
import { TeamFlag } from "../components/TeamFlag";
import { useAuth } from "../hooks/useAuth";
import { submitPrediction } from "../services/football.service";
import { colors, radius, spacing } from "../theme/tokens";

const clampPredictionScore = (value: number) =>
  Math.min(PREDICTION_SCORE_MAX, Math.max(PREDICTION_SCORE_MIN, Math.trunc(value)));

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

type TeamFilter = "all" | "home" | "away";
type PositionFilter = "ALL" | PositionGroupKey;
type PositionGroupKey = "GOL" | "DEF" | "MEI" | "ATA" | "RS" | "OUT";

type PickerPlayer = Player & {
  is_reserve?: boolean | null;
  position_group?: string | null;
  roster?: {
    is_reserve?: boolean | null;
    position?: string | null;
    position_group?: string | null;
    roster_order?: number | null;
    shirt_number?: number | null;
  } | null;
  roster_order?: number | null;
};

type MatchSide = {
  code?: string | null;
  id: "home" | "away";
  name: string;
};

type PlayerSection = {
  data: PickerPlayer[];
  key: PositionGroupKey;
  title: string;
};

const POSITION_ORDER: PositionGroupKey[] = ["GOL", "DEF", "MEI", "ATA", "RS", "OUT"];
const POSITION_FILTERS: PositionGroupKey[] = ["GOL", "DEF", "MEI", "ATA", "RS"];
const POSITION_LABELS: Record<PositionGroupKey, string> = {
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

const playerBelongsToMatch = (player: Pick<Player, "team_code" | "team_name">, match: Match) =>
  Boolean(matchSideForPlayer(player, match)) || isPlayerEligibleForMatch(player, match);

const isReservePlayer = (player: PickerPlayer) =>
  Boolean(player.is_reserve || player.roster?.is_reserve)
  || String(player.position_group ?? player.roster?.position_group ?? "").trim().toUpperCase() === "RS";

const playerPositionGroup = (player: PickerPlayer): PositionGroupKey => {
  if (isReservePlayer(player)) return "RS";

  const raw = String(player.position_group ?? player.roster?.position_group ?? player.position ?? "");
  const normalized = normalize(raw);
  if (/(^|\s)(gol|goleir|goalkeeper|gk)(\s|$)/i.test(normalized) || normalized === "gol") return "GOL";
  if (/(def|defensor|defender|zagueir|lateral|back)/i.test(normalized)) return "DEF";
  if (/(mei|meia|midfield|volante|meio)/i.test(normalized)) return "MEI";
  if (/(ata|atacante|attacker|forward|striker|winger|ponta)/i.test(normalized)) return "ATA";
  return "OUT";
};

const playerShirtNumber = (player: PickerPlayer) => player.roster?.shirt_number ?? player.shirt_number ?? null;

const playerRosterOrder = (player: PickerPlayer) => player.roster?.roster_order ?? player.roster_order ?? Number.MAX_SAFE_INTEGER;

const playerPositionLabel = (player: PickerPlayer) => {
  const group = playerPositionGroup(player);
  return POSITION_META_LABELS[group];
};

const playerDedupKey = (player: PickerPlayer) =>
  player.id || `${normalize(player.name)}:${normalizeCode(player.team_code)}:${playerShirtNumber(player) ?? "sem-camisa"}`;

const dedupePlayersForRender = (players: PickerPlayer[]) => {
  const seen = new Set<string>();
  return players.filter((player) => {
    const key = playerDedupKey(player);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const sortPickerPlayers = (players: PickerPlayer[]) =>
  [...players].sort((left, right) => {
    const leftGroup = POSITION_ORDER.indexOf(playerPositionGroup(left));
    const rightGroup = POSITION_ORDER.indexOf(playerPositionGroup(right));
    if (leftGroup !== rightGroup) return leftGroup - rightGroup;

    const leftOrder = playerRosterOrder(left);
    const rightOrder = playerRosterOrder(right);
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;

    const leftNumber = playerShirtNumber(left) ?? Number.MAX_SAFE_INTEGER;
    const rightNumber = playerShirtNumber(right) ?? Number.MAX_SAFE_INTEGER;
    if (leftNumber !== rightNumber) return leftNumber - rightNumber;

    return left.name.localeCompare(right.name, "pt-BR");
  });

const boolLabel = (value: boolean) => (value ? "Sim" : "Não");

const outcomeLabel = (outcome: ReturnType<typeof predictionOutcome>, homeTeamName: string, awayTeamName: string) => {
  if (outcome === "home") return `Vitória do mandante (${homeTeamName})`;
  if (outcome === "away") return `Vitória do visitante (${awayTeamName})`;
  return "Empate";
};

export const PredictionScreen = ({
  match,
  prediction,
  players,
  predictionLockMinutes,
  onClose,
  onSubmitted
}: {
  match: Match;
  prediction?: Prediction;
  players: Player[];
  predictionLockMinutes: number;
  onClose: () => void;
  onSubmitted: () => Promise<void> | void;
}) => {
  const { profile } = useAuth();
  const [homeScore, setHomeScore] = useState(clampPredictionScore(prediction?.predicted_home_score ?? 0));
  const [awayScore, setAwayScore] = useState(clampPredictionScore(prediction?.predicted_away_score ?? 0));
  const [firstScorerId, setFirstScorerId] = useState<string | null>(prediction?.predicted_first_scorer_id ?? null);
  const [manOfMatchId, setManOfMatchId] = useState<string | null>(prediction?.predicted_man_of_match_id ?? null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstScorerDisabled = homeScore === 0 && awayScore === 0;
  const predictionAccess = canCreatePrediction(match, profile, new Date(), predictionLockMinutes);
  const hasUndefinedTeams = hasUndefinedParticipant(match);
  const canSubmit = predictionAccess.allowed;
  const matchPlayers = players.filter((player) => player.active && playerBelongsToMatch(player, match));
  const firstScorerCandidate = players.find((player) => player.id === firstScorerId) ?? null;
  const manOfMatchCandidate = players.find((player) => player.id === manOfMatchId) ?? null;
  const firstScorerPlayer = firstScorerCandidate && playerBelongsToMatch(firstScorerCandidate, match) ? firstScorerCandidate : null;
  const manOfMatchPlayer = manOfMatchCandidate && playerBelongsToMatch(manOfMatchCandidate, match) ? manOfMatchCandidate : null;
  const homeTeamName = formatTeamDisplayName(match.home_team);
  const awayTeamName = formatTeamDisplayName(match.away_team);
  const homeSeedLabel = getSeedLabel(match.home_team);
  const awaySeedLabel = getSeedLabel(match.away_team);
  const automaticWinner = predictionOutcome({ awayScore, homeScore });
  const automaticBothTeamsScore = homeScore > 0 && awayScore > 0;
  const automaticWinnerLabel = outcomeLabel(automaticWinner, homeTeamName, awayTeamName);
  const firstScorerLabel = firstScorerDisabled ? "Nao se aplica" : firstScorerPlayer?.name ?? (firstScorerCandidate && !playerBelongsToMatch(firstScorerCandidate, match) ? "Jogador inválido para esta partida" : "Não selecionado");
  const manOfMatchLabel = manOfMatchPlayer?.name ?? (manOfMatchCandidate && !playerBelongsToMatch(manOfMatchCandidate, match) ? "Jogador inválido para esta partida" : "Não selecionado");

  useEffect(() => {
    if (firstScorerDisabled && firstScorerId) {
      setFirstScorerId(null);
    }
  }, [firstScorerDisabled, firstScorerId]);

  const validateBeforeSubmit = () => {
    if (!profile) return "Sessão expirada. Entre novamente.";
    if (hasUndefinedTeams) return "Times ainda nao definidos para esta partida.";
    if (!canSubmit) return predictionAccess.message;
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
      return "Preencha o placar para enviar seu palpite.";
    }
    if (!firstScorerDisabled && firstScorerId && !firstScorerPlayer) {
      return "Selecione apenas jogadores das seleções desta partida.";
    }
    if (manOfMatchId && !manOfMatchPlayer) {
      return "Selecione apenas jogadores das seleções desta partida.";
    }
    return null;
  };

  const submit = async () => {
    if (loading) return;

    const validationError = validateBeforeSubmit();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!profile) return;

    try {
      setLoading(true);
      setError(null);
      const normalizedHomeScore = clampPredictionScore(homeScore);
      const normalizedAwayScore = clampPredictionScore(awayScore);
      await submitPrediction({
        userId: profile.id,
        matchId: match.id,
        homeScore: normalizedHomeScore,
        awayScore: normalizedAwayScore,
        firstScorer: null,
        firstScorerId: firstScorerDisabled ? null : firstScorerId,
        manOfMatch: null,
        manOfMatchId
      });
      setSubmitted(true);
      await onSubmitted();
      setTimeout(onClose, 900);
    } catch (nextError) {
      if (__DEV__) console.warn("[PREDICTION SUBMIT]", nextError);
      setError(nextError instanceof Error ? nextError.message : "Não foi possível enviar seu palpite agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      {error ? <ToastBanner message={error} tone="error" /> : null}
      <Card variant="accent">
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>Palpite</Text>
            <Title>{prediction ? "Editar palpite" : "Monte seu palpite"}</Title>
            <Subtitle>
              {formatMatchupDisplayName(match.home_team, match.away_team)}
            </Subtitle>
          </View>
          <IconButton label="Fechar" onPress={onClose}>
            <X color={colors.text} size={18} />
          </IconButton>
        </View>

        <View style={styles.matchInfo}>
          <Clock color={colors.muted} size={16} />
          <Text style={styles.matchInfoText}>{formatDateTimePtBr(match.start_time)}</Text>
        </View>

        {hasUndefinedTeams ? (
          <View style={styles.undefinedTeamsBox}>
            <Text style={styles.undefinedTeamsTitle}>Times ainda nao definidos para esta partida.</Text>
            <Text style={styles.undefinedTeamsText}>
              Aguarde a definicao dos classificados para enviar seu palpite.
            </Text>
          </View>
        ) : null}

        {submitted ? (
          <View style={styles.confirmed}>
            <CheckCircle2 color={colors.gold} size={42} />
            <Text style={styles.confirmedTitle}>{prediction ? "Palpite atualizado com sucesso." : "Palpite enviado com sucesso."}</Text>
            <Text style={styles.confirmedScore}>{homeScore} x {awayScore}</Text>
            <Text style={styles.confirmedBody}>Placar e mercados extras ficam salvos na aba Palpites.</Text>
          </View>
        ) : (
          <>
            <View style={styles.scoreInput}>
              <Stepper
                label={homeTeamName}
                logoUrl={match.home_team_logo_url}
                onDec={() => setHomeScore((value) => clampPredictionScore(value - 1))}
                onInc={() => setHomeScore((value) => clampPredictionScore(value + 1))}
                seedLabel={homeSeedLabel}
                teamName={match.home_team}
                value={homeScore}
              />
              <Text style={styles.vs}>x</Text>
              <Stepper
                label={awayTeamName}
                logoUrl={match.away_team_logo_url}
                onDec={() => setAwayScore((value) => clampPredictionScore(value - 1))}
                onInc={() => setAwayScore((value) => clampPredictionScore(value + 1))}
                seedLabel={awaySeedLabel}
                teamName={match.away_team}
                value={awayScore}
              />
            </View>

            <View style={styles.ruleBox}>
              <Text style={styles.rule}>
                Palpites abrem 24h antes e podem ser editados ate {predictionLockMinutes} minutos antes da partida.
              </Text>
            </View>

            <View style={styles.autoResultBox}>
              <Text style={styles.fieldLabel}>Resultado do seu palpite</Text>
              <Text style={styles.autoResultText}>{automaticWinnerLabel}</Text>
            </View>

            <View style={styles.fieldGrid}>
              {firstScorerDisabled ? (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Primeiro jogador a marcar</Text>
                  <View style={styles.disabledMarketBox}>
                    <Text style={styles.disabledMarketText}>Nao se aplica para palpite 0 x 0</Text>
                  </View>
                </View>
              ) : (
                <PlayerPicker
                  label="Primeiro jogador a marcar"
                  match={match}
                  onChange={({ player }) => setFirstScorerId(player?.id ?? null)}
                  players={matchPlayers}
                  selectedPlayerId={firstScorerPlayer?.id ?? null}
                />
              )}
              <PlayerPicker
                label="Homem do jogo"
                match={match}
                onChange={({ player }) => setManOfMatchId(player?.id ?? null)}
                players={matchPlayers}
                selectedPlayerId={manOfMatchPlayer?.id ?? null}
              />
            </View>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>Resumo do palpite</Text>
              <View style={styles.summaryGrid}>
                <SummaryItem label="Placar" value={`${homeScore} x ${awayScore}`} />
                <SummaryItem label="Resultado" value={automaticWinnerLabel} />
                <SummaryItem label="Primeiro jogador" value={firstScorerLabel} />
                <SummaryItem label="Homem do jogo" value={manOfMatchLabel} />
                <SummaryItem label="Ambos marcam" value={boolLabel(automaticBothTeamsScore)} />
              </View>
            </View>

            <AppButton
              disabled={!canSubmit}
              icon={<Send color={colors.black} size={18} />}
              loading={loading}
              onPress={submit}
              title={canSubmit ? prediction ? "Salvar edição" : "Confirmar palpite" : hasUndefinedTeams ? "Times ainda nao definidos" : predictionAccess.message}
            />
          </>
        )}
      </Card>
    </Screen>
  );
};

const Stepper = ({
  label,
  logoUrl,
  seedLabel,
  teamName,
  value,
  onDec,
  onInc
}: {
  label: string;
  logoUrl?: string | null;
  seedLabel?: string | null;
  teamName: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
}) => (
  <View style={styles.teamSection}>
    <View style={styles.teamHeading}>
      <TeamFlag logoUrl={isKnockoutPlaceholder(teamName) ? null : logoUrl} name={label} size={30} />
      <Text numberOfLines={2} style={styles.teamName}>{label}</Text>
      {seedLabel ? <Text numberOfLines={1} style={styles.seedLabel}>{seedLabel}</Text> : null}
    </View>
    <View style={styles.scoreControls}>
      <IconButton label={`Diminuir ${label}`} onPress={onDec}>
        <Minus color={colors.text} size={18} />
      </IconButton>
      <View style={styles.scoreValueBox}>
        <Text style={styles.scoreValue}>{value}</Text>
      </View>
      <IconButton label={`Aumentar ${label}`} onPress={onInc}>
        <Plus color={colors.text} size={18} />
      </IconButton>
    </View>
  </View>
);

const PlayerPicker = ({
  label,
  match,
  onChange,
  players,
  selectedPlayerId
}: {
  label: string;
  match: Match;
  onChange: (value: { player: Player | null }) => void;
  players: Player[];
  selectedPlayerId?: string | null;
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all");
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("ALL");
  const selectedPlayer = (players.find((player) => player.id === selectedPlayerId) as PickerPlayer | undefined) ?? null;
  const homeSide: MatchSide = { code: match.home_team_code, id: "home", name: match.home_team };
  const awaySide: MatchSide = { code: match.away_team_code, id: "away", name: match.away_team };
  const display = selectedPlayer?.name ?? "Selecionar jogador";
  const allPlayers = useMemo(
    () => sortPickerPlayers(dedupePlayersForRender(players as PickerPlayer[])),
    [players],
  );
  const teamTabs = useMemo(() => [
    { id: "all" as const, label: "Todos", value: allPlayers.length },
    {
      id: "home" as const,
      label: getTeamDisplayName(match.home_team),
      value: allPlayers.filter((player) => teamSideMatchesPlayer(player, homeSide)).length,
    },
    {
      id: "away" as const,
      label: getTeamDisplayName(match.away_team),
      value: allPlayers.filter((player) => teamSideMatchesPlayer(player, awaySide)).length,
    },
  ], [allPlayers, match.away_team, match.away_team_code, match.home_team, match.home_team_code]);
  const teamFilteredPlayers = useMemo(() => {
    if (teamFilter === "home") return allPlayers.filter((player) => teamSideMatchesPlayer(player, homeSide));
    if (teamFilter === "away") return allPlayers.filter((player) => teamSideMatchesPlayer(player, awaySide));
    return allPlayers;
  }, [allPlayers, match.away_team, match.away_team_code, match.home_team, match.home_team_code, teamFilter]);
  const positionCounts = useMemo(() => {
    const counts = new Map<PositionGroupKey, number>();
    teamFilteredPlayers.forEach((player) => {
      const group = playerPositionGroup(player);
      counts.set(group, (counts.get(group) ?? 0) + 1);
    });
    return counts;
  }, [teamFilteredPlayers]);
  const hasReservePlayers = (positionCounts.get("RS") ?? 0) > 0;
  const positionChipOptions = POSITION_FILTERS.filter((position) => position !== "RS" || hasReservePlayers);
  const visiblePlayers = useMemo(() => {
    const normalizedQuery = normalize(query.trim());
    return teamFilteredPlayers.filter((player) => {
      const playerPosition = player.roster?.position ?? player.position ?? "";
      const playerGroup = playerPositionGroup(player);
      const shirtNumber = playerShirtNumber(player);
      const matchesPosition = positionFilter === "ALL" || playerGroup === positionFilter;
      const matchesSearch = !normalizedQuery || normalize([
        player.name,
        playerPosition,
        playerGroup,
        shirtNumber ? String(shirtNumber) : "",
      ].join(" ")).includes(normalizedQuery);

      return matchesPosition && matchesSearch;
    });
  }, [positionFilter, query, teamFilteredPlayers]);
  const sections = useMemo<PlayerSection[]>(
    () => POSITION_ORDER.flatMap((position) => {
      const data = visiblePlayers.filter((player) => playerPositionGroup(player) === position);
      return data.length ? [{ data, key: position, title: POSITION_LABELS[position] }] : [];
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
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.pickerButton}>
        <Text numberOfLines={1} style={[styles.pickerText, selectedPlayer && styles.pickerTextActive]}>
          {display}
        </Text>
        <UserRound color={colors.gold} size={17} />
      </Pressable>
      <Modal animationType="slide" transparent visible={open} onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>{label}</Text>
                <Text style={styles.modalTitle}>{formatMatchupDisplayName(match.home_team, match.away_team)}</Text>
              </View>
              <IconButton label="Fechar seletor" onPress={closeModal}>
                <X color={colors.text} size={18} />
              </IconButton>
            </View>
            <View style={styles.modalControls}>
              <View style={styles.searchBox}>
                <Search color={colors.muted} size={16} />
                <TextInput
                  onChangeText={setQuery}
                  placeholder="Buscar jogador"
                  placeholderTextColor={colors.muted}
                  style={styles.searchInput}
                  value={query}
                />
              </View>
              <View style={styles.filterBlock}>
                <Text style={styles.filterLabel}>Time</Text>
                <ScrollView
                  contentContainerStyle={styles.chipRow}
                  horizontal
                  keyboardShouldPersistTaps="handled"
                  showsHorizontalScrollIndicator={false}
                >
                  {teamTabs.map((tab) => {
                    const active = teamFilter === tab.id;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={tab.id}
                        onPress={() => setTeamFilter(tab.id)}
                        style={[styles.filterChip, active && styles.filterChipActive]}
                      >
                        <Text numberOfLines={1} style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                          {tab.label}
                        </Text>
                        <Text style={[styles.filterChipCount, active && styles.filterChipCountActive]}>{tab.value}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
              <View style={styles.filterBlock}>
                <Text style={styles.filterLabel}>Posição</Text>
                <ScrollView
                  contentContainerStyle={styles.chipRow}
                  horizontal
                  keyboardShouldPersistTaps="handled"
                  showsHorizontalScrollIndicator={false}
                >
                  {[{ id: "ALL" as const, label: "Todos", value: teamFilteredPlayers.length }, ...positionChipOptions.map((position) => ({
                    id: position,
                    label: POSITION_SHORT_LABELS[position],
                    value: positionCounts.get(position) ?? 0,
                  }))].map((chip) => {
                    const active = positionFilter === chip.id;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={chip.id}
                        onPress={() => setPositionFilter(chip.id)}
                        style={[styles.filterChip, active && styles.filterChipActive]}
                      >
                        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{chip.label}</Text>
                        <Text style={[styles.filterChipCount, active && styles.filterChipCountActive]}>{chip.value}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
            <SectionList
              contentContainerStyle={styles.playerListContent}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(item) => playerDedupKey(item)}
              ListEmptyComponent={(
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateTitle}>Nenhum jogador encontrado</Text>
                  <Text style={styles.emptyStateSubtitle}>Tente buscar por outro nome ou limpar os filtros.</Text>
                  <Pressable accessibilityRole="button" onPress={resetFilters} style={styles.emptyResetButton}>
                    <Text style={styles.emptyResetText}>Limpar filtros</Text>
                  </Pressable>
                </View>
              )}
              renderItem={({ item }) => {
                const active = item.id === selectedPlayerId;
                const shirtNumber = playerShirtNumber(item);
                const side = matchSideForPlayer(item, match);
                const metaParts = [
                  playerPositionLabel(item),
                  teamFilter === "all" ? getTeamDisplayName(side?.name ?? item.team_name) : null,
                ].filter(Boolean);

                return (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      onChange({ player: item });
                      closeModal();
                    }}
                    style={({ pressed }) => [
                      styles.playerRow,
                      active && styles.playerRowActive,
                      pressed && !active && styles.playerRowPressed,
                    ]}
                  >
                    <View style={[styles.playerNumberBadge, active && styles.playerNumberBadgeActive]}>
                      <Text style={[styles.playerNumberText, active && styles.playerNameActive]}>
                        {shirtNumber ?? "--"}
                      </Text>
                    </View>
                    <View style={styles.playerInfo}>
                      <Text numberOfLines={1} style={[styles.playerName, active && styles.playerNameActive]}>{item.name}</Text>
                      <Text numberOfLines={1} style={[styles.playerMeta, active && styles.playerNameActive]}>
                        {metaParts.join(" • ")}
                      </Text>
                    </View>
                    {isReservePlayer(item) ? (
                      <View style={[styles.reserveTag, active && styles.reserveTagActive]}>
                        <Text style={[styles.reserveTagText, active && styles.playerNameActive]}>RS</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              }}
              renderSectionHeader={({ section }) => (
                <View style={styles.playerSectionHeader}>
                  <Text style={styles.playerGroupTitle}>{section.title}</Text>
                  <Text style={styles.playerSectionCount}>{section.data.length}</Text>
                </View>
              )}
              sections={sections}
              showsVerticalScrollIndicator={false}
              stickySectionHeadersEnabled
              style={styles.playerList}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const SummaryItem = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.summaryItem}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text numberOfLines={1} style={styles.summaryValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  headerText: {
    flex: 1,
    gap: spacing.xs
  },
  eyebrow: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  matchInfo: {
    alignItems: "center",
    backgroundColor: "rgba(11, 15, 25, 0.42)",
    borderColor: "rgba(246, 211, 101, 0.12)",
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  matchInfoText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700"
  },
  undefinedTeamsBox: {
    backgroundColor: "rgba(212, 175, 55, 0.10)",
    borderColor: "rgba(246, 211, 101, 0.22)",
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 4,
    marginTop: spacing.md,
    padding: spacing.sm
  },
  undefinedTeamsTitle: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: "900"
  },
  undefinedTeamsText: {
    color: colors.mutedStrong,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18
  },
  confirmed: {
    alignItems: "center",
    backgroundColor: "rgba(11, 15, 25, 0.42)",
    borderColor: "rgba(246, 211, 101, 0.18)",
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.xl
  },
  confirmedTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  confirmedScore: {
    color: colors.gold,
    fontSize: 38,
    fontWeight: "900"
  },
  confirmedBody: {
    color: colors.muted,
    textAlign: "center"
  },
  scoreInput: {
    alignItems: "center",
    backgroundColor: "rgba(11, 15, 25, 0.34)",
    borderColor: "rgba(246, 211, 101, 0.16)",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    marginTop: spacing.xl,
    padding: spacing.sm
  },
  teamSection: {
    alignItems: "center",
    backgroundColor: "rgba(24, 33, 49, 0.72)",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    gap: spacing.sm,
    padding: spacing.sm
  },
  teamHeading: {
    alignItems: "center",
    gap: spacing.xs
  },
  teamName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
    minHeight: 38,
    textAlign: "center"
  },
  seedLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center"
  },
  scoreControls: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs
  },
  scoreValueBox: {
    alignItems: "center",
    backgroundColor: "rgba(212, 175, 55, 0.12)",
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 58,
    justifyContent: "center",
    width: 64
  },
  scoreValue: {
    color: colors.gold,
    fontSize: 32,
    fontWeight: "900"
  },
  vs: {
    color: colors.gold,
    fontSize: 22,
    fontWeight: "900",
    paddingTop: 48
  },
  ruleBox: {
    backgroundColor: "rgba(11, 15, 25, 0.42)",
    borderColor: "rgba(246, 211, 101, 0.14)",
    borderRadius: radius.sm,
    borderWidth: 1,
    marginVertical: spacing.lg,
    padding: spacing.sm
  },
  rule: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center"
  },
  autoResultBox: {
    backgroundColor: "rgba(212, 175, 55, 0.10)",
    borderColor: "rgba(246, 211, 101, 0.20)",
    borderRadius: radius.sm,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.sm
  },
  autoResultText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
    marginTop: spacing.xs
  },
  fieldGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  field: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 140
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900"
  },
  disabledMarketBox: {
    alignItems: "center",
    backgroundColor: "rgba(11, 15, 25, 0.52)",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: spacing.sm
  },
  disabledMarketText: {
    color: colors.mutedStrong,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center"
  },
  pickerButton: {
    alignItems: "center",
    backgroundColor: "rgba(11, 15, 25, 0.52)",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    minHeight: 46,
    paddingHorizontal: spacing.sm
  },
  pickerText: {
    color: colors.muted,
    flex: 1,
    fontSize: 14,
    fontWeight: "800"
  },
  pickerTextActive: {
    color: colors.text
  },
  modalBackdrop: {
    backgroundColor: "rgba(0,0,0,0.72)",
    flex: 1,
    justifyContent: "flex-end",
    padding: spacing.md
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    borderWidth: 1,
    maxHeight: "88%",
    overflow: "hidden"
  },
  modalHeader: {
    alignItems: "flex-start",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2
  },
  modalControls: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing.sm,
    padding: spacing.md
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: "rgba(11, 15, 25, 0.52)",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    minHeight: 44
  },
  filterBlock: {
    gap: spacing.xs
  },
  filterLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  chipRow: {
    gap: spacing.xs,
    paddingRight: spacing.md
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: "rgba(11, 15, 25, 0.52)",
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 34,
    paddingHorizontal: spacing.sm
  },
  filterChipActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold
  },
  filterChipText: {
    color: colors.mutedStrong,
    fontSize: 12,
    fontWeight: "900",
    maxWidth: 130
  },
  filterChipTextActive: {
    color: colors.black
  },
  filterChipCount: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "900"
  },
  filterChipCountActive: {
    color: colors.black
  },
  playerList: {
    flexGrow: 0
  },
  playerListContent: {
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm
  },
  playerSectionHeader: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: spacing.xs,
    paddingTop: spacing.sm
  },
  playerGroupTitle: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  playerSectionCount: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900"
  },
  playerRow: {
    alignItems: "center",
    backgroundColor: "rgba(11, 15, 25, 0.44)",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  playerRowActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold
  },
  playerRowPressed: {
    backgroundColor: "rgba(246, 211, 101, 0.08)",
    borderColor: colors.borderGoldStrong
  },
  playerNumberBadge: {
    alignItems: "center",
    backgroundColor: "rgba(246, 211, 101, 0.10)",
    borderColor: colors.borderGold,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 42
  },
  playerNumberBadgeActive: {
    backgroundColor: "rgba(5, 7, 13, 0.12)",
    borderColor: "rgba(5, 7, 13, 0.28)"
  },
  playerNumberText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: "900"
  },
  playerInfo: {
    flex: 1,
    minWidth: 0
  },
  playerName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  playerNameActive: {
    color: colors.black
  },
  playerMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2
  },
  reserveTag: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.borderGoldStrong,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3
  },
  reserveTagActive: {
    backgroundColor: "rgba(5, 7, 13, 0.12)",
    borderColor: "rgba(5, 7, 13, 0.28)"
  },
  reserveTagText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "900"
  },
  emptyState: {
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl
  },
  emptyStateTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center"
  },
  emptyStateSubtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    textAlign: "center"
  },
  emptyResetButton: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.borderGoldStrong,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  emptyResetText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900"
  },
  summaryBox: {
    backgroundColor: "rgba(11, 15, 25, 0.42)",
    borderColor: "rgba(246, 211, 101, 0.16)",
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.sm
  },
  summaryTitle: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  summaryItem: {
    backgroundColor: "rgba(24, 33, 49, 0.72)",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: 120,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  summaryValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 2
  }
});
