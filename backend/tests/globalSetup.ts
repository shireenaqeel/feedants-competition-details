import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

// A real (in-memory) replica set, because the booking flow relies on transactions.
export default async function setup(project: TestProject) {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, name: 'rs0', storageEngine: 'wiredTiger' } });
  project.provide('mongoUri', replSet.getUri('feedants-test'));
  return async () => {
    await replSet.stop();
  };
}
