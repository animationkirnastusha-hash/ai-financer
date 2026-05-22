import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const confirmed = process.env.RESET_CONFIRM === 'RESET';
if (!confirmed) {
  console.error('SQLite reset cancelled. Set RESET_CONFIRM=RESET to run.');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !databaseUrl.startsWith('file:')) {
  console.error(`This script supports only SQLite file: DATABASE_URL. Current value: ${databaseUrl || '(not set)'}`);
  process.exit(1);
}

let raw = databaseUrl.replace(/^file:/, '').replace(/^"|"$/g, '');
let dbPath = raw;

if (!path.isAbsolute(dbPath)) {
  // Prisma resolves relative SQLite paths from the prisma schema directory.
  dbPath = path.resolve(process.cwd(), 'prisma', dbPath);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = `${dbPath}.backup.${timestamp}`;

console.log(`DATABASE_URL=${databaseUrl}`);
console.log(`Resolved SQLite DB path=${dbPath}`);

if (fs.existsSync(dbPath)) {
  fs.copyFileSync(dbPath, backupPath);
  fs.unlinkSync(dbPath);
  console.log(`Backup created: ${backupPath}`);
  console.log('Database file removed. Run: npx prisma migrate deploy');
} else {
  console.log('Database file does not exist. Nothing removed. Run: npx prisma migrate deploy');
}
