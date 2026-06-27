"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Copy,
  Clock,
  Edit3,
  LogOut,
  Medal,
  Plus,
  RefreshCw,
  Search,
  Share2,
  ShieldAlert,
  Target,
  Trophy,
  User,
  UserPlus,
  Users
} from "lucide-react";
import type { Achievement, AppInvite, Group, GroupMember, Match, Player, Prediction, PredictionWinner, Profile, Ranking } from "@gol-de-ouro/shared";
import {
  MATCH_STATUS_LABELS,
  PREDICTION_SCORE_MAX,
  PREDICTION_SCORE_MIN,
  calculateMatchStatus,
  canSubmitPrediction,
  deriveUserPerformance,
  formatDateTimePtBr,
  formatMatchupDisplayName,
  getTeamDisplayName,
  readAuthError,
  readError
} from "@gol-de-ouro/shared";
import {
  createUserGroup,
  createUserAppInvite,
  getCurrentUserProfile,
  loadUserDashboardData,
  deactivateUserGroupInvite,
  regenerateUserGroupInvite,
  revokeUserAppInvite,
  signInUser,
  signOutUser,
  signUpUser,
  submitUserPrediction,
  type UserDashboardData
} from "@/lib/user-api";
import { supabase } from "@/lib/supabase";
import { BrandLogo } from "@/components/BrandLogo";
import { PlayerPicker } from "@/components/PlayerPicker";

type UserTab = "home" | "games" | "predictions" | "ranking" | "profile" | "groups";

const emptyData: UserDashboardData = {
  achievements: [],
  appInvites: [],
  groups: [],
  groupMembers: [],
  matches: [],
  notifications: [],
  players: [],
  predictions: [],
  ranking: [],
  settings: { prediction_lock_minutes: 60 },
  tournaments: []
};

const tabs: Array<{ id: UserTab; label: string; icon: typeof User }> = [
  { id: "home", label: "Home", icon: User },
  { id: "games", label: "Jogos", icon: CalendarDays },
  { id: "predictions", label: "Palpites", icon: CheckCircle2 },
  { id: "ranking", label: "Ranking", icon: Trophy },
  { id: "groups", label: "Ligas", icon: Users },
  { id: "profile", label: "Perfil", icon: Medal }
];

const normalizeName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const countryCodes: Record<string, string> = {
  algeria: "dz",
  argentina: "ar",
  australia: "au",
  austria: "at",
  belgium: "be",
  "bosnia-herzegovina": "ba",
  brazil: "br",
  canada: "ca",
  "cabo verde": "cv",
  "cote d'ivoire": "ci",
  curacao: "cw",
  czechia: "cz",
  ecuador: "ec",
  egypt: "eg",
  france: "fr",
  germany: "de",
  haiti: "ht",
  "ir iran": "ir",
  iraq: "iq",
  japan: "jp",
  jordan: "jo",
  "korea republic": "kr",
  mexico: "mx",
  morocco: "ma",
  netherlands: "nl",
  "new zealand": "nz",
  norway: "no",
  paraguay: "py",
  qatar: "qa",
  "saudi arabia": "sa",
  scotland: "gb-sct",
  senegal: "sn",
  "south africa": "za",
  spain: "es",
  sweden: "se",
  switzerland: "ch",
  tunisia: "tn",
  turkey: "tr",
  uruguay: "uy",
  usa: "us"
};

const stadiumCities: Record<string, string> = {
  "at&t stadium": "Arlington",
  "bc place": "Vancouver",
  "bmo field": "Toronto",
  "estadio akron": "Guadalajara",
  "estadio azteca": "Mexico City",
  "estadio bbva": "Monterrey",
  "gillette stadium": "Foxborough",
  "hard rock stadium": "Miami",
  "levi's stadium": "Santa Clara",
  "lincoln financial field": "Philadelphia",
  "lumen field": "Seattle",
  "mercedes-benz stadium": "Atlanta",
  "metlife stadium": "East Rutherford",
  "nrg stadium": "Houston",
  "sofi stadium": "Los Angeles"
};

const flagUrlForTeam = (name: string, fallback?: string | null) => {
  if (fallback) return fallback;
  const code = countryCodes[normalizeName(name)];
  return code ? `https://flagcdn.com/w80/${code}.png` : null;
};

const cityForStadium = (stadium?: string | null) =>
  stadium ? stadiumCities[normalizeName(stadium)] ?? null : null;

const predictionStatus = (prediction: Prediction, match?: Match) => {
  if (!match || match.status !== "encerrado") return "aguardando";
  return prediction.points > 0 ? "acertou" : "errou";
};

const statusClass = (status: string) => {
  if (status === "acertou") return "border-grass/50 bg-grass/10 text-grass";
  if (status === "errou") return "border-red-400/50 bg-red-500/10 text-red-100";
  return "border-gold/50 bg-gold/10 text-gold";
};

const countdownLabel = (dateValue?: string | null) => {
  if (!dateValue) return "Janela indefinida";
  const diff = new Date(dateValue).getTime() - Date.now();
  if (diff <= 0) return "Encerrado";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
};

const winnerLabel = (winner?: PredictionWinner | null, match?: Match) => {
  if (winner === "home") return getTeamDisplayName(match?.home_team) || "Casa";
  if (winner === "away") return getTeamDisplayName(match?.away_team) || "Visitante";
  if (winner === "draw") return "Empate";
  return "-";
};

const boolLabel = (value?: boolean | null) => {
  if (value === true) return "Sim";
  if (value === false) return "Não";
  return "-";
};

const marketText = (value?: string | null) => value?.trim() || "-";

const outcomeFromScore = (homeScore: number, awayScore: number): PredictionWinner => {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
};

const automaticOutcomeLabel = (winner: PredictionWinner, match: Match) => {
  if (winner === "home") return `Vitória do mandante (${getTeamDisplayName(match.home_team)})`;
  if (winner === "away") return `Vitória do visitante (${getTeamDisplayName(match.away_team)})`;
  return "Empate";
};

const normalizePredictionScore = (value: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return PREDICTION_SCORE_MIN;
  return Math.min(PREDICTION_SCORE_MAX, Math.max(PREDICTION_SCORE_MIN, Math.trunc(parsed)));
};

type PredictionSubmitPayload = {
  awayScore: number;
  firstScorer: string | null;
  firstScorerId: string | null;
  homeScore: number;
  manOfMatch: string | null;
  manOfMatchId: string | null;
};

