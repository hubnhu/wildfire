import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

await mkdir('.wrangler/logs', { recursive: true });
const child = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', ...process.argv.slice(2)], {
  stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG_PATH: '.wrangler/logs' },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => { process.exitCode = code ?? 1; });
