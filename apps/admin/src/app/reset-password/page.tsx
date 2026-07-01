"use client";

import { useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { supabase } from "@/lib/supabase";
import {
  PASSWORD_RESET_INVALID_LINK_MESSAGE,
  updateUserPassword
} from "@/lib/user-api";

const validatePassword = (password: string, confirmPassword: string) => {
  if (password.length < 8) return "A senha deve ter pelo menos 8 caracteres.";
  if (!/[A-Za-z]/.test(password)) return "A senha deve ter pelo menos uma letra.";
  if (!/[0-9]/.test(password)) return "A senha deve ter pelo menos um numero.";
  if (password !== confirmPassword) return "As senhas nao conferem.";
  return null;
};

export default function ResetPasswordPage() {
  const [checkingLink, setCheckingLink] = useState(true);
  const [linkIsValid, setLinkIsValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const prepareRecoverySession = async () => {
      try {
        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
        const linkError = hashParams.get("error") ?? url.searchParams.get("error");

        if (linkError) {
          throw new Error(hashParams.get("error_description") ?? url.searchParams.get("error_description") ?? linkError);
        }

        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const code = url.searchParams.get("code");

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          if (sessionError) throw sessionError;
          window.history.replaceState(null, "", window.location.pathname);
        } else if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          window.history.replaceState(null, "", window.location.pathname);
        } else {
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          if (!data.session) throw new Error("missing recovery session");
        }

        if (!mounted) return;
        setLinkIsValid(true);
        setError(null);
      } catch {
        if (!mounted) return;
        setLinkIsValid(false);
        setError(PASSWORD_RESET_INVALID_LINK_MESSAGE);
      } finally {
        if (mounted) setCheckingLink(false);
      }
    };

    prepareRecoverySession();

    return () => {
      mounted = false;
    };
  }, []);

  const formIsFilled = useMemo(
    () => Boolean(password && confirmPassword),
    [confirmPassword, password]
  );

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || !linkIsValid) return;

    const validationMessage = validatePassword(password, confirmPassword);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await updateUserPassword(password);
      setSuccess("Senha redefinida com sucesso. Redirecionando para o login...");
      await supabase.auth.signOut({ scope: "global" });
      window.setTimeout(() => window.location.assign("/dashboard"), 1200);
    } catch {
      setError(PASSWORD_RESET_INVALID_LINK_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="app-shell">
      <form className="mx-auto mt-12 max-w-md panel p-6 shadow-panel" onSubmit={submit}>
        <BrandLogo />
        <h1 className="mt-5 text-3xl font-black">Redefinir senha</h1>

        {checkingLink ? (
          <p className="mt-5 text-sm font-bold text-white/65">Validando link de recuperacao...</p>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-md border border-red-400/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mt-5 rounded-md border border-gold/30 bg-gold/10 p-4 text-sm font-bold text-gold">
            {success}
          </div>
        ) : null}

        {linkIsValid ? (
          <>
            <label className="mt-6 block text-sm font-bold text-white/70">Nova senha</label>
            <input
              className="input mt-2 w-full"
              disabled={loading || Boolean(success)}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />

            <label className="mt-4 block text-sm font-bold text-white/70">Confirmar senha</label>
            <input
              className="input mt-2 w-full"
              disabled={loading || Boolean(success)}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              value={confirmPassword}
            />

            <button
              className="btn-primary mt-6 w-full"
              disabled={loading || Boolean(success) || !formIsFilled}
            >
              {loading ? "Aguarde..." : "Salvar nova senha"}
            </button>
          </>
        ) : !checkingLink ? (
          <button
            className="btn-primary mt-6 w-full"
            onClick={() => window.location.assign("/dashboard")}
            type="button"
          >
            Voltar ao login
          </button>
        ) : null}
      </form>
    </main>
  );
}
