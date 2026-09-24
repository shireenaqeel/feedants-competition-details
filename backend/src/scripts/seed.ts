import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDb, disconnectDb } from '../db/connect.js';
import { DEMO_PHONE, loadDemoData, ORGANIZER_PHONE } from '../data/demoData.js';
import { allModels, initModels } from '../models/index.js';

// Resets the development database to the demo data (the API also loads it automatically the
// first time it starts against an empty database).
async function seed() {
  if (env.isProduction) throw new Error('Refusing to seed a production database');
  await connectDb(env.mongoUri);
  await Promise.all(allModels.map((m) => m.deleteMany({})));
  await mongoose.connection.collection('meta').deleteMany({});
  await initModels();
  const { competitions } = await loadDemoData();

  console.log('Seeded default competitions (dates relative to now):');
  for (const [stage, slugs] of Object.entries(competitions)) console.log(`  ${stage.padEnd(9)} ${slugs.join(', ')}`);
  console.log(`Demo participant login → ${DEMO_PHONE}`);
  console.log(`Demo organizer login   → ${ORGANIZER_PHONE}`);
  await disconnectDb();
}

seed().catch(async (err) => {
  console.error('Seed failed:', err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
