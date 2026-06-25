import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const reportDir = join(process.cwd(), 'reports', 'ai-launch');
mkdirSync(reportDir, { recursive: true });

const checks = [
  {
    title: 'backend build',
    command: npmCommand,
    args: ['run', 'build'],
    required: true,
  },
  {
    title: 'AI finance command contracts',
    command: npmCommand,
    args: ['run', 'test:ai-commands'],
    required: true,
  },
  {
    title: 'AI regression soft run',
    command: npmCommand,
    args: ['run', 'test:ai-regression'],
    required: false,
    env: {
      AI_REGRESSION_SOFT: '1',
      AI_RATE_LIMIT_PARSE_PER_MINUTE: '200',
      AI_RATE_LIMIT_COOLDOWN_MS: '100',
    },
  },
];

function runCheck(check) {
  return new Promise((resolve) => {
    const safeTitle = check.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const logPath = join(reportDir, `${timestamp}-${safeTitle}.log`);
    const log = createWriteStream(logPath, { flags: 'a' });

    const line = `\n=== ${check.title} ===\n`;
    process.stdout.write(line);
    log.write(line);

    const child = spawn(check.command, check.args, {
      cwd: process.cwd(),
      env: { ...process.env, ...(check.env || {}) },
      shell: false,
    });

    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      log.write(chunk);
    });

    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      log.write(chunk);
    });

    child.on('close', (code) => {
      const footer = `\n[${check.title}] exit code: ${code}\nLog: ${logPath}\n`;
      process.stdout.write(footer);
      log.write(footer);
      log.end();
      resolve({ ...check, code, logPath });
    });
  });
}

const results = [];
for (const check of checks) {
  const result = await runCheck(check);
  results.push(result);
  if (result.required && result.code !== 0) {
    break;
  }
}

const failedRequired = results.filter((result) => result.required && result.code !== 0);
const failedOptional = results.filter((result) => !result.required && result.code !== 0);

console.log('\n=== AI launch checks summary ===');
for (const result of results) {
  const mark = result.code === 0 ? '✓' : result.required ? '✕' : '⚠';
  console.log(`${mark} ${result.title} (${result.code})`);
  console.log(`  ${result.logPath}`);
}

if (failedOptional.length > 0) {
  console.log('\nOptional AI regression finished with findings. Review the log before ads.');
}

if (failedRequired.length > 0) {
  process.exit(1);
}
