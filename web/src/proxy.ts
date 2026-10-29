import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, dashboardPassword, isValidToken } from "@/lib/auth";

/** Rotas que não passam pelo login: webhook do gateway (HMAC), job (bearer), login e assets. */
const PUBLIC = [/^\/api\/ingest$/, /^\/api\/jobs\//, /^\/api\/login$/, /^\/login$/, /^\/_next\//, /^\/favicon\.ico$/];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();

  // Sem senha configurada: libera só fora de produção (dev local).
  if (!dashboardPassword()) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("erro", "sem_senha");
    return pathname.startsWith("/api/") ? NextResponse.json({ error: "DASHBOARD_PASSWORD não configurada" }, { status: 503 }) : NextResponse.redirect(url);
  }

  if (await isValidToken(req.cookies.get(AUTH_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
