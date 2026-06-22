// LEAGUE AUDIT
// SUPPORTED CHAMPIONSHIPS
"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Ban,
  CalendarDays,
  Check,
  ClipboardList,
  Copy,
  Link as LinkIcon,
  Lock,
  Medal,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Trophy,
  UserCheck,
  UserMinus,
  Users,
  X
} from "lucide-react";
import type {
  AdminLog,
  AdminMetrics,
  AdminUserOverview,
  AppSettings,
  BetaFeedback,
  Competition,
  CompetitionGroup,
  Group,
  GroupMember,
  Match,
  MatchProviderRun,
  MatchStatus,
  Player,
  Profile,
  Ranking,
  Tournament,
  TournamentType
} from "@gol-de-ouro/shared";
import { CHAMPIONSHIP_LABELS, MATCH_STATUS_LABELS, TOURNAMENT_LABELS, calculateMatchStatus, createQrMatrix, formatFullDatePtBr, formatMatchDateTime, getMatchDisplayDateKey, readError, readAuthError } from "@gol-de-ouro/shared";
import {
  approveUser,
  closeGroup,
  createCompetition,
  createGroup,
  createMatch,
  createTournament,
  finishMatchAndScore,
  forceRefreshRanking,
  getCurrentProfile,
  loadAdminData,
  reactivateUser,
  rejectUser,
  removeGroupMember,
  signInAdmin,
  softRemoveUser,
  suspendUser,
  syncAutomaticMatches,
  syncResultsNow,
  type SyncResultsSummary,
  toggleTournament,
  updateAutomaticMatchStatuses,
  updatePredictionLockMinutes,
  updateMatch
} from "@/lib/admin-api";
import { supabase } from "@/lib/supabase";
import { formatSyncErrorForDisplay } from "@/lib/sync-error-format";
import { BrandLogo } from "@/components/BrandLogo";
import { PlayerPicker } from "@/components/PlayerPicker";

type Tab =
  | "dashboard"
  | "users"
  | "matches"
  | "tournaments"
  | "groups"
  | "competitions"
  | "ranking"
  | "settings";

type AdminState = {
  feedback: BetaFeedback[];
  logs: AdminLog[];
  matches: Match[];
  metrics: AdminMetrics;
  players: Player[];
  providerRuns: MatchProviderRun[];
  rankings: Ranking[];
  settings: AppSettings;
  tournaments: Tournament[];
  users: Profile[];
  userOverview: AdminUserOverview[];
  groups: Group[];
  groupMembers: GroupMember[];
  competitions: Competition[];
  competitionGroups: CompetitionGroup[];
};

const emptyMetrics: AdminMetrics = {
  approved_users: 0,
  finished_matches: 0,
  live_matches: 0,
  open_matches: 0,
  pending_users: 0,
  total_predictions: 0,
  total_users: 0
};

const emptyState: AdminState = {
  feedback: [],
  logs: [],
  matches: [],
  metrics: emptyMetrics,
  players: [],
  providerRuns: [],
  rankings: [],
  settings: { prediction_lock_minutes: 60 },
  tournaments: [],
  users: [],
  userOverview: [],
  groups: [],
  groupMembers: [],
  competitions: [],
  competitionGroups: []
};

const debugLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") console.debug(...args);
};
const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? "development";
const isBetaEnv = appEnv.toLowerCase() === "beta";

// CHAMPIONSHIPS SCREEN FIX - Use only supported tournament types
// REMOVE OLD LEAGUES FROM MENU - No hardcoded tournament types, use database data only
const matchStatuses: MatchStatus[] = ["aberto", "fechado", "ao_vivo", "encerrado"];
// FRONTEND LEAGUE FILTER FIX - Tournament types are now fetched from database, not hardcoded
const tournamentTypes: TournamentType[] = [
  "world_cup",
  "champions_league",
  "libertadores",
  "brasileirao"
];

type MatchDraft = {
  away_score: string;
  first_goal_no_goals: boolean;
  first_goal_scorer_id: string | null;
  home_score: string;
  man_of_match_id: string | null;
  red_card_happened: boolean;
};
type MatchDensity = "comfortable" | "compact";
type ToastMessage = { kind: "success" | "error"; message: string };
type AdminActionOptions = {
  loadingKey?: string;
  successMessage?: string;
};
type AdminActionRunner = (action: () => Promise<unknown>, options?: AdminActionOptions) => Promise<boolean>;

const adminStatusClass: Record<MatchStatus, string> = {
  aberto: "border-grass/45 bg-grass/10 text-grass",
  fechado: "border-gold-dark/50 bg-gold/10 text-gold",
  ao_vivo: "border-accent/50 bg-accent/10 text-accent",
  encerrado: "border-pitch-600 bg-pitch-900/70 text-white/55"
};

const betaFeedbackTypeLabel: Record<BetaFeedback["type"], string> = {
  problem: "Problema",
  suggestion: "Sugestão"
};

const betaFeedbackStatusLabel: Record<BetaFeedback["status"], string> = {
  dismissed: "Ignorado",
  open: "Aberto",
  resolved: "Resolvido",
  reviewing: "Em análise"
};

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [admin, setAdmin] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<AdminState>(emptyState);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const refresh = useCallback(async () => {
    const profile = await getCurrentProfile();
    setAdmin(profile);

    const status = profile?.status ?? (profile?.blocked ? "suspended" : profile?.approval_status);
    if (!profile || profile.role !== "admin" || status !== "approved") {
      setData(emptyState);
      return;
    }

    debugLog("[ADMIN AUTH] REDIRECTING", profile.role, status);
    const nextData = await withRetry(() => loadAdminData(), 2);
    setData(nextData);
  }, []);

  useEffect(() => {
    refresh()
      .catch((nextError) => setError(readError(nextError)))
      .finally(() => setAuthLoading(false));

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      debugLog("[ADMIN AUTH] onAuthStateChange", event, session?.user?.email);
      if (event === "SIGNED_OUT") {
        setAdmin(null);
        setData(emptyState);
      } else if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session?.user) {
        refresh().catch((nextError) => setError(readError(nextError)));
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, [refresh]);

  useEffect(() => {
    if (!admin || admin.role !== "admin") return;

    const channel = supabase
      .channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "rankings" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "predictions" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "competitions" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "app_feedback" }, refresh)
      .subscribe();

    // Fallback polling every 30 seconds
    const pollingInterval = setInterval(() => {
      refresh().catch((error) => {
        console.error('[POLLING] Error during fallback refresh:', error);
      });
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollingInterval);
    };
  }, [admin, refresh]);

  const runAction: AdminActionRunner = async (action, options = {}) => {
    try {
      if (options.loadingKey) {
        setActionKey(options.loadingKey);
      } else {
        setBusy(true);
      }
      setError(null);
      const result = await action();
      if (isSupabaseResult(result) && result.error) throw result.error;
      await refresh();
      setToast({ kind: "success", message: options.successMessage ?? "Operação concluída com sucesso." });
      return true;
    } catch (nextError) {
      const message = readError(nextError);
      setError(message);
      setToast({ kind: "error", message });
      return false;
    } finally {
      if (options.loadingKey) {
        setActionKey(null);
      } else {
        setBusy(false);
      }
    }
  };

  if (authLoading) {
    return (
      <Shell>
        <AdminPageSkeleton />
      </Shell>
    );
  }

  if (!admin) {
    return (
      <Shell>
        <LoginCard onError={setError} onSuccess={refresh} />
        {error && <ErrorBanner message={error} />}
      </Shell>
    );
  }

  const adminStatus = admin.status ?? (admin.blocked ? "suspended" : admin.approval_status);

  if (admin.role !== "admin" || adminStatus !== "approved" || admin.blocked) {
    return (
      <Shell>
        <div className="mx-auto max-w-lg panel p-6 shadow-panel">
          <Lock className="mb-4 h-10 w-10 text-gold" />
          <h1 className="text-2xl font-black">Acesso restrito</h1>
          <p className="mt-3 text-sm leading-6 text-white/65">
            Seu usuário autenticado não possui role admin aprovada no banco.
          </p>
          <button
            className="mt-6 rounded-md border border-white/10 px-4 py-3 text-sm font-black text-white"
            onClick={() => supabase.auth.signOut({ scope: "global" })}
          >
            Sair
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <BrandLogo compact />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-xs font-black uppercase tracking-normal text-gold">Command center</p>
            {isBetaEnv && <span className="badge badge-gold">Beta fechado</span>}
          </div>
          <h1 className="mt-2 text-4xl font-black text-white md:text-5xl">Gol de Ouro Admin</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
            Operação em tempo real para usuários, partidas, campeonatos, grupos e ranking.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn-secondary" href="/admin/approvals">
            <UserCheck className="h-4 w-4" />
            Aprovações
          </a>
          <button
            className="btn-secondary"
            disabled={busy}
            onClick={() => runAction(forceRefreshRanking, { successMessage: "Ranking recalculado." })}
          >
            <RefreshCw className="h-4 w-4" />
            Recalcular ranking
          </button>
          <button className="btn-ghost" onClick={() => supabase.auth.signOut({ scope: "global" })}>
            Sair
          </button>
        </div>
      </header>

      {error && <ErrorBanner message={error} />}
      {toast && <Toast notice={toast} onClose={() => setToast(null)} />}

      <nav className="nav-shell md:grid-cols-8" role="tablist">
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

      {activeTab === "dashboard" && <Dashboard data={data} />}
      {activeTab === "users" && (
        <UsersPanel busy={busy} onAction={runAction} users={data.userOverview} />
      )}
      {activeTab === "matches" && (
        <MatchesPanel
          actionKey={actionKey}
          busy={busy}
          matches={data.matches}
          onAction={runAction}
          players={data.players}
          providerRuns={data.providerRuns}
          settings={data.settings}
          tournaments={data.tournaments}
        />
      )}
      {activeTab === "groups" && (
        <GroupsPanel
          busy={busy}
          groups={data.groups}
          members={data.groupMembers}
          onAction={runAction}
          rankings={data.rankings}
          tournaments={data.tournaments}
        />
      )}
      {activeTab === "competitions" && (
        <CompetitionsPanel
          busy={busy}
          competitionGroups={data.competitionGroups}
          competitions={data.competitions}
          members={data.groupMembers}
          groups={data.groups}
          onAction={runAction}
          rankings={data.rankings}
        />
      )}
      {activeTab === "tournaments" && (
        <TournamentsPanel
          busy={busy}
          onAction={runAction}
          tournaments={data.tournaments}
        />
      )}
      {activeTab === "ranking" && (
        <RankingPanel busy={busy} onAction={runAction} rankings={data.rankings} />
      )}
      {activeTab === "settings" && (
        <SettingsPanel busy={busy} onAction={runAction} settings={data.settings} />
      )}
    </Shell>
  );
}

