import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join, relative } from 'node:path';

export async function findPlaceholders(directory) {
  const matches = [];
  async function walk(folder) {
    for (const item of await readdir(folder, { withFileTypes: true })) {
      const path = join(folder, item.name);
      if (item.isDirectory()) { await walk(path); continue; }
      if (!/\.(html|js|json|css|txt)$/i.test(item.name)) continue;
      const text = await readFile(path, 'utf8');
      for (const match of text.matchAll(/\[[^\[\]]*(?:待定|待朋友)[^\[\]]*\]/g)) {
        matches.push({ path: relative(directory, path), line: text.slice(0, match.index).split('\n').length, text: match[0] });
      }
    }
  }
  await walk(directory);
  return matches;
}

export const findReleaseBlockers = findPlaceholders;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.env.ALLOW_DRAFT === '1') {
    console.log('开发预览：已明确跳过占位符发布检查。');
  } else {
    const matches = await findReleaseBlockers(resolve('dist'));
    for (const match of matches) console.error(`${match.path}:${match.line} ${match.text}`);
    if (matches.length) { console.error(`还有 ${matches.length} 处待定内容，正式发布已阻止。`); process.exitCode = 1; }
    else console.log('占位符检查通过。');
  }
}
