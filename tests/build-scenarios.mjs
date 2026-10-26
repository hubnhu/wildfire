import assert from 'node:assert/strict';
import { readFile, writeFile, rm, access } from 'node:fs/promises';
import { spawnSync, spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';

const projectPath = 'src/data/projects.json';
const initiatorPath = 'src/data/initiators.json';
const rolePath = 'src/data/roles.json';
const sitePath = 'src/data/site.json';
const originalInitiators = await readFile(initiatorPath);
const originalRoles = await readFile(rolePath);
const originalSite = await readFile(sitePath);
const initiators = JSON.parse(originalInitiators);
const roles = JSON.parse(originalRoles);
const site = JSON.parse(originalSite);
const termsPath = 'src/data/terms/current.json';
const archivePath = 'src/data/terms/archive/2026-09-01.json';
const originalProjects = await readFile(projectPath);
const originalTerms = await readFile(termsPath);
const projects = JSON.parse(originalProjects.toString());
const terms = JSON.parse(originalTerms.toString());
try { await access(archivePath); throw new Error('测试归档路径已被真实数据占用，停止。'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const build = () => {
  const result = spawnSync('npm', ['run', 'build:draft'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stdout + result.stderr);
};
const read = (path) => readFile(`dist/${path}`, 'utf8');
let server;
let browser;
try {
  server = spawn(process.execPath, ['scripts/serve.mjs'], { env: { ...process.env, PORT: '4322' }, stdio: 'pipe' });
  await new Promise((resolve, reject) => {
    server.stdout.once('data', resolve);
    server.once('error', reject);
    server.once('exit', (code) => reject(new Error(`Local server exited: ${code}`)));
  });
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  browser = await chromium.launch(existsSync(chrome) ? { executablePath: chrome } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  const scenarios = [
    ['unpublished-fixture', [...projects, { ...projects[0], slug: 'unpublished-example', name: '未发布测试项目', published: false, acceptingApplications: false }], projects.length],
    ['hide-point', projects.map((project) => ({ ...project, published: project.slug === 'point' ? false : project.published, acceptingApplications: project.slug === 'point' ? false : project.acceptingApplications })), projects.length - 1],
    ['one-project', projects.map((project) => ({ ...project, published: project.slug === 'taste', acceptingApplications: false })), 1],
    ['ten-projects', Array.from({ length: 10 }, (_, index) => ({ ...projects[0], slug: `test-${index}`, name: `测试项目 ${index}`, published: true })), 10],
  ];
  for (const [label, data, count] of scenarios) {
    await writeFile(projectPath, JSON.stringify(data, null, 2)); build();
    const home = await read('index.html');
    const apply = await read('apply/index.html');
    const initiator = await read('initiators/bai/index.html');
    assert.equal((home.match(/class="project-card"/g) || []).length, count);
    assert.match(home, new RegExp(`data-count>${count}</span>`));
    assert.equal((apply.match(/<option /g) || []).length, 1 + data.filter((item) => item.published && item.acceptingApplications).length);
    assert(apply.includes('value="any"'));
    assert.equal((initiator.match(/class="initiator-project stack/g) || []).length, data.filter((item) => item.published && item.initiator === 'bai').length);
    if (label === 'unpublished-fixture') {
      for (const html of [home, apply, initiator]) assert(!html.includes('未发布测试项目'));
      await page.goto('http://127.0.0.1:4322/apply?project=unpublished-example');
      assert.equal(await page.locator('#f-project').inputValue(), 'any');
    }
    if (label === 'hide-point') {
      assert(!home.includes('/projects/point')); assert(!apply.includes('value="point"')); assert(!initiator.includes('/projects/point'));
      const response = await fetch('http://127.0.0.1:4322/projects/point'); assert.equal(response.status, 404);
    }
    for (const path of ['/', '/apply', '/initiators/bai']) {
      await page.goto(`http://127.0.0.1:4322${path}`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label} overflows ${path}`);
    }
    console.log(`PASS ${label}: cards/count/options/initiator and 390px layout`);
  }

  // Fresh processes import the edited JSON graph, avoiding the local server's module cache.
  const checkApplication = (project, role, expected, projectName) => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import { handleApply } from './worker/index.mjs';
      import { termsVersion, site } from './src/lib/content.mjs';
      const [project, role, expected, projectName] = process.argv.slice(1);
      const form = new FormData();
      for (const [key, value] of Object.entries({ name: '数据场景申请', contact: 'synthetic@example.invalid', status: 'student', project, time: '测试投入', tos: 'yes', termsVersion })) form.set(key, value);
      form.set('role', role); form.set('resume', new File(['%PDF-1.4\\n'], 'synthetic.pdf', { type: 'application/pdf' }));
      let mail, calls = 0;
      const response = await handleApply(new Request('https://example.invalid/api/apply', { method: 'POST', body: form, headers: { Accept: 'application/json' } }), {
        EMAIL_PROVIDER: 'resend', EMAIL_API_KEY: 'synthetic-only', EMAIL_FROM: 'sender@example.invalid', APPLY_TO_EMAIL: 'owner@example.invalid', TERMS_VERSION: termsVersion, RESUME_MAX_MB: String(site.resumeMaxMb), APPLY_RATE_LIMITER: { limit: async () => ({ success: true }) },
      }, { fetcher: async (_url, init) => { calls++; mail = JSON.parse(init.body); return Response.json({ id: 'synthetic-message' }); } });
      assert.equal(response.status, Number(expected));
      if (Number(expected) === 200) {
        assert.equal(calls, 1); assert.equal(mail.subject, '【野火申请】数据场景申请 · ' + projectName);
        assert(mail.text.includes('想加入哪个项目：' + projectName)); assert(mail.text.includes('想做的岗位：测试岗位'));
        assert.deepEqual(mail.to, ['owner@example.invalid']);
      } else {
        assert.equal(calls, 0); assert.equal((await response.json()).message, '这个项目暂未开放申请，请重新选择。');
      }
    `, project, role, String(expected), projectName], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  };
  const newInitiator = { slug: 'synthetic-founder', name: '测试发起人', oneLiner: '合成发起人介绍', bio: ['合成简介'], xhsUrl: initiators[0].xhsUrl, links: [{ label: '合成博客', url: 'https://example.invalid/blog' }] };
  const newRole = { id: 'synthetic-role', name: '测试岗位' };
  const newProject = { ...projects[0], slug: 'synthetic-project', name: '测试开放项目', initiator: newInitiator.slug, acceptingApplications: true, hasDetailPage: true, about: ['合成项目介绍'], progress: ['合成进展'], roles: [{ role: newRole.id, description: '合成岗位说明' }] };
  const data = [...projects, newProject];
  await writeFile(initiatorPath, JSON.stringify([...initiators, newInitiator, { ...newInitiator, slug: 'synthetic-orphan', name: '没有已发布项目的发起人' }]));
  await writeFile(rolePath, JSON.stringify([...roles, newRole]));
  await writeFile(sitePath, JSON.stringify({ ...site, founder: newInitiator.slug }));
  await writeFile(projectPath, JSON.stringify(data)); build();
  const home = await read('index.html');
  assert.equal((home.match(/class="project-card"/g) || []).length, projects.length + 1);
  assert(home.includes(`data-count>${projects.length + 1}</span>`));
  assert(home.includes('测试开放项目') && home.includes('需要</dt><dd>测试岗位'));
  assert(home.includes('<h2>测试发起人</h2>'));
  const initiator = await read(`initiators/${newInitiator.slug}/index.html`);
  assert(initiator.includes('测试发起人') && initiator.includes('/projects/synthetic-project'));
  assert(!existsSync('dist/initiators/synthetic-orphan/index.html'));
  await page.goto(`http://127.0.0.1:4322/initiators/${newInitiator.slug}`);
  const publicLink = page.getByRole('link', { name: '合成博客', exact: true });
  assert.equal(await publicLink.getAttribute('href'), 'https://example.invalid/blog');
  assert.equal(await publicLink.getAttribute('target'), '_blank');
  assert.equal(await publicLink.getAttribute('rel'), 'noopener noreferrer');
  const detail = await read(`projects/${newProject.slug}/index.html`);
  assert(detail.includes('测试开放项目') && detail.includes('测试岗位') && detail.includes('合成岗位说明'));
  assert(!detail.includes('是一份真实工作的样子'));
  assert(detail.includes('/apply?project=synthetic-project') && detail.includes('想做测试开放项目？'));
  const extendedApply = await read('apply/index.html');
  assert(extendedApply.includes('value="synthetic-project">测试开放项目</option>'));
  assert(extendedApply.includes('name="role" value="synthetic-role"') && extendedApply.includes('测试岗位'));
  checkApplication(newProject.slug, newRole.id, 200, newProject.name);
  for (const route of ['/', '/apply', '/initiators/synthetic-founder', '/projects/synthetic-project']) {
    await page.goto(`http://127.0.0.1:4322${route}`);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `data-only addition overflows ${route}`);
  }
  console.log('PASS data-only addition: founder, role, project, pages, options and backend/email name');
  newProject.acceptingApplications = false;
  await writeFile(projectPath, JSON.stringify(data)); build();
  assert(!(await read('apply/index.html')).includes('value="synthetic-project"'));
  assert(!(await read('projects/synthetic-project/index.html')).includes('/apply?project=synthetic-project'));
  assert(!(await read('projects/synthetic-project/index.html')).includes('加入之后'));
  checkApplication(newProject.slug, newRole.id, 400, newProject.name);
  console.log('PASS project switch: option removed, generic application link and backend rejection without email');
  await writeFile(initiatorPath, originalInitiators);
  await writeFile(rolePath, originalRoles);
  await writeFile(sitePath, originalSite);

  // Reject each invalid relationship before page generation.
  const invalidCases = [
    ...[{ label: ' ', url: 'https://example.invalid' }, { label: '博客', url: 'http://example.invalid' }, { label: '博客' }].map((link) => [initiatorPath, initiators.map((item, i) => i === 0 ? { ...item, links: [link] } : item), '发起人链接需要非空 label 和 https:// URL']),
    [initiatorPath, initiators.map((item, i) => i === 0 ? { ...item, links: {} } : item), '发起人 links 必须为数组'],
    [rolePath, [...roles, roles[0]], '岗位 id 不得重复'],
    [projectPath, projects.map((item, i) => i === 0 ? { ...item, roles: [{ role: 'missing-role' }] } : item), '项目岗位不存在'],
    [projectPath, projects.map((item, i) => i === 0 ? { ...item, initiator: '' } : item), '已发布项目必须有发起人'],
    [projectPath, projects.map((item, i) => i === 0 ? { ...item, initiator: 'missing-founder' } : item), '发起人不存在'],
    [projectPath, projects.map((item) => item.hasDetailPage ? { ...item, roles: item.roles.map(({ role }) => ({ role })) } : item), '详情页岗位需要说明'],
    [projectPath, projects.map((item, i) => i === 0 ? { ...item, published: false, acceptingApplications: true } : item), '开放申请的项目必须发布'],
    [sitePath, { ...site, founder: 'missing-founder' }, '站点发起人不存在'],
  ];
  const originals = new Map([[initiatorPath, originalInitiators], [projectPath, originalProjects], [rolePath, originalRoles], [sitePath, originalSite]]);
  await writeFile(projectPath, originalProjects);
  for (const [path, invalid, message] of invalidCases) {
    await writeFile(path, JSON.stringify(invalid));
    try {
      const result = spawnSync(process.execPath, ['scripts/validate-data.mjs'], { encoding: 'utf8' });
      assert.notEqual(result.status, 0); assert((result.stdout + result.stderr).includes(message));
    } finally { await writeFile(path, originals.get(path)); }
  }
  console.log('PASS data validation: catalog, founder, role descriptions and publication/application constraints');
  await writeFile(projectPath, originalProjects);
  const oldTerms = { ...terms, version: '2026-09-01' };
  await writeFile(archivePath, JSON.stringify(oldTerms, null, 2));
  await writeFile(termsPath, JSON.stringify(terms, null, 2)); build();
  const archive = await read('terms/archive/2026-09-01/index.html');
  assert(archive.includes('2026-09-01'));
  await page.goto('http://127.0.0.1:4322/terms/archive/2026-09-01');
  const archivedText = await page.locator('body').innerText();
  for (const section of oldTerms.sections) {
    assert(archivedText.includes(section.title));
    for (const text of [...section.paragraphs, ...section.items]) assert(archivedText.includes(text));
  }
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const current = await read('terms/index.html');
  const apply = await read('apply/index.html');
  assert(current.includes(`data-terms-version>最后更新：${terms.version}`));
  assert(apply.includes(`name="termsVersion" value="${terms.version}"`));
  console.log('PASS terms archive: full original text, public route, mobile layout and shared current version');
} finally {
  await browser?.close();
  if (server && server.exitCode === null) {
    server.kill('SIGTERM'); await new Promise((resolve) => server.once('exit', resolve));
  }
  await writeFile(projectPath, originalProjects);
  await writeFile(termsPath, originalTerms);
  await writeFile(initiatorPath, originalInitiators);
  await writeFile(rolePath, originalRoles);
  await writeFile(sitePath, originalSite);
  await rm(archivePath, { force: true });
  build();
  console.log('Restored project, initiator, role, site data and current terms; regenerated draft build.');
}
