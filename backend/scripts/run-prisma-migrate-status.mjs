#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { loadBackendEnv } from './lib/load-backend-env.mjs';

const backendRoot = process.cwd();
const loadedEnvFiles = loadBackendEnv({ backendRoot });

console.log(`Env files loaded: ${loadedEnvFiles.length ? loadedEnvFiles.join(', ') : 'none'}`);

const child = spawn('npx', ['prisma', 'migrate', 'status'], {
  cwd: backendRoot,
  env: process.env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('close', (code) => process.exit(code ?? 1));
child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
