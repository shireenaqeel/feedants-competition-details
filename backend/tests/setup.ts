import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, inject } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = inject('mongoUri');
process.env.JWT_SECRET = 'test-secret';
process.env.PAYMENT_PROVIDER = 'mock';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'feedants-test-uploads');

const { default: mongoose } = await import('mongoose');
const { initModels, allModels } = await import('../src/models/index.js');
const { clock } = await import('../src/lib/clock.js');

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  await initModels();
});

afterEach(async () => {
  clock.reset();
  await Promise.all(allModels.map((m) => m.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
});
