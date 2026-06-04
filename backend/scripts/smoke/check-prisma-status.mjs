import { spawnSync } from 'node:child_process';
import { runSmoke } from './lib/test-context.mjs';

await runSmoke('prisma-status', async () => {
  const result = spawnSync('npx', ['prisma', 'migrate', 'status'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');

  if (result.status !== 0) throw new Error('prisma migrate status failed');

  const output = `${result.stdout}\n${result.stderr}`;
  if (/following migration\(s\) have not yet been applied/i.test(output)) {
    throw new Error('Prisma has pending migrations');
  }
});
