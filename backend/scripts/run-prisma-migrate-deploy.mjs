#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { loadBackendEnv } from './lib/load-backend-env.mjs';

const backendRoot = process.cwd();
const loadedEnvFiles = loadBackendEnv({ backendRoot });

console.log(`Env files loaded: ${loadedEnvFiles.length ? loadedEnvFiles.join(', ') : 'none'}`);

function run(command, args) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, {
      cwd: backendRoot,
      env: process.env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('close', (code) => resolveRun(code ?? 1));
    child.on('error', (error) => {
      console.error(error);
      resolveRun(1);
    });
  });
}

const migrateCode = await run('npx', ['prisma', 'migrate', 'deploy']);
if (migrateCode !== 0) process.exit(migrateCode);

const generateCode = await run('npx', ['prisma', 'generate']);
process.exit(generateCode);
