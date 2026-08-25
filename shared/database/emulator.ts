import fs from 'node:fs';
import path from 'node:path';

console.log('--- 🚀 LOCAL DATABASE & REDIS MOCK SERVER ---');

// Verify schema files exist
const schemaDir = path.join(process.cwd(), 'shared', 'database');
const files = ['001_initial_schema.sql', '002_rank_clearances.sql', '003_crew_trust_scores.sql'];

files.forEach(file => {
  const filePath = path.join(schemaDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`  [Schema verified] -> ${file} ✅`);
  } else {
    console.log(`  [Schema missing]  -> ${file} ❌`);
  }
});

// Mock Database Connection Pools
export const mockDb = {
  shifts: new Map(),
  rankClearances: new Map(),
  trustScores: new Map(),
};

export const mockRedis = {
  cache: new Map(),
  set: (key: string, val: string) => mockRedis.cache.set(key, val),
  get: (key: string) => mockRedis.cache.get(key),
};

console.log('\nPostgreSQL (Port 5432) & Redis (Port 6379) successfully emulated in-memory!');
