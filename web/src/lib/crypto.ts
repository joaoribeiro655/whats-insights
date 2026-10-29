import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "./env";

/** AES-256-GCM com chave derivada de APP_SECRET. Formato: base64(iv).base64(tag).base64(dados) */
function key() {
  return createHash("sha256").update(env.appSecret).digest();
}

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${data.toString("base64")}`;
}

export function decrypt(payload: string) {
  const [iv, tag, data] = payload.split(".");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

export function maskKey(k: string) {
  if (k.length <= 12) return "••••";
  return `${k.slice(0, 10)}…${k.slice(-4)}`;
}
