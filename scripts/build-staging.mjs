import { spawnSync } from 'node:child_process';
import { appendFile, cp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Staging serves exactly the production build; only search indexing is turned off.
const outDir = 'dist-staging';
const env = { ...process.env };
delete env.ALLOW_DRAFT;
const build = spawnSync('npm', ['run', 'build'], { env, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);

await rm(outDir, { recursive: true, force: true });
await cp('dist', outDir, { recursive: true });
await Promise.all([
  appendFile(join(outDir, '_headers'), '\n/*\n  X-Robots-Tag: noindex, nofollow\n'),
  writeFile(join(outDir, 'robots.txt'), 'User-agent: *\nDisallow: /\n'),
  rm(join(outDir, 'sitemap.xml'), { force: true }),
  rm(join(outDir, 'BingSiteAuth.xml'), { force: true }),
]);
console.log('测试站构建通过：与正式构建一致，禁止索引。');
