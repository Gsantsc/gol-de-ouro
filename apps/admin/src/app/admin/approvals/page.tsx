"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Check, Clock3, Lock, RefreshCw, X } from "lucide-react";
import type { Profile } from "@gol-de-ouro/shared";
import { formatFullDatePtBr, readError, readAuthError } from "@gol-de-ouro/shared";
import {
  approveUser,
  getCurrentProfile,
  loadPendingApprovals,
  rejectUserWithReason,
  signInAdmin,
  suspendUser
} from "@/lib/admin-api";
import { supabase } from "@/lib/supabase";
import { BrandLogo } from "@/components/BrandLogo";

type Notice = { kind: "success" | "error"; message: string } | null;
const debugLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") console.debug(...args);
};

export default function AdminApprovalsPage() {
  const [admin, setAdmin] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const adminStatus = admin?.status ?? (admin?.blocked ? "suspended" : admin?.approval_status);
  const canManage = admin?.role === "admin" && adminStatus === "approved" && !admin.blocked;

  const refresh = useCallback(async () => {
    const profile = await getCurrentProfile();
    setAdmin(profile);
    const status = profile?.status ?? (profile?.blocked ? "suspended" : profile?.approval_status);

    if (!profile || profile.role !== "admin" || status !== "approved" || profile.blocked) {
      setPendingUsers([]);
      setListLoading(false);
      return;
    }

    const approvals = await loadPendingApprovals();
    setPendingUsers(approvals);
    setListLoading(false);
  }, []);

  useEffect(() => {
    refresh()
      .catch((error) => setNotice({ kind: "error", message: readAuthError(error) }))
      .finally(() => setAuthLoading(false));

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      debugLog("[ADMIN AUTH] approvals auth event", event, session?.user?.email);
      if (!session?.user) {
        setAdmin(null);
        setPendingUsers([]);
        return;
      }

      refresh().catch((error) => setNotice({ kind: "error", message: readError(error) }));
    });

    return () => authListener.subscription.unsubscribe();
  }, [refresh]);

  useEffect(() => {
    if (!canManage) return;

    const channel = supabase
      .channel("admin-approvals-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => {
        refresh().catch((error) => setNotice({ kind: "error", message: readError(error) }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canManage, refresh]);

  const runUserAction = async (
    user: Profile,
    label: string,
    action: () => Promise<unknown>,
  ) => {
    if (busyId) return;

    try {
      setBusyId(user.id);
      setNotice(null);
      await action();
      setNotice({ kind: "success", message: `${label}: ${user.name}` });
      await refresh();
    } catch (error) {
      setNotice({ kind: "error", message: readError(error) });
    } finally {
      setBusyId(null);
    }
  };

  if (authLoading) {
    return (
      <ApprovalsShell>
        <ApprovalsSkeleton />
      </ApprovalsShell>
    );
  }

  if (!admin) {
    return (
      <ApprovalsShell>
        <LoginCard
          onError={(message) => setNotice(message ? { kind: "error", message } : null)}
          onSuccess={async () => {
            setNotice({ kind: "success", message: "Login efetuado com sucesso.\nRedirecionando..." });
            await refresh();
          }}
        />
        {notice && <NoticeBanner notice={notice} />}
      </ApprovalsShell>
    );
  }

  if (!canManage) {
    return (
      <ApprovalsShell>
        <section className="mx-auto max-w-lg panel p-6 shadow-panel">
          <Lock className="mb-4 h-10 w-10 text-gold" />
          <h1 className="text-2xl font-black">Acesso restrito</h1>
          <p className="mt-3 text-sm leading-6 text-white/65">
            Apenas administradores aprovados podem acessar aprovações.
          </p>
          <button className="btn-ghost mt-6" onClick={() => supabase.auth.signOut({ scope: "global" })}>
            Sair
          </button>
        </section>
      </ApprovalsShell>
    );
  }

  return (
    <ApprovalsShell>
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <BrandLogo compact />
          <p className="text-xs font-black uppercase tracking-normal text-gold">Painel Admin</p>
          <h1 className="mt-2 text-4xl font-black text-white">Aprovações</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
            Cadastros pendentes entram aqui automaticamente em tempo real.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn-ghost" href="/admin">
            Voltar ao painel
          </a>
          <button
            className="btn-secondary"
            disabled={Boolean(busyId) || listLoading}
            onClick={() => {
              setListLoading(true);
              refresh().catch((error) => setNotice({ kind: "error", message: readError(error) }));
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
        </div>
      </header>

      {notice && <NoticeBanner notice={notice} />}

      <section className="panel p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">Fila de aprovação</h2>
            <p className="mt-1 text-sm text-white/55">{pendingUsers.length} cadastro(s) pendente(s)</p>
          </div>
          <Clock3 className="h-6 w-6 text-gold" />
        </div>

        {listLoading ? (
          <ApprovalsSkeleton compact />
        ) : pendingUsers.length ? (
          <ApprovalsTable busyId={busyId} onAction={runUserAction} users={pendingUsers} />
        ) : (
          <div className="rounded-md border border-white/10 p-6 text-sm font-bold text-white/60">
            Nenhum cadastro pendente agora.
          </div>
        )}
      </section>
    </ApprovalsShell>
  );
}

const ApprovalsTable = ({
  busyId,
  onAction,
  users
}: {
  busyId: string | null;
  onAction: (user: Profile, label: string, action: () => Promise<unknown>) => Promise<void>;
  users: Profile[];
}) => {
  const rows = useMemo(
    () =>
      users.map((user) => ({
        ...user,
        displayStatus: user.status ?? (user.blocked ? "suspended" : user.approval_status),
      })),
    [users],
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="text-xs uppercase text-white/50">
          <tr>
            <th className="py-3">Nome</th>
            <th>Email</th>
            <th>Cadastro</th>
            <th>Status</th>
            <th>IP</th>
            <th>Dispositivo</th>
            <th className="text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((user) => {
            const busy = busyId === user.id;
            const disabled = Boolean(busyId);
            return (
              <tr className="border-t border-white/10" key={user.id}>
                <td className="py-4 font-black">{user.name}</td>
                <td className="text-white/65">{user.email}</td>
                <td className="text-white/65">{formatFullDatePtBr(user.created_at)}</td>
                <td>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-black text-gold">
                    {user.displayStatus}
                  </span>
                </td>
                <td className="text-white/65">{user.signup_ip || "-"}</td>
                <td className="max-w-[240px] truncate text-white/65" title={user.signup_device || undefined}>
                  {user.signup_device || "-"}
                </td>
                <td>
                  <div className="flex justify-end gap-2">
                    <button
                      className="btn-primary"
                      disabled={disabled}
                      onClick={() => onAction(user, "Usuário aprovado", () => approveUser(user.id))}
                    >
                      {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Aprovar
                    </button>
                    <button
                      className="btn-ghost"
                      disabled={disabled}
                      onClick={() => {
                        const reason = window.prompt("Motivo da rejeição (opcional)")?.trim() || null;
                        onAction(user, "Usuário rejeitado", () => rejectUserWithReason(user.id, reason));
                      }}
                    >
                      <X className="h-4 w-4" />
                      Rejeitar
                    </button>
                    <button
                      className="btn-ghost"
                      disabled={disabled}
                      onClick={() => onAction(user, "Usuário suspenso", () => suspendUser(user.id))}
                    >
                      <Ban className="h-4 w-4" />
                      Suspender
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

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

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;

    try {
      setLoading(true);
      onError(null);
      await signInAdmin(email, password);
      await onSuccess();
    } catch (error) {
      onError(readAuthError(error));
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
      <p className="mt-2 text-sm leading-6 text-white/65">Entre para gerenciar aprovações pendentes.</p>
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
    </form>
  );
};

const ApprovalsShell = ({ children }: { children: React.ReactNode }) => (
  <main className="min-h-screen px-4 py-6 text-white md:px-8">
    <div className="mx-auto w-full max-w-7xl">{children}</div>
  </main>
);

const ApprovalsSkeleton = ({ compact = false }: { compact?: boolean }) => (
  <section className={compact ? "space-y-3" : "panel p-5"}>
    {Array.from({ length: compact ? 4 : 6 }).map((_, index) => (
      <div className="h-14 animate-pulse rounded-md bg-white/10" key={index} />
    ))}
  </section>
);

const NoticeBanner = ({ notice }: { notice: Exclude<Notice, null> }) => (
  <div
    className={`mb-6 whitespace-pre-line rounded-lg border p-4 text-sm font-bold ${
      notice.kind === "success"
        ? "border-grass/40 bg-grass/10 text-green-100"
        : "border-red-400/40 bg-red-500/10 text-red-100"
    }`}
  >
    {notice.message}
  </div>
);


