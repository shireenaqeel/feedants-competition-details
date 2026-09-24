import { env } from './config/env.js';
import { connectDb, disconnectDb } from './db/connect.js';
import { startHoldSweeper } from './jobs/expireHolds.js';
import { loadDemoDataIfEmpty } from './data/demoData.js';
import { initModels } from './models/index.js';
import { createApp } from './app.js';

async function main() {
  await connectDb(env.mongoUri);
  await initModels();
  if (env.seedDemoDataOnEmpty && (await loadDemoDataIfEmpty())) {
    console.log('Empty database: loaded the default competitions (past / ongoing / upcoming) and demo users');
  }
  const stopSweeper = startHoldSweeper(env.holdSweepIntervalMs);

  const server = createApp().listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port} (payments: ${env.payment.provider})`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    stopSweeper();
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
