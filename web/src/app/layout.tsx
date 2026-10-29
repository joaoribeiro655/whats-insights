import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "WhatsApp Insights",
  description: "Insights de leads e atendimento a partir do WhatsApp dos vendedores",
};

const nav = [
  { href: "/", label: "Visão geral" },
  { href: "/vendedores", label: "Vendedores" },
  { href: "/conversas", label: "Conversas" },
  { href: "/leads", label: "Leads" },
  { href: "/configuracoes", label: "Configurações" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="bg-white border-b border-zinc-200">
          <div className="mx-auto max-w-7xl px-4 h-14 flex items-center gap-8">
            <Link href="/" className="font-semibold tracking-tight">WhatsApp Insights</Link>
            <nav className="flex gap-1 text-sm">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="px-3 py-1.5 rounded-md text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">{n.label}</Link>
              ))}
            </nav>
            <span className="ml-auto text-xs text-zinc-400">somente leitura · nenhuma mensagem é enviada</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 flex-1">{children}</main>
      </body>
    </html>
  );
}