export default function UserDashboardPage() {
  const [activeTab, setActiveTab] = useState<UserTab>("home");
  const [authLoading, setAuthLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<UserDashboardData>(emptyData);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab") as UserTab | null;
    if (requestedTab && tabs.some((tab) => tab.id === requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current;

    const task = (async () => {
      const nextProfile = await getCurrentUserProfile();
      setProfile(nextProfile);

      const status = nextProfile?.status ?? (nextProfile?.blocked ? "suspended" : nextProfile?.approval_status);
      if (!nextProfile || nextProfile.role === "admin" || status !== "approved" || nextProfile.blocked) {
        setData(emptyData);
        return;
      }

      setData(await loadUserDashboardData(nextProfile.id));
    })();

    refreshInFlightRef.current = task;
    try {
      await task;
    } finally {
      if (refreshInFlightRef.current === task) refreshInFlightRef.current = null;
    }
  }, []);

  useEffect(() => {
    refresh()
      .catch((nextError) => setError(readError(nextError)))
      .finally(() => setAuthLoading(false));

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setData(emptyData);
        return;
      }

      if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session?.user) {
        refresh().catch((nextError) => setError(readError(nextError)));
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, [refresh]);

  useEffect(() => {
    if (!profile || profile.role === "admin") return;
    const status = profile.status ?? (profile.blocked ? "suspended" : profile.approval_status);
    if (status !== "approved" || profile.blocked) return;

    const channel = supabase
      .channel("user-dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "predictions" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "rankings" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "achievements" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, refresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, refresh]);

  const worldCupMatches = useMemo(
    () => data.matches.filter((match) => match.championship === "world_cup_2026"),
    [data.matches],
  );
  const visibleMatches = worldCupMatches.length ? worldCupMatches : data.matches;
  const upcomingMatches = visibleMatches.filter((match) => match.status !== "encerrado");
  const homeMatches = upcomingMatches.length ? upcomingMatches : visibleMatches;
  const myRanking = data.ranking.find((item) => item.user_id === profile?.id) ?? null;
  const position = data.ranking.findIndex((item) => item.user_id === profile?.id);
  const positionLabel = position >= 0 ? `#${position + 1}` : "-";
  const predictionLockMinutes = data.settings.prediction_lock_minutes;

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    try {
      setBusy(true);
      setError(null);
      await action();
      await refresh();
    } catch (nextError) {
      setError(readError(nextError));
    } finally {
      setBusy(false);
    }
  };

  const verifyApproval = async () => {
    if (busy) return;
    try {
      setBusy(true);
      setError(null);
      await refresh();
    } catch (nextError) {
      setError(readError(nextError));
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return (
      <Shell>
        <div className="flex min-h-[70vh] items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-grass" />
        </div>
      </Shell>
    );
  }

  if (!profile) {
    return (
      <Shell>
        <AuthPanel error={error} onError={setError} onSuccess={refresh} />
      </Shell>
    );
  }

  if (profile.role === "admin") {
    return (
      <Shell>
        <div className="mx-auto max-w-lg panel p-6 shadow-panel">
          <ShieldAlert className="mb-4 h-10 w-10 text-gold" />
          <h1 className="text-2xl font-black">Sessão administrativa detectada</h1>
          <p className="mt-3 text-sm leading-6 text-white/65">
            O dashboard do usuário fica separado do painel administrativo. Entre com uma conta de usuário aprovada.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <a className="btn-secondary" href="/admin">Ir para Admin</a>
            <button className="btn-ghost" onClick={() => signOutUser()}>Sair</button>
          </div>
        </div>
      </Shell>
    );
  }

  const accessStatus = profile.status ?? (profile.blocked ? "suspended" : profile.approval_status);
  if (accessStatus !== "approved" || profile.blocked) {
    return (
      <Shell>
        <div className="mx-auto max-w-lg panel p-6 shadow-panel">
          <Clock className="mb-4 h-10 w-10 text-gold" />
          <h1 className="text-2xl font-black">Cadastro em análise</h1>
          <p className="mt-3 text-sm leading-6 text-white/65">
            Seu status atual é {accessStatus}. Nada entra automaticamente: o administrador precisa aprovar o acesso.
          </p>
          <p className="mt-2 text-sm leading-6 text-white/55">
            Depois da aprovação, clique em verificar ou entre novamente. O app não tenta login automaticamente.
          </p>
          {error && <ErrorBanner message={error} />}
          <div className="mt-6 flex flex-wrap gap-2">
            {accessStatus === "pending" && !profile.blocked && (
              <button className="btn-primary" disabled={busy} onClick={verifyApproval}>
                <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
                Verificar aprovação
              </button>
            )}
            <button className="btn-ghost" disabled={busy} onClick={() => signOutUser()}>
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <UserHeader
        onEditProfile={() => setActiveTab("profile")}
        position={positionLabel}
        predictionCount={data.predictions.length}
        profile={profile}
        ranking={myRanking}
      />

      {error && <ErrorBanner message={error} />}

      <nav className="nav-shell md:grid-cols-6" role="tablist">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              aria-selected={active}
              className={`tab-button ${active ? "tab-button-active" : "tab-button-idle"}`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {activeTab === "home" && (
        <HomePanel
          busy={busy}
          data={data}
          matches={homeMatches}
          onCreateAppInvite={() => run(() => createUserAppInvite().then(() => undefined))}
          onCreateGroup={(name, tournamentId) => run(() => createUserGroup(name, tournamentId))}
          onPredict={setSelectedMatch}
          onRevokeAppInvite={(inviteId) => run(() => revokeUserAppInvite(inviteId))}
          onViewGames={() => setActiveTab("games")}
          onViewGroups={() => setActiveTab("groups")}
          onViewPredictions={() => setActiveTab("predictions")}
          position={positionLabel}
          predictions={data.predictions}
          ranking={myRanking}
        />
      )}
      {activeTab === "games" && (
        <GamesPanel
          matches={visibleMatches}
          onPredict={setSelectedMatch}
          predictionLockMinutes={predictionLockMinutes}
          predictions={data.predictions}
        />
      )}
      {activeTab === "predictions" && (
        <PredictionsPanel
          matches={data.matches}
          players={data.players}
          predictionLockMinutes={predictionLockMinutes}
          predictions={data.predictions}
        />
      )}
      {activeTab === "ranking" && (
        <RankingPanel
          groups={data.groups}
          members={data.groupMembers}
          ranking={data.ranking}
          userId={profile.id}
        />
      )}
      {activeTab === "profile" && (
        <ProfilePanel
          matches={data.matches}
          achievements={data.achievements}
          onSignOut={() => signOutUser()}
          position={positionLabel}
          predictions={data.predictions}
          profile={profile}
          ranking={myRanking}
        />
      )}
      {activeTab === "groups" && (
        <UserGroupsPanel
          groups={data.groups}
          members={data.groupMembers}
          onDeactivateInvite={(groupId: string) => run(() => deactivateUserGroupInvite(groupId))}
          onRegenerateInvite={(groupId: string) => run(() => regenerateUserGroupInvite(groupId))}
          ranking={data.ranking}
          userId={profile.id}
        />
      )}

      {selectedMatch && profile && (
        <PredictionDialog
          match={selectedMatch}
          onClose={() => setSelectedMatch(null)}
          players={data.players}
          predictionLockMinutes={predictionLockMinutes}
          prediction={data.predictions.find((prediction) => prediction.match_id === selectedMatch.id)}
          onSubmit={(payload) =>
            run(async () => {
              await submitUserPrediction({
                ...payload,
                matchId: selectedMatch.id,
                userId: profile.id
              });
              setSelectedMatch(null);
              setActiveTab("predictions");
            })
          }
        />
      )}
    </Shell>
  );
}

const Shell = ({ children }: { children: React.ReactNode }) => (
  <main className="app-shell">
    <div className="mx-auto w-full max-w-7xl">{children}</div>
  </main>
);

const AuthPanel = ({
  error,
  onError,
  onSuccess
}: {
  error: string | null;
  onError: (message: string | null) => void;
  onSuccess: () => Promise<void>;
}) => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submittingRef.current) return;

    try {
      submittingRef.current = true;
      setLoading(true);
      setNotice(null);
      onError(null);
      if (mode === "login") {
        await signInUser(email, password);
      } else {
        const result = await signUpUser({ email, name, password });
        if (!result.session) {
          setNotice("Cadastro criado. Confirme o email, se o Supabase local exigir confirmação.");
        }
      }
      await onSuccess();
    } catch (nextError) {
      onError(readAuthError(nextError));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const changeMode = (nextMode: "login" | "signup") => {
    if (loading) return;
    setMode(nextMode);
    setNotice(null);
    onError(null);
  };

  return (
    <form className="mx-auto mt-12 max-w-md panel p-6 shadow-panel" onSubmit={submit}>
      <BrandLogo />
      <h1 className="mt-5 text-3xl font-black">Acesse sua liga</h1>
      <p className="mt-2 text-sm leading-6 text-white/65">Área do usuário para jogos, palpites, ligas e ranking.</p>

      {error && <ErrorBanner className="mt-5" message={error} />}

      <div className="mt-6 grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-pitch-950/60 p-1">
        <button
          className={`rounded-md px-3 py-2 text-sm font-black ${mode === "login" ? "bg-gold text-black" : "text-white/65"}`}
          disabled={loading}
          onClick={() => changeMode("login")}
          type="button"
        >
          Entrar
        </button>
        <button
          className={`rounded-md px-3 py-2 text-sm font-black ${mode === "signup" ? "bg-gold text-black" : "text-white/65"}`}
          disabled={loading}
          onClick={() => changeMode("signup")}
          type="button"
        >
          Criar conta
        </button>
      </div>

      {mode === "signup" && (
        <>
          <label className="mt-6 block text-sm font-bold text-white/70">Nome</label>
          <input className="input mt-2 w-full" onChange={(event) => setName(event.target.value)} value={name} />
        </>
      )}
      <label className="mt-6 block text-sm font-bold text-white/70">Email</label>
      <input className="input mt-2 w-full" onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
      <label className="mt-4 block text-sm font-bold text-white/70">Senha</label>
      <input
        className="input mt-2 w-full"
        onChange={(event) => setPassword(event.target.value)}
        type="password"
        value={password}
      />
      <button className="btn-primary mt-6 w-full" disabled={loading || !email || !password || (mode === "signup" && !name)}>
        {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
      </button>
      {notice && <p className="mt-4 text-sm font-bold text-gold">{notice}</p>}
    </form>
  );
};

const UserHeader = ({
  onEditProfile,
  position,
  predictionCount,
  profile,
  ranking
}: {
  onEditProfile: () => void;
  position: string;
  predictionCount: number;
  profile: Profile;
  ranking: Ranking | null;
}) => {
  const initials = profile.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="mb-6 panel p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-gold text-xl font-black text-black">
            {initials}
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-normal text-gold">Área do usuário</p>
            <h1 className="mt-1 text-3xl font-black">{profile.name}</h1>
            <p className="mt-1 text-sm text-white/60">{profile.email}</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <Metric label="Ranking" value={position} />
          <Metric label="Pontos" value={ranking?.total_points ?? 0} />
          <Metric label="Palpites" value={predictionCount} />
          <button className="btn-ghost" onClick={onEditProfile}>
            <Edit3 className="h-4 w-4" />
            Editar perfil
          </button>
        </div>
      </div>
    </header>
  );
};

const Metric = ({ label, value }: { label: string; value: number | string }) => (
  <div className="metric-card px-4 py-3">
    <p className="text-2xl font-black text-gold">{value}</p>
    <p className="text-xs font-bold text-white/55">{label}</p>
  </div>
);

const HomeTeamFlag = ({ logoUrl, name }: { logoUrl?: string | null; name: string }) => {
  const src = flagUrlForTeam(name, logoUrl);
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-pitch-950/60">
      {src ? (
        <img alt="" className="h-full w-full object-cover" src={src} />
      ) : (
        <span className="text-sm font-black text-gold">{name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
};

const BadgeRow = ({ active, label, value }: { active: boolean; label: string; value: string }) => (
  <div className={`rounded-md border p-3 ${active ? "border-gold/35 bg-gold/10" : "border-white/10 bg-white/[0.035]"}`}>
    <p className={`text-sm font-black ${active ? "text-gold" : "text-white/65"}`}>{label}</p>
    <p className="mt-1 text-xs font-bold text-white/45">{value}</p>
  </div>
);

const HomePanel = ({
  busy,
  data,
  matches,
  onCreateAppInvite,
  onCreateGroup,
  onPredict,
  onRevokeAppInvite,
  onViewGames,
  onViewGroups,
  onViewPredictions,
  position,
  predictions,
  ranking
}: {
  busy: boolean;
  data: UserDashboardData;
  matches: Match[];
  onCreateAppInvite: () => Promise<void>;
  onCreateGroup: (name: string, tournamentId: string) => Promise<void>;
  onPredict: (match: Match) => void;
  onRevokeAppInvite: (inviteId: string) => Promise<void>;
  onViewGames: () => void;
  onViewGroups: () => void;
  onViewPredictions: () => void;
  position: string;
  predictions: Prediction[];
  ranking: Ranking | null;
}) => {
  const [groupName, setGroupName] = useState("");
  const now = new Date();
  const lockMinutes = data.settings.prediction_lock_minutes;
  const worldCupTournamentId =
    data.tournaments.find((tournament) => tournament.slug === "world_cup_2026")?.id ?? data.tournaments[0]?.id;
  const predictedMatchIds = new Set(predictions.map((prediction) => prediction.match_id));
  const performance = deriveUserPerformance({ matches: data.matches, predictions, ranking });
  const statusOf = (match: Match) => calculateMatchStatus(match, now, lockMinutes);
  const openMatches = matches.filter((match) => statusOf(match) === "aberto");
  const nextMatch = openMatches.find((match) => !predictedMatchIds.has(match.id)) ?? openMatches[0] ?? matches[0] ?? null;
  const pendingPredictions = matches.filter(
    (match) => statusOf(match) === "aberto" && !predictedMatchIds.has(match.id),
  ).length;
  const activeGroups = data.groups.filter((group) => !group.closed_at);
  const liveMatches = data.matches.filter((match) => statusOf(match) === "ao_vivo").slice(0, 3);
  const topRanking = data.ranking.slice(0, 10);
  const nextMatches = matches
    .filter((match) => statusOf(match) !== "encerrado")
    .slice(0, 5);
  const finishedMatches = [...data.matches]
    .filter((match) => statusOf(match) === "encerrado")
    .sort((left, right) => new Date(right.start_time).getTime() - new Date(left.start_time).getTime())
    .slice(0, 3);
  const exactBadges = ranking?.exact_scores ?? 0;
  const leaderBadge = position === "#1";
  const userCount = Math.max(data.ranking.length, data.groupMembers.length ? new Set(data.groupMembers.map((member) => member.user_id)).size : 0);
  const totalHits = data.ranking.reduce((sum, item) => sum + (item.correct_results ?? 0), 0);
  const stats = [
    { label: "Usuários", value: userCount },
    { label: "Palpites", value: predictions.length },
    { label: "Jogos", value: data.matches.length },
    { label: "Acertos", value: totalHits || performance.correctResults }
  ];
  const derivedNotifications = [
    ranking?.total_points ? `Você já somou ${ranking.total_points} pontos no ranking.` : null,
    position !== "-" ? `Você está na posição ${position}.` : null,
    nextMatch ? `Palpites para ${formatMatchupDisplayName(nextMatch.home_team, nextMatch.away_team)} encerram em ${countdownLabel(nextMatch.prediction_close_at)}.` : null
  ].filter(Boolean) as string[];
  const showOnboarding = !predictions.length && !data.groups.length;
  const activeAppInvite = data.appInvites.find((invite: AppInvite) => invite.status === "pending");

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-lg border border-gold/20 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.20),transparent_32%),linear-gradient(135deg,rgba(18,24,38,0.98),rgba(6,10,18,0.98))] p-5 shadow-panel sm:p-7 lg:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-normal text-gold">Gol de Ouro Beta 1.0</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-black leading-tight text-white sm:text-5xl">
              Mostre quem realmente entende de futebol.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
              Palpites, ranking em tempo real e disputa entre amigos.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button className="btn-primary w-full sm:w-auto" onClick={onViewGames} type="button">
                <CalendarDays className="h-4 w-4" />
                Entrar
              </button>
              <button className="btn-ghost w-full sm:w-auto" onClick={onViewGroups} type="button">
                <UserPlus className="h-4 w-4" />
                Cadastrar
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="pontos" value={ranking?.total_points ?? 0} />
            <Metric label="posição" value={position} />
            <Metric label="palpites pendentes" value={pendingPredictions} />
            <Metric label="fechamento" value={`${lockMinutes} min`} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <Metric key={item.label} label={item.label} value={item.value} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="panel p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SectionHeading title="Próximos jogos" />
            <button className="btn-ghost w-full sm:w-auto" onClick={onViewGames} type="button">
              Ver todos
            </button>
          </div>
          {nextMatches.length ? (
            <div className="space-y-3">
              {nextMatches.map((match) => {
                const predictionAccess = canSubmitPrediction(match, null, now, lockMinutes);
                const alreadyPredicted = predictedMatchIds.has(match.id);
                return (
                  <article className="rounded-lg border border-white/10 bg-white/[0.035] p-4" key={match.id}>
                    <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-3">
                          <HomeTeamFlag name={match.home_team} logoUrl={match.home_team_logo_url} />
                          <div className="min-w-0 flex-1 text-center">
                            <p className="truncate text-sm font-black text-white">{getTeamDisplayName(match.home_team)}</p>
                            <p className="text-xs font-black uppercase text-gold">x</p>
                            <p className="truncate text-sm font-black text-white">{getTeamDisplayName(match.away_team)}</p>
                          </div>
                          <HomeTeamFlag name={match.away_team} logoUrl={match.away_team_logo_url} />
                        </div>
                        <p className="mt-3 text-xs font-bold text-white/55">{formatDateTimePtBr(match.start_time)}</p>
                        <p className="mt-1 text-xs font-bold text-white/45">
                          Palpites encerram em {countdownLabel(match.prediction_close_at)}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 md:min-w-[170px]">
                        <span className="badge badge-gold justify-center">{MATCH_STATUS_LABELS[statusOf(match)]}</span>
                        {alreadyPredicted ? (
                          <span className="rounded-md border border-grass/30 bg-grass/10 px-3 py-2 text-center text-xs font-black text-grass">
                            Palpite enviado
                          </span>
                        ) : (
                          <button
                            className="btn-primary w-full"
                            disabled={!predictionAccess.allowed}
                            onClick={() => onPredict(match)}
                            type="button"
                          >
                            {predictionAccess.allowed ? "Palpitar" : "Encerrado"}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyBlock title="Sem próximos jogos" body="Assim que novas partidas forem cadastradas, elas aparecem aqui." />
          )}
        </div>

        <div className="panel p-5">
          <SectionHeading title="Ranking Top 10" />
          <div className="mt-4 space-y-2">
            {topRanking.length ? (
              topRanking.map((item, index) => (
                <div className="grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-md border border-white/10 bg-white/[0.035] px-3 py-2" key={item.id}>
                  <span className="font-black text-gold">#{index + 1}</span>
                  <span className="min-w-0 truncate text-sm font-black text-white/80">{item.user?.name ?? "Participante"}</span>
                  <span className="text-sm font-black text-grass">{item.total_points} pts</span>
                </div>
              ))
            ) : (
              <EmptyBlock title="Ranking vazio" body="O ranking começa a andar quando os primeiros jogos forem pontuados." />
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="panel p-5 lg:col-span-2">
          <SectionHeading title="Como funciona" />
          <div className="mt-4 grid gap-3 sm:grid-cols-5">
            {["Cadastro", "Aprovação", "Palpite", "Pontuação", "Ranking"].map((step, index) => (
              <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4" key={step}>
                <p className="text-xl font-black text-gold">{index + 1}</p>
                <p className="mt-2 text-sm font-black text-white/80">{step}</p>
              </div>
            ))}
          </div>
          {showOnboarding && (
            <p className="mt-4 rounded-md border border-gold/20 bg-gold/10 p-3 text-sm font-bold leading-6 text-white/70">
              Comece escolhendo um jogo aberto. Depois da aprovação, seus palpites contam automaticamente para o ranking.
            </p>
          )}
        </div>

        <div className="panel p-5">
          <SectionHeading title="Badges" />
          <div className="mt-4 space-y-3">
            <BadgeRow active={exactBadges > 0} label="Acertou placar" value={`${exactBadges} vez(es)`} />
            <BadgeRow active={performance.correctResults > 0} label="Acertou vencedor" value={`${performance.correctResults} acerto(s)`} />
            <BadgeRow active={leaderBadge} label="Líder da rodada" value={leaderBadge ? "Você está no topo" : "Em disputa"} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="panel p-5">
          <SectionHeading title="Partidas ao vivo" />
          <div className="mt-4 space-y-3">
            {liveMatches.length ? liveMatches.map((match) => (
              <div className="rounded-md border border-red-400/20 bg-red-500/10 p-3" key={match.id}>
                <p className="font-black">{getTeamDisplayName(match.home_team)} {match.home_score} x {match.away_score} {getTeamDisplayName(match.away_team)}</p>
                <p className="mt-1 text-xs font-bold text-red-100/70">Ao vivo</p>
              </div>
            )) : (
              <p className="text-sm leading-6 text-white/55">Nenhuma partida ao vivo agora.</p>
            )}
          </div>
        </div>

        <div className="panel p-5">
          <SectionHeading title="Últimos resultados" />
          <div className="mt-4 space-y-3">
            {finishedMatches.length ? finishedMatches.map((match) => {
              const prediction = predictions.find((item) => item.match_id === match.id);
              return (
                <div className="rounded-md border border-white/10 bg-white/[0.035] p-3" key={match.id}>
                  <p className="text-sm font-black">{getTeamDisplayName(match.home_team)} {match.home_score} x {match.away_score} {getTeamDisplayName(match.away_team)}</p>
                  <p className="mt-2 text-xs text-white/50">{formatDateTimePtBr(match.start_time)}</p>
                  <p className="mt-2 text-sm font-black text-gold">{prediction ? `${prediction.points} pts` : "Sem palpite"}</p>
                </div>
              );
            }) : (
              <p className="text-sm leading-6 text-white/55">Quando jogos forem encerrados, seus pontos aparecem aqui.</p>
            )}
          </div>
        </div>

        <div className="panel p-5">
          <SectionHeading title="Ligas e CTA" />
          <div className="mt-4 space-y-3">
            <button className="btn-primary w-full" onClick={onViewGames} type="button">
              Entrar no bolão
            </button>
            <button className="btn-ghost w-full" onClick={onViewGroups} type="button">
              Ver minhas ligas
            </button>
            <input className="input w-full" onChange={(event) => setGroupName(event.target.value)} placeholder="Nome da liga" value={groupName} />
            <button
              className="btn-ghost w-full"
              disabled={busy || !groupName || !worldCupTournamentId}
              onClick={() =>
                onCreateGroup(groupName, worldCupTournamentId ?? "").then(() => {
                  setGroupName("");
                })
              }
            >
              <Plus className="h-4 w-4" />
              Criar liga
            </button>
            {activeAppInvite ? (
              <div className="rounded-md border border-white/10 bg-white/[0.035] p-3">
                <p className="break-all text-xs font-bold text-gold">{activeAppInvite.invite_url}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button className="btn-ghost w-full" onClick={() => navigator.clipboard?.writeText(activeAppInvite.invite_url)} type="button">
                    <Copy className="h-4 w-4" />
                    Copiar
                  </button>
                  <button className="btn-ghost w-full" onClick={() => onRevokeAppInvite(activeAppInvite.id)} type="button">
                    Revogar
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn-ghost w-full" disabled={busy} onClick={onCreateAppInvite} type="button">
                <Share2 className="h-4 w-4" />
                Convidar amigo
              </button>
            )}
            <div className="space-y-2 border-t border-white/10 pt-3">
              {activeGroups.slice(0, 2).map((group) => (
                <p className="truncate text-sm font-bold text-white/60" key={group.id}>{group.name}</p>
              ))}
              {!activeGroups.length && <p className="text-sm text-white/55">Você ainda não participa de ligas.</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <SectionHeading title="Notificações" />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {data.notifications.length ? (
            data.notifications.slice(0, 4).map((notification) => (
              <div className="rounded-md border border-white/10 bg-white/[0.035] p-3" key={notification.id}>
                <p className="font-black">{notification.title}</p>
                <p className="mt-1 text-sm leading-6 text-white/60">{notification.body}</p>
              </div>
            ))
          ) : derivedNotifications.length ? (
            derivedNotifications.map((message) => (
              <div className="rounded-md border border-white/10 bg-white/[0.035] p-3" key={message}>
                <p className="font-black">Atualização</p>
                <p className="mt-1 text-sm leading-6 text-white/60">{message}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-white/55">Sem notificações no momento.</p>
          )}
        </div>
      </section>
    </div>
  );
};

const GamesPanel = ({
  matches,
  onPredict,
  predictionLockMinutes,
  predictions
}: {
  matches: Match[];
  onPredict: (match: Match) => void;
  predictionLockMinutes: number;
  predictions: Prediction[];
}) => {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | Match["status"]>("all");
  const [date, setDate] = useState("");

  const filteredMatches = useMemo(
    () =>
      matches.filter((match) => {
        const calculatedStatus = calculateMatchStatus(match, new Date(), predictionLockMinutes);
        const matchesQuery = `${match.home_team} ${match.away_team} ${formatMatchupDisplayName(match.home_team, match.away_team)}`.toLowerCase().includes(query.toLowerCase());
        const matchesStatus = status === "all" || calculatedStatus === status;
        const matchesDate = !date || match.start_time.slice(0, 10) === date;
        return matchesQuery && matchesStatus && matchesDate;
      }),
    [date, matches, predictionLockMinutes, query, status],
  );

  return (
    <section className="space-y-4">
      <div className="panel p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-normal text-gold">MATCHES SCREEN RESPONSIBILITY</p>
            <h2 className="mt-2 text-2xl font-black">Jogos da Copa do Mundo 2026</h2>
            <p className="mt-1 text-sm text-white/55">{filteredMatches.length} de {matches.length} partida(s)</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_160px_170px]">
            <label className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-white/45" />
              <input
                className="input w-full pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar time"
                value={query}
              />
            </label>
            <select className="input" onChange={(event) => setStatus(event.target.value as "all" | Match["status"])} value={status}>
              <option value="all">Todos</option>
              <option value="fechado">Fechados</option>
              <option value="aberto">Abertos</option>
              <option value="ao_vivo">Ao vivo</option>
              <option value="encerrado">Encerrados</option>
            </select>
            <input className="input" onChange={(event) => setDate(event.target.value)} type="date" value={date} />
          </div>
        </div>
      </div>

      {filteredMatches.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              onPredict={onPredict}
              predictionLockMinutes={predictionLockMinutes}
              prediction={predictions.find((item) => item.match_id === match.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyBlock title="Sem partidas" body="Nenhuma partida corresponde aos filtros atuais." />
      )}
    </section>
  );
};

const MatchCard = ({
  match,
  onPredict,
  predictionLockMinutes,
  prediction
}: {
  match: Match;
  onPredict: (match: Match) => void;
  predictionLockMinutes: number;
  prediction?: Prediction;
}) => {
  const city = cityForStadium(match.stadium);
  const calculatedStatus = calculateMatchStatus(match, new Date(), predictionLockMinutes);
  const predictionAccess = canSubmitPrediction(match, null, new Date(), predictionLockMinutes);
  const canEditOrPredict = predictionAccess.allowed;
  const actionLabel = prediction
    ? canEditOrPredict ? "Editar" : "Encerrado"
    : canEditOrPredict
      ? "Palpitar"
      : calculatedStatus === "encerrado"
        ? "Jogo encerrado"
        : "Indisponível";

  return (
    <article className="panel group overflow-hidden transition hover:border-gold/25">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-pitch-950/30 px-3 py-2">
        <span className="badge badge-gold">{MATCH_STATUS_LABELS[calculatedStatus]}</span>
        <span className="inline-flex items-center gap-2 text-xs font-black text-white/60">
          <Clock className="h-4 w-4 text-gold" />
          {formatDateTimePtBr(match.start_time)}
        </span>
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="min-w-0 space-y-2">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <Team name={match.home_team} logoUrl={match.home_team_logo_url} />
            <div className="rounded-md border border-white/10 bg-pitch-950/55 px-3 py-2 text-center text-2xl font-black leading-none tabular-nums">
              <span>{match.home_score}</span>
              <span className="mx-2 text-white/35">x</span>
              <span>{match.away_score}</span>
            </div>
            <Team alignRight name={match.away_team} logoUrl={match.away_team_logo_url} />
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-bold text-white/55">
            <span className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1">{city ?? "Cidade indefinida"}</span>
            <span className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1">{match.stadium ?? "Estádio indefinido"}</span>
            <span className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1">{match.round ?? "Rodada indefinida"}</span>
          </div>
        </div>
        <div className="rounded-md border border-white/10 bg-pitch-950/35 p-2 sm:w-40">
          {prediction ? (
            <div className="rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-center">
              <p className="text-xs font-black uppercase text-gold/80">Palpite enviado</p>
              <p className="mt-1 text-xs font-bold leading-5 text-white/60">
                Detalhes na aba Palpites
              </p>
            </div>
          ) : (
            <p className="min-h-10 text-xs font-bold leading-5 text-white/55">
              {canEditOrPredict ? "Janela aberta para palpite" : predictionAccess.message}
            </p>
          )}
          <button className="btn-primary mt-2 min-h-10 w-full px-3 py-2" disabled={!canEditOrPredict} onClick={() => onPredict(match)}>
              {actionLabel}
          </button>
        </div>
      </div>
    </article>
  );
};

const Team = ({
  alignRight = false,
  logoUrl,
  name
}: {
  alignRight?: boolean;
  logoUrl?: string | null;
  name: string;
}) => {
  const flagUrl = flagUrlForTeam(name, logoUrl);
  const displayName = getTeamDisplayName(name);
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={`flex min-w-0 items-center gap-3 ${alignRight ? "justify-end text-right" : ""}`}>
      {!alignRight && <TeamFlag flagUrl={flagUrl} initials={initials} name={name} />}
      <p className="min-w-0 break-words text-base font-black">{displayName}</p>
      {alignRight && <TeamFlag flagUrl={flagUrl} initials={initials} name={name} />}
    </div>
  );
};

const TeamFlag = ({
  flagUrl,
  initials,
  name
}: {
  flagUrl: string | null;
  initials: string;
  name: string;
}) => (
  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-black/20 text-sm font-black text-gold">
    {flagUrl ? <img alt={name} className="h-7 w-9 object-contain" src={flagUrl} /> : initials}
  </div>
);

const PredictionsPanel = ({
  matches,
  players,
  predictionLockMinutes,
  predictions
}: {
  matches: Match[];
  players: Player[];
  predictionLockMinutes: number;
  predictions: Prediction[];
}) => {
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const rows = predictions.map((prediction) => {
    const match = matches.find((item) => item.id === prediction.match_id);
    const calculatedStatus = match ? calculateMatchStatus(match, new Date(), predictionLockMinutes) : "fechado";
    const status = predictionStatus(prediction, match);
    const bucket =
      calculatedStatus === "aberto"
        ? "Em aberto"
        : calculatedStatus === "ao_vivo"
          ? "Em andamento"
          : prediction.points > 0
            ? "Pontuados"
            : calculatedStatus === "encerrado"
              ? "Finalizados"
              : "Em aberto";

    return { bucket, calculatedStatus, match, prediction, status };
  });
  const sections = ["Em aberto", "Em andamento", "Finalizados", "Pontuados"].map((title) => ({
    title,
    rows: rows.filter((row) => row.bucket === title)
  }));

  return (
    <section className="space-y-4">
      <div className="panel p-5">
        <p className="text-xs font-black uppercase tracking-normal text-gold">Histórico completo</p>
        <h2 className="mt-2 text-2xl font-black">Meus Palpites</h2>
        <p className="mt-1 text-sm text-white/55">
          Placar enviado, pontos e resultado final ficam concentrados aqui.
        </p>
      </div>

      {predictions.length ? (
        sections.map((section) => (
          <PredictionSection key={section.title} playerById={playerById} rows={section.rows} title={section.title} />
        ))
      ) : (
        <EmptyBlock title="Nenhum palpite enviado" body="Quando você enviar um palpite, ele aparece aqui." />
      )}
    </section>
  );
};

const PredictionSection = ({
  playerById,
  rows,
  title
}: {
  playerById: Map<string, Player>;
  rows: Array<{
    calculatedStatus: Match["status"];
    match?: Match;
    prediction: Prediction;
    status: string;
  }>;
  title: string;
}) => (
  <section className="panel p-5">
    <div className="flex items-center justify-between gap-3">
      <SectionHeading title={title} />
      <span className="badge">{rows.length}</span>
    </div>
    <div className="mt-4 space-y-3">
      {rows.length ? (
        rows.map(({ calculatedStatus, match, prediction, status }) => (
          <article className="grid gap-3 rounded-md border border-white/10 bg-white/[0.035] p-3 lg:grid-cols-[1fr_auto_auto]" key={prediction.id}>
            <div className="min-w-0">
              <p className="truncate font-black">{match ? formatMatchupDisplayName(match.home_team, match.away_team) : "Partida"}</p>
              <p className="mt-1 text-xs text-white/55">
                Jogo: {match ? formatDateTimePtBr(match.start_time) : "Data indisponível"}
              </p>
              <p className="mt-1 text-xs text-white/45">
                Enviado: {formatDateTimePtBr(prediction.submitted_at)}
              </p>
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
                <PredictionDetail
                  label="Resultado"
                  value={winnerLabel(outcomeFromScore(Number(prediction.predicted_home_score ?? 0), Number(prediction.predicted_away_score ?? 0)), match)}
                />
                <PredictionDetail
                  label="Primeiro gol"
                  value={
                    match?.status === "encerrado" && Number(match.home_score ?? 0) === 0 && Number(match.away_score ?? 0) === 0
                      ? "Não se aplica"
                      : playerById.get(prediction.predicted_first_scorer_id ?? "")?.name ?? marketText(prediction.predicted_first_scorer)
                  }
                />
                <PredictionDetail
                  label="Ambos marcam"
                  value={boolLabel(Number(prediction.predicted_home_score ?? 0) > 0 && Number(prediction.predicted_away_score ?? 0) > 0)}
                />
                <PredictionDetail
                  label="Homem do jogo"
                  value={playerById.get(prediction.predicted_man_of_match_id ?? "")?.name ?? marketText(prediction.predicted_man_of_match)}
                />
              </div>
            </div>
            <div className="rounded-md border border-gold/30 bg-gold/10 px-4 py-2 text-center">
              <p className="text-xs font-black uppercase text-gold/80">Palpite</p>
              <p className="text-xl font-black text-gold">
                {prediction.predicted_home_score} x {prediction.predicted_away_score}
              </p>
            </div>
            <div className="flex flex-col justify-center gap-2 text-sm">
              <span className={`rounded-full border px-3 py-1 text-center text-xs font-black ${statusClass(status)}`}>
                {status}
              </span>
              <span className="font-black text-grass">{prediction.points} pts</span>
              <span className="text-xs font-bold text-white/50">
                Resultado: {match && calculatedStatus === "encerrado" ? `${match.home_score} x ${match.away_score}` : "pendente"}
              </span>
            </div>
          </article>
        ))
      ) : (
        <p className="text-sm text-white/55">Nenhum palpite nesta categoria.</p>
      )}
    </div>
  </section>
);

const PredictionDetail = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-white/10 bg-pitch-950/30 px-2.5 py-2">
    <p className="font-black uppercase text-white/35">{label}</p>
    <p className="mt-1 break-words font-bold text-white/75">{value}</p>
  </div>
);

const RankingPanel = ({
  groups,
  members,
  ranking,
  userId
}: {
  groups: Group[];
  members: GroupMember[];
  ranking: Ranking[];
  userId: string;
}) => {
  const [tab, setTab] = useState<"global" | "friends" | "leagues">("global");
  const myGroupIds = new Set(members.filter((member) => member.user_id === userId).map((member) => member.group_id));
  const friendUserIds = new Set(
    members
      .filter((member) => myGroupIds.has(member.group_id) && member.user_id !== userId)
      .map((member) => member.user_id),
  );
  const friendsRanking = ranking.filter((item) => friendUserIds.has(item.user_id));
  const myGroups = groups.filter((group) => myGroupIds.has(group.id));

  return (
    <section className="space-y-4">
      <div className="panel p-5">
        <p className="text-xs font-black uppercase tracking-normal text-gold">RANKING TABS</p>
        <h2 className="mt-2 text-2xl font-black">Classificação</h2>
        <p className="mt-1 text-sm text-white/55">Global, amigos e minhas ligas ficam separados.</p>
        <div className="mt-4 flex max-w-full gap-2 overflow-x-auto">
          {[
            { id: "global", label: "Global", count: ranking.length },
            { id: "friends", label: "Amigos", count: friendsRanking.length },
            { id: "leagues", label: "Minhas Ligas", count: myGroups.length }
          ].map((item) => (
            <button
              className={`segmented-chip ${tab === item.id ? "segmented-chip-active" : "segmented-chip-idle"}`}
              key={item.id}
              onClick={() => setTab(item.id as "global" | "friends" | "leagues")}
              type="button"
            >
              {item.label}
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">{item.count}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === "global" && <RankingList title="Ranking global" ranking={ranking} userId={userId} />}
      {tab === "friends" && <RankingList title="Ranking amigos" ranking={friendsRanking} userId={userId} />}
      {tab === "leagues" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {myGroups.length ? (
            myGroups.map((group) => {
              const groupUserIds = new Set(
                members.filter((member) => member.group_id === group.id).map((member) => member.user_id),
              );
              return (
                <RankingList
                  key={group.id}
                  ranking={ranking.filter((item) => groupUserIds.has(item.user_id))}
                  title={group.name}
                  userId={userId}
                />
              );
            })
          ) : (
            <EmptyBlock title="Sem ligas" body="Você ainda não participa de ligas." />
          )}
        </div>
      )}
    </section>
  );
};

const RankingList = ({ ranking, title, userId }: { ranking: Ranking[]; title: string; userId: string }) => (
  <section className="panel p-5">
    <SectionHeading title={title} />
    <div className="mt-4 space-y-3">
      {ranking.length ? (
        ranking.map((item, index) => (
          <div
            className={`grid grid-cols-[40px_1fr_auto] items-center gap-3 rounded-md border border-white/10 p-3 ${
              item.user_id === userId ? "bg-grass/10" : "bg-[#0b1812]"
            }`}
            key={item.id}
          >
            <span className="font-black text-gold">#{index + 1}</span>
            <div className="min-w-0">
              <p className="truncate font-black">{item.user?.name ?? "Participante"}</p>
              <p className="text-xs text-white/50">
                {item.correct_results} acertos - {item.exact_scores} exatos
              </p>
            </div>
            <span className="font-black text-grass">{item.total_points}</span>
          </div>
        ))
      ) : (
        <p className="text-sm text-white/55">Sem pontuação ainda.</p>
      )}
    </div>
  </section>
);

const UserGroupsPanel = ({
  groups,
  members,
  onDeactivateInvite,
  onRegenerateInvite,
  ranking,
  userId
}: {
  groups: Group[];
  members: GroupMember[];
  onDeactivateInvite: (groupId: string) => Promise<void>;
  onRegenerateInvite: (groupId: string) => Promise<void>;
  ranking: Ranking[];
  userId: string;
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const myGroupIds = new Set(members.filter((member) => member.user_id === userId).map((member) => member.group_id));
  const myGroups = groups.filter((group) => myGroupIds.has(group.id));
  const selectedGroup = myGroups.find((group) => group.id === selectedGroupId) ?? myGroups[0] ?? null;

  return (
    <section className="space-y-4">
      <SectionHeading title="Minhas ligas" />
      {myGroups.length ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {myGroups.map((group) => {
              const groupMembers = members.filter((member) => member.group_id === group.id);
              const rankedMembers = rankGroupMembers(groupMembers, ranking);
              const myPosition = rankedMembers.findIndex((member) => member.user_id === userId);
              const myPoints = ranking.find((item) => item.user_id === userId)?.total_points ?? 0;

              return (
                <article className={`panel p-5 ${selectedGroup?.id === group.id ? "border-gold/35" : ""}`} key={group.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xl font-black">{group.name}</p>
                      <p className="mt-1 text-sm text-white/55">
                        {group.tournament?.name ?? "Campeonato"} - {groupMembers.length} participantes
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-black text-gold">
                      {group.closed_at ? "Fechada" : "Ativa"}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <div className="metric-card px-3 py-2">
                      <p className="text-lg font-black text-gold">{myPosition >= 0 ? `#${myPosition + 1}` : "-"}</p>
                      <p className="text-xs font-bold text-white/50">sua posição</p>
                    </div>
                    <div className="metric-card px-3 py-2">
                      <p className="text-lg font-black text-gold">{myPoints}</p>
                      <p className="text-xs font-bold text-white/50">seus pontos</p>
                    </div>
                    <div className="metric-card px-3 py-2">
                      <p className="text-lg font-black text-gold">{groupMembers.length}</p>
                      <p className="text-xs font-bold text-white/50">participantes</p>
                    </div>
                  </div>
                  <button className="btn-primary mt-4 w-full" onClick={() => setSelectedGroupId(group.id)} type="button">
                    Entrar na liga
                  </button>
                </article>
              );
            })}
          </div>
          {selectedGroup && (
            <LeagueDetails
              group={selectedGroup}
              members={members}
              onDeactivateInvite={onDeactivateInvite}
              onRegenerateInvite={onRegenerateInvite}
              ranking={ranking}
              userId={userId}
            />
          )}
        </>
      ) : (
        <EmptyBlock title="Sem ligas" body="Você ainda não participa de ligas." />
      )}
    </section>
  );
};

const rankGroupMembers = (members: GroupMember[], ranking: Ranking[]) =>
  [...members].sort(
    (left, right) =>
      (ranking.find((item) => item.user_id === right.user_id)?.total_points ?? 0) -
      (ranking.find((item) => item.user_id === left.user_id)?.total_points ?? 0),
  );

const LeagueDetails = ({
  group,
  members,
  onDeactivateInvite,
  onRegenerateInvite,
  ranking,
  userId
}: {
  group: Group;
  members: GroupMember[];
  onDeactivateInvite: (groupId: string) => Promise<void>;
  onRegenerateInvite: (groupId: string) => Promise<void>;
  ranking: Ranking[];
  userId: string;
}) => {
  const groupMembers = members.filter((member) => member.group_id === group.id);
  const rankedMembers = rankGroupMembers(groupMembers, ranking);
  const isOwner = group.owner_id === userId;

  return (
    <section className="panel p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-normal text-gold">LEAGUE PARTICIPANTS FLOW</p>
          <h3 className="mt-2 text-2xl font-black">{group.name}</h3>
          <p className="mt-1 text-sm text-white/55">
            {group.tournament?.name ?? "Campeonato"} - {groupMembers.length} participantes
          </p>
        </div>
        <span className="badge badge-gold">{group.closed_at ? "Fechada" : "Ativa"}</span>
      </div>
      <div className="mt-5 rounded-md border border-white/10 bg-white/[0.035] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-normal text-gold">UNIQUE GROUP INVITE LINK</p>
            <p className="mt-2 break-all text-sm font-bold text-white/70">{group.invite_url}</p>
            <p className="mt-1 text-xs font-bold text-white/45">
              Status: {group.invite_active ? "ativo" : "inativo"}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[420px]">
            <button
              className="btn-ghost w-full"
              onClick={() => navigator.clipboard?.writeText(group.invite_url)}
              type="button"
            >
              <Copy className="h-4 w-4" />
              Copiar
            </button>
            {isOwner && (
              <>
                <button className="btn-ghost w-full" onClick={() => onRegenerateInvite(group.id)} type="button">
                  Regenerar
                </button>
                <button className="btn-ghost w-full" onClick={() => onDeactivateInvite(group.id)} type="button">
                  Desativar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="mt-5 space-y-2">
        {rankedMembers.map((member, index) => {
          const points = ranking.find((item) => item.user_id === member.user_id)?.total_points ?? 0;
          const mine = member.user_id === userId;

          return (
            <div
              className={`grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-md border border-white/10 px-3 py-2 ${
                mine ? "bg-grass/10" : "bg-white/[0.03]"
              }`}
              key={member.id}
            >
              <span className="font-black text-gold">#{index + 1}</span>
              <span className="truncate font-bold text-white/75">{member.user?.name ?? "Participante"}</span>
              <span className="text-sm font-black text-grass">{points} pts</span>
            </div>
          );
        })}
      </div>
    </section>
  );
};

const ProfilePanel = ({
  achievements,
  matches,
  onSignOut,
  position,
  predictions,
  profile,
  ranking
}: {
  achievements: Achievement[];
  matches: Match[];
  onSignOut: () => void;
  position: string;
  predictions: Prediction[];
  profile: Profile;
  ranking: Ranking | null;
}) => {
  const performance = deriveUserPerformance({ matches, predictions, ranking });
  const iconByName = {
    medal: Medal,
    send: Target,
    target: CheckCircle2,
    trophy: Trophy
  } as const;

  return (
    <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="panel p-5">
        <SectionHeading title="Perfil" />
        <div className="mt-4 space-y-3 text-sm text-white/65">
          <p><span className="font-black text-white">Nome:</span> {profile.name}</p>
          <p><span className="font-black text-white">Email:</span> {profile.email}</p>
          <p><span className="font-black text-white">Ranking:</span> {position}</p>
          <p><span className="font-black text-white">Pontos:</span> {ranking?.total_points ?? 0}</p>
        </div>
        <button className="btn-ghost mt-5 w-full" onClick={onSignOut}>
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
      <div className="panel p-5">
        <p className="text-xs font-black uppercase tracking-normal text-gold">PROFILE GAMIFICATION</p>
        <h2 className="mt-2 text-2xl font-black">Resumo de desempenho</h2>
        <p className="mt-1 text-sm text-white/55">Detalhes de placares enviados ficam na aba Palpites.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="metric-card">
            <p className="text-2xl font-black text-gold">{predictions.length}</p>
            <p className="text-xs font-bold text-white/55">palpites enviados</p>
          </div>
          <div className="metric-card">
            <p className="text-2xl font-black text-gold">{performance.hitRate}%</p>
            <p className="text-xs font-bold text-white/55">taxa de acerto</p>
          </div>
          <div className="metric-card">
            <p className="text-2xl font-black text-gold">{performance.correctResults}</p>
            <p className="text-xs font-bold text-white/55">resultados certos</p>
          </div>
          <div className="metric-card">
            <p className="text-2xl font-black text-gold">{performance.exactScores}</p>
            <p className="text-xs font-bold text-white/55">placares exatos</p>
          </div>
          <div className="metric-card">
            <p className="text-2xl font-black text-gold">{performance.currentStreak}</p>
            <p className="text-xs font-bold text-white/55">sequência atual</p>
          </div>
          <div className="metric-card">
            <p className="text-2xl font-black text-gold">{performance.bestStreak}</p>
            <p className="text-xs font-bold text-white/55">melhor sequência</p>
          </div>
        </div>
      </div>
      <div className="panel p-5 lg:col-span-2">
        <p className="text-xs font-black uppercase tracking-normal text-gold">ACHIEVEMENTS UX</p>
        <h2 className="mt-2 text-2xl font-black">Conquistas</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {achievements.map((achievement) => {
            const Icon = iconByName[achievement.icon as keyof typeof iconByName] ?? Medal;
            const unlocked = Boolean(achievement.unlocked_at);
            const progress = `${achievement.progress}/${achievement.goal}`;
            return (
              <div
                className={`rounded-lg border p-4 ${
                  unlocked
                    ? "border-gold/35 bg-gold/10"
                    : "border-white/10 bg-white/[0.03] opacity-70"
                }`}
                key={achievement.id}
              >
                <Icon className={`h-5 w-5 ${unlocked ? "text-gold" : "text-white/40"}`} />
                <p className="mt-3 font-black">{achievement.badge}</p>
                <p className="mt-1 text-xs leading-5 text-white/50">{achievement.description}</p>
                <p className="mt-1 text-xs font-bold text-white/50">
                  {unlocked ? "Desbloqueada" : progress}
                </p>
              </div>
            );
          })}
          {!achievements.length && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <Medal className="h-5 w-5 text-gold" />
              <p className="mt-3 font-black">Conquistas em progresso</p>
              <p className="mt-1 text-xs leading-5 text-white/50">
                Envie palpites e entre em ligas para iniciar sua coleção persistida.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

const PredictionDialog = ({
  match,
  onClose,
  players,
  predictionLockMinutes,
  prediction,
  onSubmit
}: {
  match: Match;
  onClose: () => void;
  players: Player[];
  predictionLockMinutes: number;
  prediction?: Prediction;
  onSubmit: (payload: PredictionSubmitPayload) => Promise<void>;
}) => {
  const [awayScore, setAwayScore] = useState(String(prediction?.predicted_away_score ?? 0));
  const [homeScore, setHomeScore] = useState(String(prediction?.predicted_home_score ?? 0));
  const [firstScorerId, setFirstScorerId] = useState<string | null>(prediction?.predicted_first_scorer_id ?? null);
  const [manOfMatchId, setManOfMatchId] = useState<string | null>(prediction?.predicted_man_of_match_id ?? null);
  const parsedHomeScore = normalizePredictionScore(homeScore);
  const parsedAwayScore = normalizePredictionScore(awayScore);
  const predictionAccess = canSubmitPrediction(match, null, new Date(), predictionLockMinutes);
  const automaticWinner = outcomeFromScore(parsedHomeScore, parsedAwayScore);
  const automaticBothTeamsScore = parsedHomeScore > 0 && parsedAwayScore > 0;
  const automaticWinnerLabel = automaticOutcomeLabel(automaticWinner, match);
  const firstScorerDisabled = parsedHomeScore === 0 && parsedAwayScore === 0;
  const firstScorerLabel = firstScorerDisabled
    ? "Não se aplica para 0x0"
    : players.find((player) => player.id === firstScorerId)?.name ?? "Não selecionado";
  const manOfMatchLabel = players.find((player) => player.id === manOfMatchId)?.name ?? "Não selecionado";

  useEffect(() => {
    if (firstScorerDisabled && firstScorerId) {
      setFirstScorerId(null);
    }
  }, [firstScorerDisabled, firstScorerId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6">
      <form
        className="w-full max-w-2xl panel p-6 shadow-panel"
        onSubmit={(event) => {
          event.preventDefault();
          if (!predictionAccess.allowed) return;
          onSubmit({
            awayScore: parsedAwayScore,
            firstScorer: null,
            firstScorerId: firstScorerDisabled ? null : firstScorerId,
            homeScore: parsedHomeScore,
            manOfMatch: null,
            manOfMatchId,
          }).catch(console.error);
        }}
      >
        <h2 className="text-2xl font-black">{prediction ? "Editar palpite" : "Palpitar"}</h2>
        <p className="mt-2 text-sm text-white/60">{formatMatchupDisplayName(match.home_team, match.away_team)}</p>
        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
          <label className="block">
            <span className="text-sm font-bold text-white/70">{getTeamDisplayName(match.home_team)}</span>
            <input
              className="input mt-2 w-full text-center"
              inputMode="numeric"
              max={PREDICTION_SCORE_MAX}
              min={PREDICTION_SCORE_MIN}
              onChange={(event) => setHomeScore(event.target.value)}
              required
              step={1}
              type="number"
              value={homeScore}
            />
          </label>
          <span className="pb-3 text-xl font-black text-white/35">x</span>
          <label className="block">
            <span className="text-sm font-bold text-white/70">{getTeamDisplayName(match.away_team)}</span>
            <input
              className="input mt-2 w-full text-center"
              inputMode="numeric"
              max={PREDICTION_SCORE_MAX}
              min={PREDICTION_SCORE_MIN}
              onChange={(event) => setAwayScore(event.target.value)}
              required
              step={1}
              type="number"
              value={awayScore}
            />
          </label>
        </div>

        <div className="mt-5 rounded-md border border-gold/20 bg-gold/10 p-3">
          <p className="text-sm font-black text-white/70">Resultado do seu palpite</p>
          <div className="mt-2 text-sm font-black text-white">
            {automaticWinnerLabel}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {firstScorerDisabled ? (
            <div className="min-w-0">
              <p className="mb-1 text-sm font-black text-white/70">Primeiro jogador a marcar</p>
              <div className="input flex min-h-12 w-full items-center text-white/45">
                Não se aplica para 0x0
              </div>
            </div>
          ) : (
            <PlayerPicker
              label="Primeiro jogador a marcar"
              match={match}
              onChange={({ player }) => setFirstScorerId(player?.id ?? null)}
              players={players}
              selectedPlayerId={firstScorerId}
            />
          )}
          <PlayerPicker
            label="Homem do jogo"
            match={match}
            onChange={({ player }) => setManOfMatchId(player?.id ?? null)}
            players={players}
            selectedPlayerId={manOfMatchId}
          />
        </div>

        <div className="mt-5 rounded-md border border-gold/20 bg-gold/10 p-3 text-xs font-bold leading-5 text-white/65">
          {predictionAccess.allowed
            ? "A tela Jogos mostra apenas que o palpite foi enviado. O detalhe completo fica salvo na aba Palpites."
            : "Palpites encerrados para esta partida."}
        </div>
        <div className="mt-4 rounded-md border border-pitch-600 bg-pitch-950/35 p-3">
          <p className="text-xs font-black uppercase text-gold">Resumo do palpite</p>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <PredictionDetail label="Placar" value={`${parsedHomeScore} x ${parsedAwayScore}`} />
            <PredictionDetail label="Resultado" value={automaticWinnerLabel} />
            <PredictionDetail label="Primeiro jogador" value={firstScorerLabel} />
            <PredictionDetail label="Homem do jogo" value={manOfMatchLabel} />
            <PredictionDetail label="Ambos marcam" value={boolLabel(automaticBothTeamsScore)} />
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          <button className="btn-ghost flex-1" onClick={onClose} type="button">Cancelar</button>
          <button className="btn-primary flex-1" disabled={!predictionAccess.allowed} type="submit">
            {predictionAccess.allowed ? (prediction ? "Salvar edição" : "Enviar") : "Encerrado"}
          </button>
        </div>
      </form>
    </div>
  );
};

const SectionHeading = ({ title }: { title: string }) => (
  <h2 className="text-xl font-black text-white">{title}</h2>
);

const EmptyBlock = ({ body, title }: { body: string; title: string }) => (
  <div className="panel p-5">
    <p className="font-black">{title}</p>
    <p className="mt-2 text-sm leading-6 text-white/55">{body}</p>
  </div>
);

const ErrorBanner = ({ className = "mb-6", message }: { className?: string; message: string }) => (
  <div className={`${className} rounded-lg border border-red-400/40 bg-red-500/10 p-4 text-sm font-bold text-red-100`}>
    {message}
  </div>
);

