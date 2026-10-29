import { config } from './config.js';
import { logger } from './logger.js';
import { buildServer } from './server.js';
import { resumeSavedSessions, shutdown } from './wa.js';

const app = buildServer();

async function main() {
  await app.listen({ port: config.port, host: config.host });
  logger.info({ port: config.port, dataDir: config.dataDir }, 'gateway no ar (somente leitura)');
  await resumeSavedSessions();
}

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    logger.info({ sig }, 'encerrando');
    await shutdown();
    await app.close();
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error({ err }, 'falha fatal');
  process.exit(1);
});
