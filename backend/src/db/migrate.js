import { runMigrations, closePool } from './index.js';

try {
  await runMigrations();
  console.log('Database migrations completed.');
} finally {
  await closePool();
}
