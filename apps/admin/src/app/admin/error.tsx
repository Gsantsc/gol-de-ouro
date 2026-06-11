"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export default function AdminError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") console.error("[ADMIN ERROR]", error);
  }, [error]);

  return (
    <main className="app-shell">
      <div className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center">
        <section className="panel w-full p-6">
          <BrandLogo compact />
          <p className="mt-5 text-xs font-black uppercase tracking-normal text-gold">Falha no Admin</p>
          <h1 className="mt-2 text-3xl font-black text-white">Não foi possível carregar esta área.</h1>
          <p className="mt-3 text-sm leading-6 text-white/60">
            A sessão foi preservada. Tente recarregar o painel para repetir a operação com segurança.
          </p>
          <button className="btn-secondary mt-6 w-full" onClick={reset} type="button">
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </button>
        </section>
      </div>
    </main>
  );
}
