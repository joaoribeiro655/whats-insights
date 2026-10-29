import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="bg-white border border-zinc-200 rounded-xl p-6 w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-lg font-semibold">Entrar</h1>
          <p className="text-sm text-zinc-500">Painel de insights do WhatsApp</p>
        </div>
        {sp.erro === "sem_senha" ? (
          <p className="text-sm text-red-700">O servidor está sem a variável <code>DASHBOARD_PASSWORD</code>. Configure e reinicie.</p>
        ) : (
          <LoginForm next={sp.next ?? "/"} />
        )}
      </div>
    </div>
  );
}
