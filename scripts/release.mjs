import { spawnSync } from 'node:child_process';

// A release never inherits the explicit development-only draft bypass.
const env = { ...process.env };
delete env.ALLOW_DRAFT;
const build = spawnSync('npm', ['run', 'build'], { env, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);
const release = spawnSync(process.execPath, ['scripts/wrangler.mjs', 'deploy', '--config', 'wrangler.jsonc', '--env='], { env, stdio: 'inherit' });
process.exitCode = release.status ?? 1;
