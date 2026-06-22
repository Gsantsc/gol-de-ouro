import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { CheckCircle2, Clock, Minus, Plus, Search, Send, UserRound, X } from "lucide-react-native";
import type { Match, Player, Prediction, PredictionWinner } from "../shared";
import {
  PREDICTION_SCORE_MAX,
  PREDICTION_SCORE_MIN,
  canSubmitPrediction,
  formatDateTimePtBr,
  formatMatchupDisplayName,
  getTeamDisplayName,
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

const matchTeam = (player: Player, teamName: string) =>
  normalizeTeamNameWithAliases(player.team_name) === normalizeTeamNameWithAliases(teamName);

const isPlaceholderTeam = (teamName: string) =>
  /^(TBD|Winner |Loser |Runner-up |Third Place )/i.test(teamName.trim());

const boolLabel = (value: boolean) => (value ? "Sim" : "Não");

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
  const [winner, setWinner] = useState<PredictionWinner>(
    prediction?.predicted_winner ?? predictionOutcome({
      awayScore: prediction?.predicted_away_score ?? 0,
      homeScore: prediction?.predicted_home_score ?? 0
    })
  );
  const [firstScorerId, setFirstScorerId] = useState<string | null>(prediction?.predicted_first_scorer_id ?? null);
  const [firstGoalNoGoals, setFirstGoalNoGoals] = useState(Boolean(prediction?.predicted_first_goal_no_goals));
  const [bothTeamsScore, setBothTeamsScore] = useState(prediction?.predicted_both_teams_score ?? false);
  const [manOfMatchId, setManOfMatchId] = useState<string | null>(prediction?.predicted_man_of_match_id ?? null);
  const [redCard, setRedCard] = useState(prediction?.predicted_red_card ?? false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const predictionAccess = canSubmitPrediction(match, profile, new Date(), predictionLockMinutes);
  const canSubmit = predictionAccess.allowed;
  const firstScorerPlayer = players.find((player) => player.id === firstScorerId) ?? null;
  const manOfMatchPlayer = players.find((player) => player.id === manOfMatchId) ?? null;
  const homeTeamName = getTeamDisplayName(match.home_team);
  const awayTeamName = getTeamDisplayName(match.away_team);
  const firstScorerLabel = firstGoalNoGoals ? "Sem gols" : firstScorerPlayer?.name ?? "Não selecionado";
  const manOfMatchLabel = manOfMatchPlayer?.name ?? "Não selecionado";

  const validateBeforeSubmit = () => {
    if (!profile) return "Sessão expirada. Entre novamente.";
    if (!canSubmit) return predictionAccess.message;
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
      return "Preencha o placar para enviar seu palpite.";
    }
    if (!winner) return "Selecione o vencedor para continuar.";
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
        winner,
        firstScorer: null,
        firstScorerId,
        firstGoalNoGoals,
        bothTeamsScore,
        manOfMatch: null,
        manOfMatchId,
        redCard
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
                teamName={match.home_team}
                value={homeScore}
              />
              <Text style={styles.vs}>x</Text>
              <Stepper
                label={awayTeamName}
                logoUrl={match.away_team_logo_url}
                onDec={() => setAwayScore((value) => clampPredictionScore(value - 1))}
                onInc={() => setAwayScore((value) => clampPredictionScore(value + 1))}
                teamName={match.away_team}
                value={awayScore}
              />
            </View>

            <View style={styles.ruleBox}>
              <Text style={styles.rule}>
                Palpites abrem 24h antes e podem ser editados ate {predictionLockMinutes} minutos antes da partida.
              </Text>
            </View>

            <View style={styles.marketSection}>
              <Text style={styles.marketTitle}>Vencedor</Text>
              <View style={styles.choiceGrid}>
                <ChoiceButton active={winner === "home"} label={homeTeamName} onPress={() => setWinner("home")} />
                <ChoiceButton active={winner === "draw"} label="Empate" onPress={() => setWinner("draw")} />
                <ChoiceButton active={winner === "away"} label={awayTeamName} onPress={() => setWinner("away")} />
              </View>
            </View>

            <View style={styles.fieldGrid}>
              <PlayerPicker
                label="Primeiro jogador a marcar"
                match={match}
                noGoals={firstGoalNoGoals}
                onChange={({ noGoals, player }) => {
                  setFirstGoalNoGoals(Boolean(noGoals));
                  setFirstScorerId(player?.id ?? null);
                }}
                players={players}
                selectedPlayerId={firstScorerId}
                showNoGoals
              />
              <PlayerPicker
                label="Homem do jogo"
                match={match}
                onChange={({ player }) => setManOfMatchId(player?.id ?? null)}
                players={players}
                selectedPlayerId={manOfMatchId}
              />
            </View>

            <View style={styles.fieldGrid}>
              <ToggleChoice label="Ambos marcam" onChange={setBothTeamsScore} value={bothTeamsScore} />
              <ToggleChoice label="Cartão vermelho" onChange={setRedCard} value={redCard} />
            </View>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>Resumo do palpite</Text>
              <View style={styles.summaryGrid}>
                <SummaryItem label="Placar" value={`${homeScore} x ${awayScore}`} />
                <SummaryItem label="Vencedor" value={winner === "home" ? homeTeamName : winner === "away" ? awayTeamName : "Empate"} />
                <SummaryItem label="Primeiro jogador" value={firstScorerLabel} />
                <SummaryItem label="Homem do jogo" value={manOfMatchLabel} />
                <SummaryItem label="Ambos marcam" value={boolLabel(bothTeamsScore)} />
                <SummaryItem label="Cartão vermelho" value={boolLabel(redCard)} />
              </View>
            </View>

            <AppButton
              disabled={!canSubmit}
              icon={<Send color={colors.black} size={18} />}
              loading={loading}
              onPress={submit}
              title={canSubmit ? prediction ? "Salvar edição" : "Confirmar palpite" : predictionAccess.message}
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
  teamName,
  value,
  onDec,
  onInc
}: {
  label: string;
  logoUrl?: string | null;
  teamName: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
}) => (
  <View style={styles.teamSection}>
    <View style={styles.teamHeading}>
      <TeamFlag logoUrl={logoUrl} name={teamName} size={30} />
      <Text numberOfLines={2} style={styles.teamName}>{label}</Text>
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

const ChoiceButton = ({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) => (
  <Pressable accessibilityRole="button" onPress={onPress} style={[styles.choiceButton, active && styles.choiceButtonActive]}>
    <Text numberOfLines={2} style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
  </Pressable>
);

const PlayerPicker = ({
  label,
  match,
  noGoals = false,
  onChange,
  players,
  selectedPlayerId,
  showNoGoals = false
}: {
  label: string;
  match: Match;
  noGoals?: boolean;
  onChange: (value: { noGoals?: boolean; player: Player | null }) => void;
  players: Player[];
  selectedPlayerId?: string | null;
  showNoGoals?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) ?? null;
  const filtered = (teamName: string) =>
    players
      .filter((player) => player.active && matchTeam(player, teamName))
      .filter((player) => normalize(`${player.name} ${player.position ?? ""}`).includes(normalize(query)))
      .sort((left, right) => left.name.localeCompare(right.name));
  const groups = [
    { name: match.home_team, players: filtered(match.home_team) },
    { name: match.away_team, players: filtered(match.away_team) }
  ];
  const display = noGoals ? "Sem gols" : selectedPlayer?.name ?? "Selecionar jogador";

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.pickerButton}>
        <Text numberOfLines={1} style={[styles.pickerText, (selectedPlayer || noGoals) && styles.pickerTextActive]}>
          {display}
        </Text>
        <UserRound color={colors.gold} size={17} />
      </Pressable>
      <Modal animationType="slide" transparent visible={open} onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>{label}</Text>
                <Text style={styles.modalTitle}>{formatMatchupDisplayName(match.home_team, match.away_team)}</Text>
              </View>
              <IconButton label="Fechar seletor" onPress={() => setOpen(false)}>
                <X color={colors.text} size={18} />
              </IconButton>
            </View>
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
            <ScrollView style={styles.playerList}>
              {showNoGoals ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onChange({ noGoals: true, player: null });
                    setOpen(false);
                  }}
                  style={[styles.playerRow, noGoals && styles.playerRowActive]}
                >
                  <Text style={[styles.playerName, noGoals && styles.playerNameActive]}>Sem gols</Text>
                  <Text style={[styles.playerMeta, noGoals && styles.playerNameActive]}>0 x 0</Text>
                </Pressable>
              ) : null}
              {groups.map((group) => (
                <View key={group.name} style={styles.playerGroup}>
                  <Text style={styles.playerGroupTitle}>{getTeamDisplayName(group.name)}</Text>
                  {isPlaceholderTeam(group.name) ? (
                    <Text style={styles.emptyPlayers}>Jogadores disponiveis apos definicao da equipe.</Text>
                  ) : group.players.length ? group.players.map((player) => {
                    const active = player.id === selectedPlayerId && !noGoals;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={player.id}
                        onPress={() => {
                          onChange({ noGoals: false, player });
                          setOpen(false);
                        }}
                        style={[styles.playerRow, active && styles.playerRowActive]}
                      >
                        <Text style={[styles.playerName, active && styles.playerNameActive]}>{player.name}</Text>
                        <Text style={[styles.playerMeta, active && styles.playerNameActive]}>
                          {[player.position, player.shirt_number ? `#${player.shirt_number}` : null].filter(Boolean).join(" · ") || "Elenco"}
                        </Text>
                      </Pressable>
                    );
                  }) : (
                    <Text style={styles.emptyPlayers}>Nenhum jogador encontrado.</Text>
                  )}
                </View>
              ))}
            </ScrollView>
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