const tabs: Array<{ id: Tab; label: string; icon: typeof Activity }> = [
  { id: "dashboard", label: "Dashboard", icon: Activity },
  { id: "users", label: "Usuários", icon: Users },
  { id: "matches", label: "Partidas", icon: CalendarDays },
  { id: "tournaments", label: "Campeonatos", icon: Trophy },
  { id: "groups", label: "Grupos", icon: Users },
  { id: "competitions", label: "Competições", icon: ShieldCheck },
  { id: "ranking", label: "Ranking", icon: Medal },
  { id: "settings", label: "Config.", icon: Settings }
];

const Shell = ({ children }: { children: React.ReactNode }) => (
  <main className="app-shell">
    <div className="mx-auto w-full max-w-7xl">{children}</div>
  </main>
);

const LoginCard = ({
  onError,
  onSuccess
}: {
  onError: (message: string | null) => void;
  onSuccess: () => Promise<void>;
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;

    let authenticated = false;
    try {
      setLoading(true);
      setNotice(null);
      onError(null);
      await signInAdmin(email, password);
      authenticated = true;
      setNotice("Login efetuado com sucesso.\nRedirecionando...");
      await onSuccess();
    } catch (error) {
      onError(authenticated
        ? `Login efetuado, mas não foi possível carregar o painel administrativo: ${readError(error)}`
        : readAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      className="mx-auto mt-16 max-w-md panel p-6 shadow-panel"
      onSubmit={submit}
    >
      <BrandLogo />
      <h1 className="mt-5 text-3xl font-black">Admin Gol de Ouro</h1>
      <p className="mt-2 text-sm leading-6 text-white/65">
        Entre com um usuário cuja role admin esteja aprovada no banco.
      </p>
      <label className="mt-6 block text-sm font-bold text-white/70">Email</label>
      <input className="input" onChange={(event) => setEmail(event.target.value)} value={email} />
      <label className="mt-4 block text-sm font-bold text-white/70">Senha</label>
      <input
        className="input"
        onChange={(event) => setPassword(event.target.value)}
        type="password"
        value={password}
      />
      <button className="btn-primary mt-6 w-full" disabled={loading}>
        {loading ? "Entrando..." : "Entrar"}
      </button>
      {notice && <p className="mt-4 whitespace-pre-line text-sm font-bold text-gold">{notice}</p>}
    </form>
  );
};

const Dashboard = ({ data }: { data: AdminState }) => {
  const metrics = [
    { label: "Total de usuários", value: data.metrics.total_users, icon: Users },
    { label: "Pendentes", value: data.metrics.pending_users, icon: Activity },
    { label: "Aprovados", value: data.metrics.approved_users, icon: UserCheck },
    { label: "Partidas abertas", value: data.metrics.open_matches, icon: ShieldCheck },
    { label: "Ao vivo", value: data.metrics.live_matches, icon: Activity },
    { label: "Encerradas", value: data.metrics.finished_matches, icon: Trophy },
    { label: "Palpites enviados", value: data.metrics.total_predictions, icon: ClipboardList }
  ];
  const statusBars = [
    { label: "Abertas", value: data.metrics.open_matches, className: "bg-grass" },
    { label: "Ao vivo", value: data.metrics.live_matches, className: "bg-red-400" },
    { label: "Encerradas", value: data.metrics.finished_matches, className: "bg-gold" }
  ];
  const maxStatus = Math.max(1, ...statusBars.map((item) => item.value));
  const productHealth = [
    { label: "Grupos ativos", value: data.groups.length },
    { label: "Campeonatos", value: data.tournaments.length },
    { label: "Competições", value: data.competitions.length },
    { label: "Ranking populado", value: data.rankings.length },
    { label: "Feedback aberto", value: data.feedback.filter((item) => item.status === "open").length }
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div className="metric-card" key={metric.label}>
              <div className="mb-4 flex items-center justify-between">
                <Icon className="h-5 w-5 text-gold" />
                <span className="badge badge-gold">live</span>
              </div>
              <p className="text-3xl font-black">{metric.value}</p>
              <p className="mt-1 text-sm font-bold text-white/60">{metric.label}</p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="panel p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black">Saúde operacional</h2>
              <p className="mt-1 text-sm text-white/55">KPIs para leitura rápida da operação.</p>
            </div>
            <Activity className="h-5 w-5 text-gold" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {productHealth.map((item) => (
              <div className="metric-card" key={item.label}>
                <p className="text-2xl font-black text-white">{item.value}</p>
                <p className="mt-1 text-xs font-bold text-white/50">{item.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-4">
            {statusBars.map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-bold text-white/70">{item.label}</span>
                  <span className="font-black text-white">{item.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${item.className}`}
                    style={{ width: `${Math.max(8, (item.value / maxStatus) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="text-xl font-black">Partidas recentes</h2>
          <div className="mt-4 space-y-3">
            {data.matches.slice(0, 6).map((match) => (
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3" key={match.id}>
                <div>
                  <p className="font-black">
                    {match.home_team} {match.home_score} x {match.away_score} {match.away_team}
                  </p>
                  <p className="text-xs text-white/55">{formatFullDatePtBr(match.start_time)}</p>
                </div>
                <span className="badge badge-gold">
                  {MATCH_STATUS_LABELS[match.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel p-5 lg:col-span-2">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black">Feedback beta</h2>
              <p className="mt-1 text-sm text-white/55">Problemas e sugestões enviados pelo Perfil mobile.</p>
            </div>
            <span className="badge badge-gold">{data.feedback.length} registro(s)</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {data.feedback.slice(0, 6).map((feedback) => (
              <article className="rounded-md border border-white/10 bg-white/[0.035] p-4" key={feedback.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase text-gold">{betaFeedbackTypeLabel[feedback.type]}</p>
                    <p className="mt-1 text-sm font-black text-white">
                      {feedback.user?.name ?? feedback.user?.email ?? "Usuário beta"}
                    </p>
                  </div>
                  <span className="badge badge-gold">{betaFeedbackStatusLabel[feedback.status]}</span>
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/65">{feedback.description}</p>
                <p className="mt-3 text-xs font-bold text-white/40">
                  {feedback.app_env} · {feedback.app_version ?? "sem versão"} · {formatFullDatePtBr(feedback.created_at)}
                </p>
              </article>
            ))}
          </div>
          {!data.feedback.length && <p className="text-sm text-white/55">Nenhum feedback beta recebido ainda.</p>}
        </div>
        <div className="panel p-5 lg:col-span-2">
          <h2 className="text-xl font-black">Auditoria</h2>
          <div className="mt-4 space-y-3">
            {data.logs.map((log) => (
              <div className="border-b border-white/10 pb-3" key={log.id}>
                <p className="text-sm font-black">{log.action}</p>
                <p className="text-xs text-white/55">
                  {log.entity} - {formatFullDatePtBr(log.created_at)}
                </p>
              </div>
            ))}
            {!data.logs.length && <p className="text-sm text-white/55">Sem logs ainda.</p>}
          </div>
        </div>
      </section>
    </div>
  );
};

const UsersPanel = ({
  busy,
  onAction,
  users
}: {
  busy: boolean;
  onAction: AdminActionRunner;
  users: AdminUserOverview[];
}) => {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        const currentStatus = user.status ?? (user.blocked ? "suspended" : user.approval_status);
        const matchesStatus = status === "all" || currentStatus === status;
        const matchesQuery = `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase());
        return matchesStatus && matchesQuery;
      }),
    [query, status, users],
  );
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const pagedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, status]);

  return (
    <section className="panel p-5">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-2xl font-black">Gestão de Usuários</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-white/45" />
            <input
              className="input pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar usuário"
              value={query}
            />
          </label>
          <select className="input" onChange={(event) => setStatus(event.target.value)} value={status}>
            <option value="all">Todos</option>
            <option value="pending">Pendentes</option>
            <option value="approved">Aprovados</option>
            <option value="rejected">Rejeitados</option>
            <option value="suspended">Suspensos</option>
          </select>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="panel-muted p-4">
          <p className="text-2xl font-black">{filteredUsers.length}</p>
          <p className="text-xs font-bold text-white/50">usuários filtrados</p>
        </div>
        <div className="panel-muted p-4">
          <p className="text-2xl font-black">{users.filter((user) => (user.status ?? user.approval_status) === "pending").length}</p>
          <p className="text-xs font-bold text-white/50">pendentes</p>
        </div>
        <div className="panel-muted p-4">
          <p className="text-2xl font-black">{users.filter((user) => user.blocked || user.status === "suspended").length}</p>
          <p className="text-xs font-bold text-white/50">suspensos</p>
        </div>
      </div>

      {filteredUsers.length ? (
      <div className="table-shell">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="text-xs uppercase text-white/50">
            <tr>
              <th className="py-3">Nome</th>
              <th>Email</th>
              <th>Cadastro</th>
              <th>Status</th>
              <th>Grupos</th>
              <th>Palpites</th>
              <th>Ultima atividade</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {pagedUsers.map((user) => (
              <tr className="border-t border-white/10" key={user.id}>
                <td className="py-4 font-black">{user.name}</td>
                <td className="text-white/65">{user.email}</td>
                <td className="text-white/65">{formatFullDatePtBr(user.created_at)}</td>
                <td>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-black text-gold">
                    {user.status ?? (user.blocked ? "suspended" : user.approval_status)}
                  </span>
                </td>
                <td>{user.groups_count}</td>
                <td>{user.predictions_count}</td>
                <td className="text-white/65">
                  {user.last_activity_at ? formatFullDatePtBr(user.last_activity_at) : "-"}
                </td>
                <td>
                  <div className="flex justify-end gap-2">
                    <IconButton
                      disabled={busy || user.role === "admin"}
                      label="Aprovar"
                      onClick={() =>
                        onAction(() => approveUser(user.id), {
                          successMessage: "Usuário aprovado."
                        })
                      }
                    >
                      <Check className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      disabled={busy || user.role === "admin"}
                      label="Rejeitar"
                      onClick={() =>
                        onAction(() => rejectUser(user.id), {
                          successMessage: "Usuário rejeitado."
                        })
                      }
                    >
                      <X className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      disabled={busy || user.role === "admin"}
                      label="Suspender"
                      onClick={() =>
                        onAction(() => suspendUser(user.id), {
                          successMessage: "Usuário suspenso."
                        })
                      }
                    >
                      <Ban className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      disabled={busy || user.role === "admin"}
                      label="Reativar"
                      onClick={() =>
                        onAction(() => reactivateUser(user.id), {
                          successMessage: "Usuário reativado."
                        })
                      }
                    >
                      <UserCheck className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      disabled={busy || user.role === "admin"}
                      label="Remover"
                      onClick={() =>
                        onAction(() => softRemoveUser(user.id), {
                          successMessage: "Usuário removido."
                        })
                      }
                    >
                      <ClipboardList className="h-4 w-4" />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      ) : (
        <EmptyState
          title="Nenhum usuário encontrado"
          description="Ajuste a busca ou o status para encontrar usuários cadastrados."
        />
      )}

      <div className="mt-4 flex flex-col gap-3 text-sm text-white/60 sm:flex-row sm:items-center sm:justify-between">
        <span>
            Página {page} de {totalPages} - {filteredUsers.length} resultado(s)
        </span>
        <div className="flex gap-2">
          <button className="btn-ghost min-h-9 px-3 py-1" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
            Anterior
          </button>
          <button className="btn-ghost min-h-9 px-3 py-1" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
            Próxima
          </button>
        </div>
      </div>
    </section>
  );
};

// API-FOOTBALL INTEGRATION
// Enhanced matches panel with logos and improved grid view

const MatchesPanel = ({
  actionKey,
  busy,
  matches,
  onAction,
  players,
  providerRuns,
  settings,
  tournaments
}: {
  actionKey: string | null;
  busy: boolean;
  matches: Match[];
  onAction: AdminActionRunner;
  players: Player[];
  providerRuns: MatchProviderRun[];
  settings: AppSettings;
  tournaments: Tournament[];
}) => {
  const [showManualCreate, setShowManualCreate] = useState(false);
  const [form, setForm] = useState({
    away_team: "",
    away_team_logo_url: "",
    home_team: "",
    home_team_logo_url: "",
    start_time: "",
    tournament_id: tournaments[0]?.id ?? ""
  });
  const [drafts, setDrafts] = useState<Record<string, MatchDraft>>({});
  const [density, setDensity] = useState<MatchDensity>("comfortable");
  const [lastResultsSyncSummary, setLastResultsSyncSummary] = useState<SyncResultsSummary | null>(null);
  const [matchQuery, setMatchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | MatchStatus>("all");
  const [page, setPage] = useState(1);
  const pageSize = density === "compact" ? 12 : 8;
  const manualResultsSyncBusy = actionKey === "sync-results";
  const predictionLockMinutes = settings.prediction_lock_minutes;
  const teamOptions = useMemo(() => {
    const names = new Set<string>();
    players.forEach((player) => {
      if (player.team_name) names.add(player.team_name);
    });
    matches.forEach((match) => {
      if (match.home_team) names.add(match.home_team);
      if (match.away_team) names.add(match.away_team);
    });
    return [...names].sort((left, right) => left.localeCompare(right));
  }, [matches, players]);

  // API-FOOTBALL INTEGRATION
  // Sort matches: live first, then upcoming, then finished
  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => {
      // Live matches first
      const statusA = calculateMatchStatus(a, new Date(), predictionLockMinutes);
      const statusB = calculateMatchStatus(b, new Date(), predictionLockMinutes);
      if (statusA === "ao_vivo" && statusB !== "ao_vivo") return -1;
      if (statusB === "ao_vivo" && statusA !== "ao_vivo") return 1;
      
      // Then by start time (upcoming first)
      const dateA = new Date(a.start_time);
      const dateB = new Date(b.start_time);
      return dateA.getTime() - dateB.getTime();
    });
  }, [matches, predictionLockMinutes]);
  const filteredMatches = useMemo(
    () =>
      sortedMatches.filter((match) => {
        const matchesQuery = `${match.home_team} ${match.away_team} ${match.championship ?? ""}`
          .toLowerCase()
          .includes(matchQuery.toLowerCase());
        const matchesStatus = statusFilter === "all" || calculateMatchStatus(match, new Date(), predictionLockMinutes) === statusFilter;
        return matchesQuery && matchesStatus;
      }),
    [matchQuery, predictionLockMinutes, sortedMatches, statusFilter],
  );
  const totalPages = Math.max(1, Math.ceil(filteredMatches.length / pageSize));
  const pagedMatches = filteredMatches.slice((page - 1) * pageSize, page * pageSize);
  const groupedPagedMatches = useMemo(() => groupMatchesByDate(pagedMatches), [pagedMatches]);
  const statusCounts = useMemo(
    () =>
      sortedMatches.reduce(
        (current, match) => {
          const status = calculateMatchStatus(match, new Date(), predictionLockMinutes);
          return { ...current, [status]: current[status] + 1 };
        },
        {
          aberto: 0,
          ao_vivo: 0,
          encerrado: 0,
          fechado: 0
        } satisfies Record<MatchStatus, number>,
      ),
    [predictionLockMinutes, sortedMatches],
  );

  useEffect(() => {
    setPage(1);
  }, [density, matchQuery, statusFilter]);

  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        matches.map((match) => [
          match.id,
          {
            away_score: String(match.away_score),
            first_goal_no_goals: Boolean(match.first_goal_no_goals),
            first_goal_scorer_id: match.first_goal_scorer_id ?? null,
            home_score: String(match.home_score),
            man_of_match_id: match.man_of_match_id ?? null,
            red_card_happened: Boolean(match.red_card_happened ?? ((match.red_cards_home ?? 0) + (match.red_cards_away ?? 0) > 0))
          }
        ]),
      ),
    );
  }, [matches]);

  useEffect(() => {
    if (!form.tournament_id && tournaments[0]?.id) {
      setForm((current) => ({ ...current, tournament_id: tournaments[0].id }));
    }
  }, [form.tournament_id, tournaments]);

  const submit = () =>
    onAction(async () => {
      const startTime = new Date(form.start_time).toISOString();
      await createMatch({
        away_team: form.away_team,
        away_team_logo_url: form.away_team_logo_url || null,
        home_team: form.home_team,
        home_team_logo_url: form.home_team_logo_url || null,
        start_time: startTime,
        status: calculateMatchStatus({ start_time: startTime, status: "fechado" }, new Date(), predictionLockMinutes),
        tournament_id: form.tournament_id
      });
      setForm((current) => ({ ...current, away_team: "", home_team: "", start_time: "" }));
      setShowManualCreate(false);
    }, {
      successMessage: "Partida criada."
    });

  const syncSummaryItems = lastResultsSyncSummary
    ? [
        { label: "Jogos consultados", value: lastResultsSyncSummary.checkedMatches },
        { label: "Jogos atualizados", value: lastResultsSyncSummary.updatedMatches },
        { label: "Ao vivo", value: lastResultsSyncSummary.liveMatches },
        { label: "Encerrados", value: lastResultsSyncSummary.finishedMatches },
        { label: "Palpites pontuados", value: lastResultsSyncSummary.scoredPredictions },
        { label: "Ranking atualizado", value: lastResultsSyncSummary.rankingUpdated },
        { label: "Classificacao", value: lastResultsSyncSummary.standingsUpdated },
        { label: "Mata-mata", value: lastResultsSyncSummary.knockoutUpdated }
      ]
    : [];

  return (
    <section className="space-y-6">
      <div className="panel p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-black">Sincronização de Partidas</h2>
            <p className="mt-1 text-sm text-white/55">
              Mantenha jogos no Supabase e atualize resultados pela ESPN sem expor fonte externa ao usuário.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() => setShowManualCreate(!showManualCreate)}
            >
              <Plus className="h-4 w-4" />
              Criar Manualmente
            </button>
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() =>
                onAction(() => syncAutomaticMatches(tournaments), {
                  successMessage: "Jogos sincronizados."
                })
              }
            >
              <RefreshCw className="h-4 w-4" />
              Sincronizar Jogos
            </button>
            <button
              className="btn-secondary"
              disabled={busy || manualResultsSyncBusy}
              onClick={() =>
                onAction(async () => {
                  const summary = await syncResultsNow({ force: true });
                  setLastResultsSyncSummary(summary);
                }, {
                  loadingKey: "sync-results",
                  successMessage: "Resultados atualizados."
                })
              }
            >
              <RefreshCw className={`h-4 w-4 ${manualResultsSyncBusy ? "animate-spin" : ""}`} />
              Atualizar resultados agora
            </button>
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() =>
                onAction(updateAutomaticMatchStatuses, {
                  successMessage: "Status das partidas atualizado."
                })
              }
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar status
            </button>
          </div>
        </div>

        {lastResultsSyncSummary && (
          <div className="mt-5 rounded-lg border border-white/10 bg-pitch-900/45 p-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-normal text-gold">Ultima atualizacao de resultados</p>
                <p className="mt-1 text-xs text-white/55">
                  Provider {lastResultsSyncSummary.provider} - {lastResultsSyncSummary.finishedAt ? new Date(lastResultsSyncSummary.finishedAt).toLocaleString("pt-BR") : "Data não disponível"}
                </p>
              </div>
              <span className={`badge ${lastResultsSyncSummary.status === "success" || lastResultsSyncSummary.status === "partial_success" ? "badge-gold" : "border-red-400/40 bg-red-500/10 text-red-100"}`}>
                {lastResultsSyncSummary.status === "success" ? "ok" : lastResultsSyncSummary.status === "partial_success" ? "parcial" : "erro"}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {syncSummaryItems.map((item) => (
                <div className="rounded-md border border-white/10 bg-white/[0.03] p-3" key={item.label}>
                  <p className="text-lg font-black text-white">{item.value ?? 0}</p>
                  <p className="mt-1 text-xs font-bold text-white/50">{item.label}</p>
                </div>
              ))}
            </div>
            {lastResultsSyncSummary.errors.length > 0 && (
              <div className="mt-3 rounded-md border border-red-400/30 bg-red-500/10 p-3 text-xs font-bold leading-5 text-red-100 whitespace-pre-line">
                {lastResultsSyncSummary.errors.map((error) => formatSyncErrorForDisplay(error)).join("\n\n")}
              </div>
            )}
          </div>
        )}

        {providerRuns.length > 0 && (
          <div className="mt-5 rounded-lg border border-white/10 bg-pitch-900/35 p-4">
            <p className="text-sm font-black uppercase tracking-normal text-white/60">Logs recentes de sincronizacao</p>
            <div className="mt-3 space-y-2">
              {providerRuns.slice(0, 4).map((run) => (
                <div className="flex flex-col gap-1 rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm sm:flex-row sm:items-center sm:justify-between" key={run.id}>
                  <div className="min-w-0">
                    <p className="truncate font-black text-white">
                      {run.provider_name} - {run.message ?? "Sem mensagem"}
                    </p>
                    <p className="mt-1 text-xs text-white/45">
                      {new Date(run.created_at).toLocaleString("pt-BR")} - {run.triggered_by ?? "manual"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-black text-white/55">
                    <span>{run.checked_matches ?? 0} consultados</span>
                    <span>{run.updated_matches ?? run.updated_count ?? 0} atualizados</span>
                    <span>{run.finished_matches ?? 0} encerrados</span>
                    <span>{run.scored_predictions ?? 0} palpites pontuados</span>
                  </div>
                  {run.error_message && (
                    <div className="mt-2 rounded-md border border-red-400/20 bg-red-500/5 p-2 text-xs font-bold leading-5 text-red-200 whitespace-pre-line">
                      {formatSyncErrorForDisplay(run.error_message)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {showManualCreate && (
          <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4 border-t border-white/10 pt-5">
            <select
              className="input"
              onChange={(event) => setForm({ ...form, tournament_id: event.target.value })}
              value={form.tournament_id}
            >
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name}
                </option>
              ))}
            </select>
            <select
              className="input"
              onChange={(event) => setForm({ ...form, home_team: event.target.value })}
              value={form.home_team}
            >
              <option value="">Selecione time casa</option>
              {teamOptions.map((teamName) => (
                <option key={teamName} value={teamName}>
                  {teamName}
                </option>
              ))}
            </select>
            <select
              className="input"
              onChange={(event) => setForm({ ...form, away_team: event.target.value })}
              value={form.away_team}
            >
              <option value="">Selecione visitante</option>
              {teamOptions.map((teamName) => (
                <option key={teamName} value={teamName}>
                  {teamName}
                </option>
              ))}
            </select>
            <input
              className="input"
              onChange={(event) => setForm({ ...form, start_time: event.target.value })}
              type="datetime-local"
              value={form.start_time}
            />
            <input
              className="input"
              onChange={(event) => setForm({ ...form, home_team_logo_url: event.target.value })}
              placeholder="URL logo casa"
              value={form.home_team_logo_url}
            />
            <input
              className="input"
              onChange={(event) => setForm({ ...form, away_team_logo_url: event.target.value })}
              placeholder="URL logo visitante"
              value={form.away_team_logo_url}
            />
            <button
              className="btn-primary"
              disabled={busy || !form.home_team || !form.away_team || !form.start_time || !form.tournament_id}
              onClick={submit}
            >
              Criar Partida
            </button>
          </div>
        )}
      </div>

      <div className="panel p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-black">Partidas Sincronizadas</h2>
            <p className="mt-1 text-sm text-white/55">
              {filteredMatches.length} de {matches.length} partida(s)
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 md:w-auto md:min-w-[360px]">
            <label className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-white/45" />
              <input
                className="input w-full pl-9"
                onChange={(event) => setMatchQuery(event.target.value)}
                placeholder="Buscar partida"
                value={matchQuery}
              />
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
            {(["all", ...matchStatuses] as Array<"all" | MatchStatus>).map((status) => {
              const active = statusFilter === status;
              const label = status === "all" ? "Todos" : MATCH_STATUS_LABELS[status];
              const count = status === "all" ? matches.length : statusCounts[status];

              return (
                <button
                  className={`segmented-chip ${active ? "segmented-chip-active" : "segmented-chip-idle"}`}
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  type="button"
                >
                  {label}
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="segmented-control">
            {(["comfortable", "compact"] as MatchDensity[]).map((item) => (
              <button
                className={`segmented-chip ${density === item ? "segmented-chip-active" : "segmented-chip-idle"}`}
                key={item}
                onClick={() => setDensity(item)}
                type="button"
              >
                {item === "comfortable" ? "Detalhado" : "Compacto"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 space-y-5">
          {busy && !matches.length ? (
            <MatchListSkeleton />
          ) : groupedPagedMatches.length ? (
            groupedPagedMatches.map((group) => (
              <div className="space-y-3" key={group.key}>
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-white/10" />
                  <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-xs font-black uppercase text-white/45">
                    {group.label}
                  </span>
                  <span className="h-px flex-1 bg-white/10" />
                </div>
                {group.matches.map((match) => {
                  const draft = drafts[match.id] ?? {
                    away_score: String(match.away_score),
                    first_goal_no_goals: Boolean(match.first_goal_no_goals),
                    first_goal_scorer_id: match.first_goal_scorer_id ?? null,
                    home_score: String(match.home_score),
                    man_of_match_id: match.man_of_match_id ?? null,
                    red_card_happened: Boolean(match.red_card_happened ?? ((match.red_cards_home ?? 0) + (match.red_cards_away ?? 0) > 0))
                  };

                  return (
                    <AdminMatchCard
                      actionKey={actionKey}
                      busy={busy}
                      density={density}
                      draft={draft}
                      key={match.id}
                      match={match}
                      onAction={onAction}
                      onDraftChange={(nextDraft) =>
                        setDrafts((current) => ({ ...current, [match.id]: nextDraft }))
                      }
                      players={players}
                      predictionLockMinutes={predictionLockMinutes}
                    />
                  );
                })}
              </div>
            ))
          ) : (
            <EmptyState
              title="Nenhuma partida encontrada"
              description="Ajuste a busca ou os filtros para encontrar partidas sincronizadas."
            />
          )}
        </div>
        <div className="mt-4 flex flex-col gap-3 text-sm text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Página {page} de {totalPages} - {filteredMatches.length} partida(s)
          </span>
          <div className="flex gap-2">
            <button className="btn-ghost min-h-9 px-3 py-1" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              Anterior
            </button>
            <button className="btn-ghost min-h-9 px-3 py-1" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
              Próxima
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

const AdminMatchCard = memo(function AdminMatchCard({
  actionKey,
  busy,
  density,
  draft,
  match,
  onAction,
  onDraftChange,
  players,
  predictionLockMinutes
}: {
  actionKey: string | null;
  busy: boolean;
  density: MatchDensity;
  draft: MatchDraft;
  match: Match;
  onAction: AdminActionRunner;
  onDraftChange: (draft: MatchDraft) => void;
  players: Player[];
  predictionLockMinutes: number;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const calculatedStatus = calculateMatchStatus(match, new Date(), predictionLockMinutes);
  const isLive = calculatedStatus === "ao_vivo";
  const isCompact = density === "compact";
  const isDirty =
    Number(draft.home_score) !== match.home_score ||
    Number(draft.away_score) !== match.away_score ||
    draft.first_goal_scorer_id !== (match.first_goal_scorer_id ?? null) ||
    draft.first_goal_no_goals !== Boolean(match.first_goal_no_goals) ||
    draft.man_of_match_id !== (match.man_of_match_id ?? null) ||
    draft.red_card_happened !== Boolean(match.red_card_happened ?? ((match.red_cards_home ?? 0) + (match.red_cards_away ?? 0) > 0));
  const saveActionKey = `match:${match.id}:save`;
  const finishActionKey = `match:${match.id}:finish`;
  const isSaving = actionKey === saveActionKey;
  const isFinishing = actionKey === finishActionKey;
  const isCardBusy = busy || isSaving || isFinishing;
  const championshipLabel =
    match.championship && match.championship in CHAMPIONSHIP_LABELS
      ? CHAMPIONSHIP_LABELS[match.championship as keyof typeof CHAMPIONSHIP_LABELS]
      : match.championship || "Copa do Mundo 2026";
  const provider = match.provider_name ?? "Manual";
  const syncLabel = match.last_synced_at ? formatFullDatePtBr(match.last_synced_at) : "-";
  const predictionCloseAt = new Date(
    new Date(match.start_time).getTime() - predictionLockMinutes * 60 * 1000,
  ).toISOString();

  return (
    <article className="overflow-hidden rounded-lg border border-pitch-600 bg-pitch-800 shadow-panel transition hover:border-gold/25">
      <header className={`flex flex-col gap-3 border-b border-pitch-600 px-4 md:flex-row md:items-center md:justify-between ${isCompact ? "py-2.5" : "py-3"}`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-black uppercase tracking-normal text-gold">
            {championshipLabel}
            </p>
            {isDirty && <span className="badge badge-gold">não salvo</span>}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-white/50">
            <span className="rounded-full border border-pitch-600 bg-pitch-950/35 px-2 py-1">Provider: {provider}</span>
            <span className="rounded-full border border-pitch-600 bg-pitch-950/35 px-2 py-1">Última sync: {syncLabel}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isLive && (
            <span className="inline-flex items-center gap-1 rounded-full border border-accent/45 bg-accent/10 px-3 py-1 text-xs font-black text-accent">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
              AO VIVO
            </span>
          )}
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${adminStatusClass[calculatedStatus]}`}>
            {MATCH_STATUS_LABELS[calculatedStatus]}
          </span>
        </div>
      </header>

      <div className={`px-4 ${isCompact ? "py-3" : "py-4"}`}>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
          <AdminTeamSide
            compact={isCompact}
            label="Casa"
            logoUrl={match.home_team_logo_url}
            name={match.home_team}
          />

          <div className={`mx-auto flex w-full max-w-[184px] items-center justify-center rounded-lg border border-gold/30 bg-pitch-950/55 px-4 text-center shadow-glow md:min-w-[148px] ${isCompact ? "py-2" : "py-3"}`}>
            <span className={`${isCompact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"} font-black leading-none tabular-nums text-white`}>{match.home_score}</span>
            <span className="mx-3 text-2xl font-black text-white/35">x</span>
            <span className={`${isCompact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"} font-black leading-none tabular-nums text-white`}>{match.away_score}</span>
          </div>

          <AdminTeamSide
            alignRight
            compact={isCompact}
            label="Visitante"
            logoUrl={match.away_team_logo_url}
            name={match.away_team}
          />
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <AdminMatchMeta label="Início" value={formatFullDatePtBr(match.start_time)} />
          <AdminMatchMeta label="Abre palpites" value={formatFullDatePtBr(match.prediction_open_at)} />
          <AdminMatchMeta label="Fecha palpites" value={formatFullDatePtBr(predictionCloseAt)} />
          <AdminMatchMeta label="Provider" value={provider} />
          <AdminMatchMeta label="Última sync" value={syncLabel} />
        </div>
      </div>

      <footer className="grid gap-3 border-t border-pitch-600 bg-pitch-950/20 px-4 py-3 xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:items-end">
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase text-white/45">Casa</span>
            <input
              className="input w-full text-center lg:w-20"
              disabled={isCardBusy}
              inputMode="numeric"
              min={0}
              onChange={(event) => onDraftChange({ ...draft, home_score: event.target.value })}
              type="number"
              value={draft.home_score}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase text-white/45">Visitante</span>
            <input
              className="input w-full text-center lg:w-20"
              disabled={isCardBusy}
              inputMode="numeric"
              min={0}
              onChange={(event) => onDraftChange({ ...draft, away_score: event.target.value })}
              type="number"
              value={draft.away_score}
            />
          </label>
        </div>

        <div className="grid gap-2 md:grid-cols-[1fr_1fr_160px]">
          <PlayerPicker
            disabled={isCardBusy}
            label="Primeiro gol"
            match={match}
            noGoals={draft.first_goal_no_goals}
            onChange={({ noGoals, player }) =>
              onDraftChange({
                ...draft,
                first_goal_no_goals: Boolean(noGoals),
                first_goal_scorer_id: player?.id ?? null
              })
            }
            players={players}
            selectedPlayerId={draft.first_goal_scorer_id}
            showNoGoals
          />
          <PlayerPicker
            disabled={isCardBusy}
            label="Homem do jogo"
            match={match}
            onChange={({ player }) =>
              onDraftChange({
                ...draft,
                man_of_match_id: player?.id ?? null
              })
            }
            players={players}
            selectedPlayerId={draft.man_of_match_id}
          />
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase text-white/45">Cartão vermelho</span>
            <select
              className="input w-full"
              disabled={isCardBusy}
              onChange={(event) => onDraftChange({ ...draft, red_card_happened: event.target.value === "true" })}
              value={String(draft.red_card_happened)}
            >
              <option value="false">Não</option>
              <option value="true">Sim</option>
            </select>
          </label>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:items-center">
          <button
            className="btn-ghost min-h-12 w-full px-4 lg:w-auto"
            disabled={isCardBusy || !isDirty}
            onClick={() =>
              onAction(() =>
                updateMatch(match.id, {
                  away_score: Number(draft.away_score),
                  first_goal_no_goals: draft.first_goal_no_goals,
                  first_goal_scorer: null,
                  first_goal_scorer_id: draft.first_goal_scorer_id,
                  home_score: Number(draft.home_score),
                  man_of_match: null,
                  man_of_match_id: draft.man_of_match_id,
                  red_card_happened: draft.red_card_happened
                }),
                {
                  loadingKey: saveActionKey,
                  successMessage: "Placar salvo."
                },
              )
            }
          >
            {isSaving && <RefreshCw className="h-4 w-4 animate-spin" />}
            Salvar
          </button>
          <button
            className="btn-secondary min-h-12 w-full px-4 lg:w-auto"
            disabled={isCardBusy}
            onClick={() => setConfirmOpen(true)}
          >
            {isFinishing && <RefreshCw className="h-4 w-4 animate-spin" />}
            Encerrar e pontuar
          </button>
        </div>
      </footer>
      {confirmOpen && (
        <ConfirmDialog
          busy={isFinishing}
          description={`Confirma encerrar ${match.home_team} x ${match.away_team} e recalcular a pontuação dos palpites?`}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={async () => {
            const finished = await onAction(async () => {
              await updateMatch(match.id, {
                away_score: Number(draft.away_score),
                first_goal_no_goals: draft.first_goal_no_goals,
                first_goal_scorer: null,
                first_goal_scorer_id: draft.first_goal_scorer_id,
                home_score: Number(draft.home_score),
                man_of_match: null,
                man_of_match_id: draft.man_of_match_id,
                red_card_happened: draft.red_card_happened
              });
              await finishMatchAndScore(match.id);
            }, {
              loadingKey: finishActionKey,
              successMessage: "Partida encerrada e pontuada."
            });
            if (finished) setConfirmOpen(false);
          }}
          title="Encerrar partida"
        />
      )}
    </article>
  );
});

const AdminTeamSide = ({
  alignRight = false,
  compact = false,
  label,
  logoUrl,
  name
}: {
  alignRight?: boolean;
  compact?: boolean;
  label: "Casa" | "Visitante";
  logoUrl?: string | null;
  name: string;
}) => (
  <div className={`flex min-w-0 items-center gap-3 ${alignRight ? "flex-row-reverse justify-start text-right" : ""}`}>
    <TeamLogo logoUrl={logoUrl} name={name} />
    <div className="min-w-0">
      <p className={`break-words font-black leading-tight text-white ${compact ? "text-base sm:text-lg" : "text-lg sm:text-xl"}`}>{name}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-normal text-white/45">{label}</p>
    </div>
  </div>
);

const TeamLogo = ({ logoUrl, name }: { logoUrl?: string | null; name: string }) => {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [logoUrl]);

  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-pitch-600 bg-pitch-950/60 text-sm font-black text-gold">
      {logoUrl && !imageFailed ? (
        <img
          alt={name}
          className="h-9 w-10 object-contain"
          onError={() => setImageFailed(true)}
          src={logoUrl}
        />
      ) : (
        initials
      )}
    </div>
  );
};

const AdminMatchMeta = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-pitch-600 bg-pitch-950/35 px-3 py-2">
    <p className="text-[11px] font-black uppercase tracking-normal text-white/40">{label}</p>
    <p className="mt-1 break-words text-xs font-bold leading-5 text-white/70">{value}</p>
  </div>
);

const TournamentsPanel = ({
  busy,
  onAction,
  tournaments
}: {
  busy: boolean;
  onAction: AdminActionRunner;
  tournaments: Tournament[];
}) => {
  const [name, setName] = useState("");
  const [type, setType] = useState<TournamentType>("world_cup");

  return (
    <section className="space-y-6">
      <div className="panel p-5">
        <h2 className="text-2xl font-black">Criar campeonato</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_240px_160px]">
          <input className="input" onChange={(event) => setName(event.target.value)} placeholder="Nome" value={name} />
          <select className="input" onChange={(event) => setType(event.target.value as TournamentType)} value={type}>
            {tournamentTypes.map((item) => (
              <option key={item} value={item}>
                {TOURNAMENT_LABELS[item]}
              </option>
            ))}
          </select>
          <button
            className="btn-primary"
            disabled={busy || !name}
            onClick={() =>
              onAction(
                async () => {
                  await createTournament({ active: true, name, type });
                  setName("");
                },
                { successMessage: "Campeonato criado." },
              )
            }
          >
            <Plus className="h-4 w-4" />
            Criar
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {tournaments.map((tournament) => (
          <div className="panel p-5" key={tournament.id}>
            <p className="text-lg font-black">{tournament.name}</p>
            <p className="mt-1 text-sm text-white/55">{TOURNAMENT_LABELS[tournament.type]}</p>
            <button
              className={tournament.active ? "btn-ghost mt-5 w-full" : "btn-primary mt-5 w-full"}
              disabled={busy}
              onClick={() =>
                onAction(() => toggleTournament(tournament), {
                  successMessage: tournament.active ? "Campeonato desativado." : "Campeonato ativado."
                })
              }
            >
              {tournament.active ? "Desativar" : "Ativar"}
            </button>
          </div>
        ))}
      </div>
      {!tournaments.length && (
        <EmptyState
          title="Nenhum campeonato cadastrado"
          description="Crie um campeonato para liberar grupos, convites e partidas manuais."
        />
      )}
    </section>
  );
};

const GroupsPanel = ({
  busy,
  groups,
  members,
  onAction,
  rankings,
  tournaments
}: {
  busy: boolean;
  groups: Group[];
  members: GroupMember[];
  onAction: AdminActionRunner;
  rankings: Ranking[];
  tournaments: Tournament[];
}) => {
  const [name, setName] = useState("");
  const [championshipId, setChampionshipId] = useState(tournaments[0]?.id ?? "");

  useEffect(() => {
    if (!championshipId && tournaments[0]?.id) setChampionshipId(tournaments[0].id);
  }, [championshipId, tournaments]);

  return (
    <section className="space-y-6">
      <div className="panel p-5">
        <h2 className="text-2xl font-black">Grupos por campeonato</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_280px_160px]">
          <input
            className="input"
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome do grupo"
            value={name}
          />
          <select className="input" onChange={(event) => setChampionshipId(event.target.value)} value={championshipId}>
            {tournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>
                {tournament.name}
              </option>
            ))}
          </select>
          <button
            className="btn-primary"
            disabled={busy || !name || !championshipId}
            onClick={() =>
              onAction(
                async () => {
                  await createGroup(name, championshipId);
                  setName("");
                },
                { successMessage: "Grupo criado." },
              )
            }
          >
            <Plus className="h-4 w-4" />
            Criar grupo
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((group) => {
          const groupMembers = members.filter((member) => member.group_id === group.id);
          const rankedMembers = [...groupMembers].sort(
            (left, right) =>
              (rankings.find((ranking) => ranking.user_id === right.user_id)?.total_points ?? 0) -
              (rankings.find((ranking) => ranking.user_id === left.user_id)?.total_points ?? 0),
          );
          const deepLink = `goldeouro://invite/${group.invite_token}`;
          const webLink = group.invite_url;
          return (
            <div className="panel p-5" key={group.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xl font-black">{group.name}</p>
                  <p className="mt-1 text-sm text-white/55">
                    {group.tournament?.name ?? group.championship_id} - {groupMembers.length} participantes
                  </p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-black text-gold">
                  {group.closed_at ? "Fechado" : "Ativo"}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-[96px_1fr]">
                <MiniQr value={webLink} />
                <div className="space-y-2 text-sm">
                  <p className="font-black text-white">Convite</p>
                  <p className="text-xs font-black uppercase text-gold">{group.invite_active ? "Link ativo" : "Link inativo"}</p>
                  <p className="break-all text-white/60">{deepLink}</p>
                  <p className="break-all text-white/60">{webLink}</p>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-ghost" onClick={() => navigator.clipboard?.writeText(deepLink)}>
                      <Copy className="h-4 w-4" />
                      Copiar app
                    </button>
                    <button className="btn-ghost" onClick={() => navigator.clipboard?.writeText(webLink)}>
                      <LinkIcon className="h-4 w-4" />
                      Copiar web
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-5 border-t border-white/10 pt-4">
                <p className="mb-2 text-xs font-black uppercase text-white/45">Ranking interno</p>
                <div className="max-h-36 space-y-2 overflow-auto">
                  {rankedMembers.map((member, index) => {
                    const points = rankings.find((ranking) => ranking.user_id === member.user_id)?.total_points ?? 0;
                    return (
                    <div className="flex items-center justify-between gap-3 text-sm" key={member.id}>
                      <span className="w-10 shrink-0 font-black text-gold">#{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-white/75">{member.user?.name ?? member.user_id}</span>
                      <span className="text-white/55">{points} pts</span>
                      {member.role !== "owner" && (
                        <button
                          className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs font-black text-white/65 hover:bg-white/[0.07]"
                          disabled={busy}
                          onClick={() =>
                            onAction(() => removeGroupMember(group.id, member.user_id), {
                              successMessage: "Participante removido."
                            })
                          }
                          type="button"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                          Remover
                        </button>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>

              <button
                className="btn-secondary mt-5 w-full"
                disabled={busy || Boolean(group.closed_at)}
                onClick={() =>
                  onAction(() => closeGroup(group.id), {
                    successMessage: "Grupo fechado."
                  })
                }
              >
                Fechar grupo
              </button>
            </div>
          );
        })}
      </div>
      {!groups.length && (
        <EmptyState
          title="Nenhum grupo criado"
          description="Crie grupos por campeonato para organizar participantes e convites."
        />
      )}
    </section>
  );
};

const CompetitionsPanel = ({
  busy,
  competitionGroups,
  competitions,
  groups,
  members,
  onAction,
  rankings
}: {
  busy: boolean;
  competitionGroups: CompetitionGroup[];
  competitions: Competition[];
  groups: Group[];
  members: GroupMember[];
  onAction: AdminActionRunner;
  rankings: Ranking[];
}) => {
  const [name, setName] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroups((current) =>
      current.includes(groupId)
        ? current.filter((item) => item !== groupId)
        : [...current, groupId],
    );
  };

  return (
    <section className="space-y-6">
      <div className="panel p-5">
        <h2 className="text-2xl font-black">Competições entre grupos</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_180px]">
          <input
            className="input"
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex: Liga entre Amigos"
            value={name}
          />
          <button
            className="btn-primary"
            disabled={busy || !name || selectedGroups.length < 2}
            onClick={() =>
              onAction(
                async () => {
                  await createCompetition(name, selectedGroups);
                  setName("");
                  setSelectedGroups([]);
                },
                { successMessage: "Competição criada." },
              )
            }
          >
            <Plus className="h-4 w-4" />
            Criar
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {groups.map((group) => (
            <button
              className={`rounded-md border px-3 py-2 text-sm font-black ${
                selectedGroups.includes(group.id)
                  ? "border-grass bg-grass text-black"
                  : "border-white/10 text-white/70"
              }`}
              key={group.id}
              onClick={() => toggleGroupSelection(group.id)}
            >
              {group.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {competitions.map((competition) => {
          const linkedGroups = competitionGroups
            .filter((item) => item.competition_id === competition.id)
            .map((item) => groups.find((group) => group.id === item.group_id) ?? item.group)
            .filter(Boolean) as Group[];
          const scoreGroup = (groupId: string) =>
            members
              .filter((member) => member.group_id === groupId)
              .reduce(
                (sum, member) =>
                  sum + (rankings.find((ranking) => ranking.user_id === member.user_id)?.total_points ?? 0),
                0,
              );
          const rankedGroups = [...linkedGroups].sort((left, right) => scoreGroup(right.id) - scoreGroup(left.id));

          return (
            <div className="panel p-5" key={competition.id}>
              <p className="text-xl font-black">{competition.name}</p>
              <p className="mt-1 text-sm text-white/55">
                {linkedGroups.length} grupos vinculados - {competition.status}
              </p>
              <div className="mt-5 space-y-3">
                {rankedGroups.map((group, index) => (
                  <div className="flex items-center justify-between rounded-md border border-white/10 p-3" key={group.id}>
                    <span className="font-black text-gold">#{index + 1}</span>
                    <span className="flex-1 px-3 font-bold text-white/80">{group.name}</span>
                    <span className="text-sm text-white/45">{scoreGroup(group.id)} pts</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {!competitions.length && (
        <EmptyState
          title="Nenhuma competição criada"
          description="Selecione dois ou mais grupos para iniciar uma competição entre bolões."
        />
      )}
    </section>
  );
};

const SettingsPanel = ({
  busy,
  onAction,
  settings
}: {
  busy: boolean;
  onAction: AdminActionRunner;
  settings: AppSettings;
}) => {
  const [predictionLockMinutes, setPredictionLockMinutes] =
    useState<AppSettings["prediction_lock_minutes"]>(settings.prediction_lock_minutes);

  useEffect(() => {
    setPredictionLockMinutes(settings.prediction_lock_minutes);
  }, [settings.prediction_lock_minutes]);

  const options: AppSettings["prediction_lock_minutes"][] = [60, 90, 120, 180];

  return (
    <section className="space-y-6">
      <div className="panel p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-normal text-gold">Configurações do Bolão</p>
            <h2 className="mt-2 text-2xl font-black">Regras de palpites</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
              Altere quando a criação e edição de palpites serão bloqueadas antes do início da partida. A regra é aplicada no banco, no PWA e no app mobile.
            </p>
          </div>
          <span className="badge badge-gold">Atual: {settings.prediction_lock_minutes} min</span>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="grid gap-3 sm:grid-cols-4">
            {options.map((option) => (
              <button
                className={`rounded-lg border p-4 text-left transition ${
                  predictionLockMinutes === option
                    ? "border-gold/45 bg-gold/10 text-gold"
                    : "border-white/10 bg-white/[0.035] text-white/70 hover:border-gold/25"
                }`}
                key={option}
                onClick={() => setPredictionLockMinutes(option)}
                type="button"
              >
                <p className="text-2xl font-black">{option}</p>
                <p className="mt-1 text-xs font-bold">minutos antes</p>
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-white/10 bg-pitch-950/35 p-4">
            <p className="text-sm font-black text-white">Regra ativa</p>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Quando faltar menos de {predictionLockMinutes} minutos, o usuário só visualiza o palpite. Criar ou editar fica bloqueado.
            </p>
            <button
              className="btn-primary mt-4 w-full"
              disabled={busy || predictionLockMinutes === settings.prediction_lock_minutes}
              onClick={() =>
                onAction(() => updatePredictionLockMinutes(predictionLockMinutes), {
                  successMessage: "Configuração de palpites atualizada."
                })
              }
              type="button"
            >
              <Settings className="h-4 w-4" />
              Salvar regra
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

const RankingPanel = ({
  busy,
  onAction,
  rankings
}: {
  busy: boolean;
  onAction: AdminActionRunner;
  rankings: Ranking[];
}) => (
  <section className="space-y-6">
    <div className="panel p-5">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-black">Ranking completo</h2>
          <p className="mt-1 text-sm text-white/55">Top players, XP visual e progressão de pontuação.</p>
        </div>
      <button
        className="btn-secondary"
        disabled={busy}
        onClick={() => onAction(forceRefreshRanking, { successMessage: "Ranking recalculado." })}
      >
        <RefreshCw className="h-4 w-4" />
        Forçar recálculo
      </button>
    </div>
      {rankings.length ? (
      <>
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {rankings.slice(0, 3).map((ranking, index) => (
          <div className="panel-muted p-4" key={ranking.id}>
            <div className="mb-4 flex items-center justify-between">
              <span className="badge badge-gold">#{index + 1}</span>
              <Medal className="h-5 w-5 text-gold" />
            </div>
            <p className="truncate text-lg font-black">{ranking.user?.name ?? ranking.user_id}</p>
            <p className="mt-1 text-sm text-white/55">{ranking.total_points * 10} XP</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-grass" style={{ width: `${Math.max(12, ranking.total_points % 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    <div className="table-shell">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="text-xs uppercase text-white/50">
          <tr>
            <th className="py-3">Posição</th>
            <th>Nome</th>
            <th>Pontos</th>
            <th>Acertos</th>
            <th>Placares exatos</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((ranking, index) => (
            <tr className="border-t border-white/10" key={ranking.id}>
              <td className="py-4 font-black text-gold">#{index + 1}</td>
              <td className="font-black">{ranking.user?.name ?? ranking.user_id}</td>
              <td>{ranking.total_points}</td>
              <td>{ranking.correct_results}</td>
              <td>{ranking.exact_scores}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
      </>
      ) : (
        <EmptyState
          title="Ranking ainda vazio"
          description="Quando houver palpites pontuados, os jogadores aparecerão aqui com XP e progressão."
        />
      )}
    </div>
  </section>
);

const AdminPageSkeleton = () => (
  <div className="space-y-6">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-3">
        <div className="skeleton-line h-12 w-56" />
        <div className="skeleton-line h-5 w-36" />
        <div className="skeleton-line h-10 w-72 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="skeleton-line h-11 w-32" />
        <div className="skeleton-line h-11 w-44" />
        <div className="skeleton-line h-11 w-20" />
      </div>
    </div>
    <div className="panel p-2">
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-8">
        {Array.from({ length: 8 }).map((_, index) => (
          <div className="skeleton-line h-12" key={index} />
        ))}
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div className="metric-card space-y-4" key={index}>
          <div className="skeleton-line h-5 w-5" />
          <div className="skeleton-line h-9 w-20" />
          <div className="skeleton-line h-4 w-32" />
        </div>
      ))}
    </div>
  </div>
);

const MatchListSkeleton = () => (
  <div className="space-y-3">
    {Array.from({ length: 4 }).map((_, index) => (
      <div className="rounded-lg border border-pitch-600 bg-pitch-800 p-4" key={index}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="skeleton-line h-4 w-40" />
          <div className="skeleton-line h-7 w-24" />
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_148px_1fr] md:items-center">
          <div className="skeleton-line h-12" />
          <div className="skeleton-line h-16" />
          <div className="skeleton-line h-12" />
        </div>
      </div>
    ))}
  </div>
);

const EmptyState = ({ description, title }: { description: string; title: string }) => (
  <div className="empty-state">
    <ClipboardList className="h-8 w-8 text-gold" />
    <div>
      <p className="text-base font-black text-white">{title}</p>
      <p className="mt-1 text-sm leading-6 text-white/55">{description}</p>
    </div>
  </div>
);

const Toast = ({ notice, onClose }: { notice: ToastMessage; onClose: () => void }) => {
  useEffect(() => {
    const timeout = window.setTimeout(onClose, 4200);
    return () => window.clearTimeout(timeout);
  }, [notice, onClose]);

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[min(92vw,380px)] rounded-lg border border-white/10 bg-pitch-800 p-4 shadow-panel">
      <div className="flex items-start gap-3">
        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${notice.kind === "success" ? "bg-grass" : "bg-red-400"}`} />
        <p className="min-w-0 flex-1 text-sm font-bold leading-6 text-white/85">{notice.message}</p>
        <button
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/55 hover:bg-white/10 hover:text-white"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

const ConfirmDialog = ({
  busy,
  description,
  onCancel,
  onConfirm,
  title
}: {
  busy: boolean;
  description: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  title: string;
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm">
    <div
      aria-modal="true"
      className="w-full max-w-md rounded-lg border border-pitch-600 bg-pitch-800 p-5 shadow-panel"
      role="dialog"
    >
      <h3 className="text-xl font-black text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/60">{description}</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <button className="btn-ghost w-full" disabled={busy} onClick={onCancel} type="button">
          Cancelar
        </button>
        <button className="btn-secondary w-full" disabled={busy} onClick={onConfirm} type="button">
          {busy && <RefreshCw className="h-4 w-4 animate-spin" />}
          Confirmar
        </button>
      </div>
    </div>
  </div>
);

const groupMatchesByDate = (matches: Match[]) => {
  return matches.reduce<Array<{ key: string; label: string; matches: Match[] }>>((groups, match) => {
    const key = getMatchDisplayDateKey(match);
    const currentGroup = groups.find((group) => group.key === key);

    if (currentGroup) {
      currentGroup.matches.push(match);
      return groups;
    }

    groups.push({
      key,
      label: formatMatchDateTime(match).split(",")[0],
      matches: [match]
    });
    return groups;
  }, []);
};

const MiniQr = ({ value }: { value: string }) => {
  const matrix = createQrMatrix(value);
  const size = matrix.length;

  return (
    <svg
      aria-label="QR code do convite"
      className="h-24 w-24 rounded-md border border-white/10 bg-white"
      role="img"
      viewBox={`0 0 ${size} ${size}`}
    >
      <rect fill="#fff" height={size} width={size} x="0" y="0" />
      {matrix.map((row, rowIndex) =>
        row.map((filled, columnIndex) =>
          filled ? (
            <rect fill="#000" height="1" key={`${rowIndex}-${columnIndex}`} width="1" x={columnIndex} y={rowIndex} />
          ) : null,
        ),
      )}
    </svg>
  );
};

const IconButton = ({
  children,
  disabled,
  label,
  onClick
}: {
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-white/75 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-35"
    disabled={disabled}
    onClick={onClick}
    title={label}
    type="button"
  >
    {children}
  </button>
);

const ErrorBanner = ({ message }: { message: string }) => (
  <div className="mb-6 rounded-lg border border-red-400/40 bg-red-500/10 p-4 text-sm font-bold text-red-100">
    {message}
  </div>
);

const isSupabaseResult = (result: unknown): result is { error: Error | null } =>
  Boolean(result && typeof result === "object" && "error" in result);

const withRetry = async <Result,>(
  operation: () => Promise<Result>,
  retries: number,
  delayMs = 450,
): Promise<Result> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => window.setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }

  throw lastError;
};

