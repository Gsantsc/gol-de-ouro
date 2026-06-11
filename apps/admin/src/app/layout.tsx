import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gol de Ouro",
  description: "Admin e experiência do usuário do bolão Gol de Ouro"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
