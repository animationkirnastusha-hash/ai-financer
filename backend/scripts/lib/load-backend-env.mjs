import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function normalizeEnvFilePath(candidate, backendRoot) {
  if (!candidate) return null;
  return path.isAbsolute(candidate) ? candidate : path.resolve(backendRoot, candidate);
}

export function loadBackendEnv(options = {}) {
  const backendRoot = options.backendRoot || process.cwd();
  const projectRoot = path.resolve(backendRoot, '..');
  const explicitEnvFile = normalizeEnvFilePath(process.env.BACKEND_ENV_FILE, backendRoot);

  const candidates = unique([
    explicitEnvFile,
    path.resolve(backendRoot, '.env'),
    path.resolve(projectRoot, '.env'),
    '/root/ai-financer-secrets/backend.env',
  ]);

  const loaded = [];

  for (const envPath of candidates) {
    if (!envPath || !fs.existsSync(envPath)) continue;
    dotenv.config({ path: envPath, override: false });
    loaded.push(envPath);
  }

  return loaded;
}
