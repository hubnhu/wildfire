import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { projects, initiators, terms, site, roles, roleNames, collaboration } from '../src/lib/content.mjs';

const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
for (const items of [projects, initiators]) {
  assert.equal(new Set(items.map((item) => item.slug)).size, items.length, 'slug 不得重复');
  for (const item of items) assert(slug.test(item.slug), `无效 slug: ${item.slug}`);
}
for (const initiator of initiators) {
  if (initiator.links !== undefined) {
    assert(Array.isArray(initiator.links), '发起人 links 必须为数组');
    for (const link of initiator.links) assert(link && typeof link.label === 'string' && link.label.trim() && typeof link.url === 'string' && link.url.startsWith('https://'), '发起人链接需要非空 label 和 https:// URL');
  }
}
assert.equal(new Set(roles.map((role) => role.id)).size, roles.length, '岗位 id 不得重复');
for (const role of roles) assert(slug.test(role.id) && typeof role.name === 'string' && role.name, '无效岗位');
assert(initiators.some((item) => item.slug === site.founder), '站点发起人不存在');
assert.equal(new Set(collaboration.map((item) => item.id)).size, collaboration.length, '协作条目 id 不得重复');
for (const project of projects) {
  assert(['想法', '开发中', '已上线', '在营业务', '筹备中'].includes(project.status), '无效项目状态');
  assert(['暂无', '低', '中', '高', '未知'].includes(project.profitPotential), '无效盈利可能');
  assert(['cocreate', 'company'].includes(project.mode), '无效项目模式');
  assert.equal(typeof project.published, 'boolean');
  assert.equal(typeof project.hasDetailPage, 'boolean');
  assert(!project.published || project.initiator, '已发布项目必须有发起人');
  assert.equal(typeof project.acceptingApplications, 'boolean', '申请开关必须为布尔值');
  assert(!project.acceptingApplications || project.published, '开放申请的项目必须发布');
  assert(!project.initiator || initiators.some((item) => item.slug === project.initiator), '发起人不存在');
  assert(Array.isArray(project.roles) && project.roles.every((item) => Object.hasOwn(roleNames, item.role)), '项目岗位不存在');
  for (const key of ['name', 'oneLiner', 'collaboration']) assert(typeof project[key] === 'string' && project[key]);
  if (project.hasDetailPage) {
    assert(project.about.length && project.progress.length && project.roles.length, '详情页需要内容');
    for (const role of project.roles) assert(typeof role.description === 'string' && role.description, '详情页岗位需要说明');
  }
}
const isDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
assert(terms.version === null || isDate(terms.version), '须知版本必须为真实日期或 null 草稿');
assert(terms.sections.length > 0);
assert(Number.isFinite(site.resumeMaxMb) && site.resumeMaxMb > 0 && site.resumeMaxMb <= 5, '简历上限不得超过已确认的 5MB');
for (const file of await readdir('src/data/terms/archive')) {
  if (!file.endsWith('.json')) continue;
  const archived = JSON.parse(await readFile(`src/data/terms/archive/${file}`, 'utf8'));
  assert(isDate(archived.version) && file === `${archived.version}.json`, '归档名必须匹配须知版本');
  assert.notEqual(archived.version, terms.version, '当前版本不得覆盖历史版本');
}
console.log(`数据检查通过：${projects.filter((item) => item.published).length} 个已发布项目。`);
