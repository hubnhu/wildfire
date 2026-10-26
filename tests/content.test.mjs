import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findPlaceholders, findReleaseBlockers } from '../scripts/check-content.mjs';

test('release check catches all documented placeholder forms with locations', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'wildfire-content-'));
  try {
    await mkdir(join(directory, 'nested'));
    await writeFile(join(directory, 'index.html'), '<p>正常</p>\n[待定：回复时间]\n[待朋友同意后填写]');
    await writeFile(join(directory, 'nested', 'terms.html'), '[草稿，最后更新日期待定]');
    const matches = await findPlaceholders(directory);
    assert.equal(matches.length, 3);
    assert.deepEqual(matches[0], { path: 'index.html', line: 2, text: '[待定：回复时间]' });
    await writeFile(join(directory, 'index.html'), '已确定的内容');
    await writeFile(join(directory, 'nested', 'terms.html'), '2026-10-09');
    assert.deepEqual(await findPlaceholders(directory), []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('all placeholders block release on projects, founders, applications and terms', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'wildfire-release-'));
  try {
    for (const path of ['projects/point', 'initiators/bai', 'apply', 'terms']) await mkdir(join(directory, path), { recursive: true });
    await writeFile(join(directory, 'projects/point/index.html'), '[待定：这个方向进来具体做什么]\n[待定：新项目条件]');
    await writeFile(join(directory, 'initiators/bai/index.html'), '[待定：带人的方式。比如怎么分任务，怎么给反馈]');
    await writeFile(join(directory, 'apply/index.html'), '[待定：这个方向进来具体做什么]');
    await writeFile(join(directory, 'terms/index.html'), '[草稿，最后更新日期待定]');
    const blockers = await findReleaseBlockers(directory);
    assert.equal(blockers.length, 5);
    assert(blockers.some((item) => item.path === 'initiators/bai/index.html'));
    assert(blockers.some((item) => item.path === 'apply/index.html'));
    assert(blockers.some((item) => item.path === 'terms/index.html'));
    assert(blockers.some((item) => item.text === '[待定：新项目条件]'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
