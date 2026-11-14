import { spawnSync } from 'node:child_process';
import { appendFile, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { findPlaceholders } from './check-content.mjs';
import { generateSitemap } from './generate-sitemap.mjs';

const staging = process.argv.includes('--staging');
const outDir = staging ? 'dist-staging' : 'dist-closed';
const check = spawnSync(process.execPath, ['scripts/validate-data.mjs'], { stdio: 'inherit' });
if (check.status !== 0) process.exit(check.status ?? 1);
const build = spawnSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build', '--outDir', outDir], {
  stdio: 'inherit', env: { ...process.env, WILDFIRE_APPLICATIONS_CLOSED: staging ? '0' : '1', ASTRO_TELEMETRY_DISABLED: '1' },
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
const form = await readFile(join(outDir, 'apply/index.html'), 'utf8');
const placeholders = await findPlaceholders(outDir);
if (staging) {
  assert.doesNotMatch(form, /<fieldset disabled class="application-fields stack">/);
  assert.equal(placeholders.length, 0, `测试站仍有待定内容：${JSON.stringify(placeholders)}`);
  await Promise.all([
    appendFile(join(outDir, '_headers'), '\n/*\n  X-Robots-Tag: noindex, nofollow\n'),
    writeFile(join(outDir, 'robots.txt'), 'User-agent: *\nDisallow: /\n'),
    rm(join(outDir, 'sitemap.xml'), { force: true }),
    rm(join(outDir, 'BingSiteAuth.xml'), { force: true }),
  ]);
  console.log('测试站构建通过：申请开放，禁止索引。');
} else {
  await verifyHtml(outDir);
  assert.match(form, /<fieldset disabled class="application-fields stack">/);
  await generateSitemap(outDir);
  console.log(`关闭申请构建通过：${placeholders.length} 处待定内容保留；已禁用申请。`);
}
