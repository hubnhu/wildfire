import { readFile, writeFile, mkdir } from 'node:fs/promises';

const source = await readFile('src/data/terms/current.json', 'utf8');
const { version } = JSON.parse(source);
if (!version || !/^\d{4}-\d{2}-\d{2}$/.test(version)) throw new Error('当前须知还是草稿，没有可归档的最后更新日期。');
await mkdir('src/data/terms/archive', { recursive: true });
await writeFile(`src/data/terms/archive/${version}.json`, source, { flag: 'wx' });
console.log(`已原样归档 ${version}。现在更新 current.json 的正文和版本，并同步部署 TERMS_VERSION。`);
