import { spawnSync } from 'node:child_process';

const build = spawnSync(process.execPath, ['scripts/build-closed.mjs'], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);
const deploy = spawnSync(process.execPath, ['scripts/wrangler.mjs', 'deploy', '--config', 'wrangler.closed.jsonc', '--strict', '--message', 'Applications closed'], { stdio: 'inherit' });
process.exitCode = deploy.status ?? 1;
