/**
 * Login simples por senha única (DASHBOARD_PASSWORD). Funciona no proxy (Web Crypto)
 * e nas rotas. Cookie guarda um HMAC da senha, não a senha.
 */
export const AUTH_COOKIE = "wi_auth";

async function hmacHex(secret: string, message: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function dashboardPassword() {
  return process.env.DASHBOARD_PASSWORD?.trim() || null;
}

export async function expectedToken() {
  const pw = dashboardPassword();
  if (!pw) return null;
  return hmacHex(pw, "whats-insights-session-v1");
}

export async function isValidToken(token: string | undefined | null) {
  if (!token) return false;
  const expected = await expectedToken();
  if (!expected || expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}