const ToggleChoice = ({
  label,
  onChange,
  value
}: {
  label: string;
  onChange: (value: boolean) => void;
  value: boolean;
}) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={styles.toggleRow}>
      <ChoiceButton active={value} label="Sim" onPress={() => onChange(true)} />
      <ChoiceButton active={!value} label="Não" onPress={() => onChange(false)} />
    </View>
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
  marketSection: {
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  marketTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  choiceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  choiceButton: {
    alignItems: "center",
    backgroundColor: "rgba(24, 33, 49, 0.72)",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 86,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  choiceButtonActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold
  },
  choiceText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center"
  },
  choiceTextActive: {
    color: colors.black
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
  searchBox: {
    alignItems: "center",
    backgroundColor: "rgba(11, 15, 25, 0.52)",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    margin: spacing.md,
    paddingHorizontal: spacing.sm
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    minHeight: 44
  },
  playerList: {
    paddingHorizontal: spacing.md
  },
  playerGroup: {
    gap: spacing.xs,
    marginBottom: spacing.md
  },
  playerGroupTitle: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  playerRow: {
    backgroundColor: "rgba(11, 15, 25, 0.44)",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  playerRowActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold
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
  emptyPlayers: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    paddingVertical: spacing.xs
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
  },
  toggleRow: {
    flexDirection: "row",
    gap: spacing.sm
  }
});
