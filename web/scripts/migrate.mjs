// Aplica as migrations da pasta ./drizzle usando só drizzle-orm + postgres
// (sem drizzle-kit/esbuild, que não existem na imagem final do Docker).
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL ausente"); process.exit(1); }

const sql = postgres(url, { max: 1 });
try {
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  console.log("[migrate] migrations aplicadas");
} catch (err) {
  console.error("[migrate] falhou", err);
  process.exit(1);
} finally {
  await sql.end();
}
