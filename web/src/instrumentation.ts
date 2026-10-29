/**
 * Agendador embutido: roda a análise das conversas pendentes a cada N minutos
 * dentro do próprio processo do Next (sem serviço externo de cron).
 * ANALYZE_EVERY_MINUTES=0 desliga (use então /api/jobs/analyze por cron externo).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const every = Number(process.env.ANALYZE_EVERY_MINUTES ?? 10);
  if (!every || every <= 0) return;
  const g = globalThis as unknown as { __wiScheduler?: NodeJS.Timeout };
  if (g.__wiScheduler) return;

  const { runAnalysisBatch } = await import("@/lib/insights");
  const { purgeOldMessages } = await import("@/lib/ingest");
  const { env } = await import("@/lib/env");

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const r = await runAnalysisBatch();
      const purged = await purgeOldMessages(env.retentionDays);
      if (r.selected || purged) console.log(`[scheduler] analisadas ${r.results.filter((x) => x.ok).length}/${r.selected}, apagadas ${purged}`);
      const failed = r.results.filter((x) => !x.ok);
      if (failed.length) console.warn(`[scheduler] falhas: ${failed.map((f) => f.error).slice(0, 3).join(" | ")}`);
    } catch (err) {
      console.error("[scheduler] erro", err);
    } finally {
      running = false;
    }
  };
  g.__wiScheduler = setInterval(() => void tick(), every * 60_000);
  g.__wiScheduler.unref?.();
  setTimeout(() => void tick(), 30_000).unref?.();
  console.log(`[scheduler] análise automática a cada ${every} min`);
}
