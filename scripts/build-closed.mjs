import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { findPlaceholders } from './check-content.mjs';
import { generateSitemap } from './generate-sitemap.mjs';

const check = spawnSync(process.execPath, ['scripts/validate-data.mjs'], { stdio: 'inherit' });
if (check.status !== 0) process.exit(check.status ?? 1);
const build = spawnSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build', '--outDir', 'dist-closed'], {
  stdio: 'inherit', env: { ...process.env, WILDFIRE_APPLICATIONS_CLOSED: '1', ASTRO_TELEMETRY_DISABLED: '1' },
});
if (build.status !== 0) process.exit(build.status ?? 1);

async function verifyHtml(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) { await verifyHtml(path); continue; }
    if (!item.name.endsWith('.html')) continue;
    const html = await readFile(path, 'utf8');
    assert.match(html, /class="closed-notice" role="status">申请暂未开放。/, `${path}: missing closed notice`);
  }
}
await verifyHtml('dist-closed');
assert.match(await readFile('dist-closed/apply/index.html', 'utf8'), /<fieldset disabled class="application-fields stack">/);
await generateSitemap('dist-closed');
const placeholders = await findPlaceholders('dist-closed');
console.log(`关闭申请构建通过：${placeholders.length} 处待定内容保留；已禁用申请。`);
