import { db, organizations } from "@/db";

/**
 * MVP single tenant: garante uma organização padrão.
 * Toda tabela já carrega org_id, então virar multi tenant é só trocar esta função
 * por "org do usuário logado".
 */
export async function getDefaultOrg() {
  const [existing] = await db.select().from(organizations).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(organizations).values({ name: "Minha empresa" }).returning();
  return created;
}
