import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { handleApply } from '../worker/index.mjs';
import worker from '../worker/index.mjs';
import { validateResume, validateApplication } from '../worker/validation.mjs';
import { formatApplicationEmail } from '../worker/email.mjs';
import { publishedProjects, initiatorProjects, site, applicationProjects, projects, termsVersion } from '../src/lib/content.mjs';

const VERSION = termsVersion;
const NOW = new Date('2026-10-09T20:30:15.000Z');
const pdf = (size = 40) => {
  const bytes = Buffer.alloc(size, 0x20); bytes.write('%PDF-1.4\n');
  return new File([bytes], 'resume.pdf', { type: 'application/pdf' });
};
const form = () => {
  const data = new FormData();
  for (const [key, value] of Object.entries({ name: '测试申请人', contact: 'test@example.invalid', status: 'student', project: 'any', time: '如实填写', work: '测试作品', why: '测试申请', tos: 'yes', termsVersion: VERSION })) data.set(key, value);
  data.append('role', 'dev'); data.append('role', 'design');
  data.set('resume', pdf());
  return data;
};
const request = (body = form(), headers = {}) => new Request('https://wildfire.example/api/apply', { method: 'POST', body, headers: { Accept: 'application/json', Origin: 'https://wildfire.example', ...headers } });
const environment = () => ({
  EMAIL_PROVIDER: 'resend', EMAIL_API_KEY: 'test-only', EMAIL_FROM: 'apply@wildfire.example', APPLY_TO_EMAIL: 'owner@example.invalid', TERMS_VERSION: VERSION, RESUME_MAX_MB: '5',
  APPLY_RATE_LIMITER: { limit: async () => ({ success: true }) },
});
const successful = async () => Response.json({ id: 'test-message' });
const options = { version: VERSION, now: NOW, fetcher: successful };

test('closed mode rejects submission before reading attachments or contacting email provider', async () => {
  const incoming = request();
  let read = false;
  incoming.body.getReader = () => { read = true; throw new Error('closed mode must not read attachments'); };
  let sent = false;
  const response = await handleApply(incoming, { ...environment(), APPLICATIONS_CLOSED: '1' }, {
    ...options, fetcher: async () => { sent = true; return successful(); },
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { ok: false, message: '申请暂未开放。' });
  assert.equal(read, false);
  assert.equal(sent, false);
});

test('successful submit creates one email with attachment, ordered fields and consent evidence', async () => {
  const calls = [];
  const response = await handleApply(request(), environment(), { ...options, fetcher: async (url, init) => { calls.push({ url, init }); return successful(); } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, message: '' });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  const mail = JSON.parse(calls[0].init.body);
  assert.equal(mail.subject, '【野火申请】测试申请人 · 还没确定，想先聊聊');
  assert.deepEqual(mail.to, ['owner@example.invalid']);
  assert.equal(mail.from, 'apply@wildfire.example');
  assert.equal(mail.reply_to, 'test@example.invalid');
  assert.equal(Buffer.from(mail.attachments[0].content, 'base64').subarray(0, 5).toString(), '%PDF-');
  assert(mail.text.endsWith(`已勾选同意参与须知：是\n参与须知最后更新：${VERSION}\n提交时间（北京时间）：2026-10-10 04:30:15（UTC 2026-10-09 20:30:15）`));
  const labels = ['怎么称呼你', '联系方式', '你现在的状态', '想加入哪个项目', '想做的岗位', '简历', '每周大概能投入多少时间', '你做过的东西', '为什么想来'];
  const positions = labels.map((label) => mail.text.indexOf(`${label}：`));
  assert(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1])));
});

test('open project uses its name in email and accepts every catalog role without project filtering', async () => {
  const body = form(); body.set('project', 'wildfire'); body.delete('role');
  body.append('role', 'social'); body.append('role', 'data');
  let mail;
  const response = await handleApply(request(body), environment(), { ...options, fetcher: async (_url, init) => { mail = JSON.parse(init.body); return successful(); } });
  assert.equal(response.status, 200);
  assert.equal(mail.subject, '【野火申请】测试申请人 · 野火本身');
  assert.match(mail.text, /想加入哪个项目：野火本身\n想做的岗位：社交媒体运营、数据/);
  assert.deepEqual(mail.to, [environment().APPLY_TO_EMAIL]);
});

for (const [slug, name] of [['point', 'Point'], ['holdem-manager', 'Holdem Manager'], ['taste', 'Taste'], ['stadium', 'Stadium']]) test(`${name} application uses the actual project name in mail`, async () => {
  const body = form(); body.set('project', slug);
  let mail;
  const response = await handleApply(request(body), environment(), { ...options, fetcher: async (_url, init) => { mail = JSON.parse(init.body); return successful(); } });
  assert.equal(response.status, 200);
  assert.equal(mail.subject, `【野火申请】测试申请人 · ${name}`);
  assert(mail.text.includes(`想加入哪个项目：${name}`));
  assert.deepEqual(mail.to, [environment().APPLY_TO_EMAIL]);
});

test('closed or unpublished project never sends and invalid roles use the requested message', async () => {
  const project = projects.find((item) => item.slug === 'wildfire');
  for (const field of ['acceptingApplications', 'published']) {
    const previous = project[field];
    try {
      project[field] = false;
      const body = form(); body.set('project', project.slug);
      let sent = false;
      const response = await handleApply(request(body), environment(), { ...options, fetcher: async () => { sent = true; return successful(); } });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).message, '这个项目暂未开放申请，请重新选择。');
      assert.equal(sent, false);
    } finally { project[field] = previous; }
  }
  for (const role of ['ops', 'growth', '__proto__', 'unknown']) {
    const body = form(); body.set('role', role);
    const response = await handleApply(request(body), environment(), options);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).message, '请选择有效的岗位。');
  }
});

test('email aliases can be replied to without changing the fixed sender or receiver', async () => {
  const body = form(); body.set('contact', 'applicant+wildfire@example.invalid');
  let mail;
  const response = await handleApply(request(body), environment(), { ...options, fetcher: async (_url, init) => { mail = JSON.parse(init.body); return successful(); } });
  assert.equal(response.status, 200);
  assert.equal(mail.reply_to, 'applicant+wildfire@example.invalid');
  assert.equal(mail.from, environment().EMAIL_FROM);
  assert.deepEqual(mail.to, [environment().APPLY_TO_EMAIL]);
});

test('WeChat IDs and free text remain valid contacts without becoming reply headers', async () => {
  for (const contact of ['wechat_test', '邮箱：test@example.invalid', 'test@example.invalid, other@example.invalid', 'Applicant <test@example.invalid>', 'test..name@example.invalid']) {
    const body = form(); body.set('contact', contact);
    let mail;
    const response = await handleApply(request(body), environment(), { ...options, fetcher: async (_url, init) => { mail = JSON.parse(init.body); return successful(); } });
    assert.equal(response.status, 200);
    assert.equal(Object.hasOwn(mail, 'reply_to'), false);
    assert(mail.text.includes(`联系方式：${contact}`));
  }
});

for (const [field, replacement, expected] of [
  ['name', '', 400], ['contact', '   ', 400], ['time', '', 400], ['status', 'invented', 400], ['tos', 'no', 400],
  ['project', 'unpublished-example', 400], ['project', 'missing', 400], ['name', 'header\r\ninjection', 400],
  ['contact', 'test@example.invalid\r\nBcc: other@example.invalid', 400],
  ['resume', new File(['text'], 'resume.exe'), 400], ['resume', new File(['not a PDF'], 'resume.pdf', { type: 'application/pdf' }), 400],
  ['resume', pdf(5 * 1024 * 1024 + 1), 413],
]) {
  test(`rejects invalid ${field}: ${typeof replacement === 'string' ? JSON.stringify(replacement) : replacement.name}`, async () => {
    const body = form(); body.set(field, replacement);
    let sent = false;
    const response = await handleApply(request(body), environment(), { ...options, fetcher: async () => { sent = true; return successful(); } });
    assert.equal(response.status, expected); assert.equal(sent, false); assert.equal((await response.json()).ok, false);
  });
}

test('accepts exactly 5MiB and produces attachment with identical bytes', async () => {
  const body = form(); const file = pdf(5 * 1024 * 1024); body.set('resume', file);
  let captured;
  const response = await handleApply(request(body), environment(), { ...options, fetcher: async (_url, init) => { captured = JSON.parse(init.body); return successful(); } });
  assert.equal(response.status, 200);
  assert.equal(Buffer.from(captured.attachments[0].content, 'base64').length, file.size);
});

test('valid DOCX must contain Word document and content type entries', async () => {
  const good = new File([await readFile('tests/fixtures/resume.docx')], 'resume.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  await validateResume(good);
  await assert.rejects(validateResume(new File([await readFile('tests/fixtures/ordinary.zip')], 'resume.docx')), /有效的 Word/);
});

test('DOC must have compound-document signature', async () => {
  await validateResume(new File([Buffer.from('d0cf11e0a1b11ae1', 'hex')], 'resume.doc', { type: 'application/msword' }));
  await assert.rejects(validateResume(new File(['fake'], 'resume.doc', { type: 'application/msword' })), /有效的 Word/);
});

test('duplicate fields, unknown role and multiple resumes cannot bypass validation', async () => {
  for (const mutate of [
    (body) => body.append('name', 'duplicate'), (body) => body.append('role', 'invalid'), (body) => body.append('resume', pdf()),
  ]) {
    const body = form(); mutate(body);
    assert.equal((await handleApply(request(body), environment(), options)).status, 400);
  }
});

test('email failure and timeout never report success or expose provider data', async () => {
  for (const fetcher of [async () => Response.json({ error: 'private provider detail' }, { status: 500 }), async () => { throw new Error('private timeout detail'); }, async () => Response.json({})]) {
    const response = await handleApply(request(), environment(), { ...options, fetcher });
    assert.equal(response.status, 502);
    assert.equal((await response.json()).message, '提交没有成功，请稍后再试。');
  }
});

test('missing email configuration, draft terms and version mismatch block sending', async () => {
  for (const [env, dependencies] of [
    [{ ...environment(), EMAIL_API_KEY: '' }, options],
    [environment(), { version: '', fetcher: successful }],
    [{ ...environment(), TERMS_VERSION: '2026-10-08' }, options],
    [{ ...environment(), RESUME_MAX_MB: '10' }, options],
  ]) {
    const response = await handleApply(request(), env, dependencies);
    assert(response.status >= 500); assert.equal((await response.json()).ok, false);
  }
});

test('stale consent version is rejected', async () => {
  const body = form(); body.set('termsVersion', '2026-10-08');
  assert.equal((await handleApply(request(body), environment(), options)).status, 409);
});

test('honeypot and basic rate limiter block requests before email', async () => {
  const body = form(); body.set('website', 'bot');
  assert.equal((await handleApply(request(body), environment(), options)).status, 400);
  const env = { ...environment(), APPLY_RATE_LIMITER: { limit: async () => ({ success: false }) } };
  assert.equal((await handleApply(request(), env, options)).status, 429);
  assert.equal((await handleApply(request(), { ...environment(), APPLY_RATE_LIMITER: undefined }, options)).status, 503);
});

test('rejects cross-origin submission, wrong method and body type', async () => {
  assert.equal((await handleApply(request(form(), { Origin: 'https://other.example' }), environment(), options)).status, 403);
  assert.equal((await handleApply(new Request('https://wildfire.example/api/apply'), environment(), options)).status, 405);
  assert.equal((await handleApply(new Request('https://wildfire.example/api/apply', { method: 'POST', body: '{}' }), environment(), options)).status, 415);
});

test('streaming body limit is enforced even without Content-Length', async () => {
  const response = await handleApply(new Request('https://wildfire.example/api/apply', {
    method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=x' },
    body: new Uint8Array(5 * 1024 * 1024 + 128 * 1024 + 1),
  }), environment(), options);
  assert.equal(response.status, 413);
});

test('no-JavaScript POST receives readable Chinese HTML, never a fake success', async () => {
  const response = await handleApply(request(form(), { Accept: 'text/html' }), { ...environment(), EMAIL_API_KEY: '' }, options);
  assert.match(response.headers.get('Content-Type'), /text\/html/);
  assert.match(await response.text(), /提交没有成功，请稍后再试/);
});

test('no-JavaScript success displays the same receipt copy as the application page', async () => {
  const response = await handleApply(request(form(), { Accept: 'text/html' }), environment(), options);
  assert.equal(response.status, 200);
  assert((await response.text()).includes(site.applicationSuccess));
});

test('unpublished projects are excluded from project displays and direct applications', async () => {
  const items = [{ slug: 'unpublished-example', initiator: 'bai', published: false, acceptingApplications: true }, { slug: 'b', initiator: 'bai', published: true, acceptingApplications: false }];
  assert.deepEqual(publishedProjects(items).map((item) => item.slug), ['b']);
  assert.deepEqual(applicationProjects(items), []);
  assert.deepEqual(initiatorProjects('bai', items).map((item) => item.slug), ['b']);
  const body = form(); body.set('project', 'unpublished-example');
  await assert.rejects(validateApplication(body), /这个项目暂未开放申请，请重新选择。/);
});

test('non-API routes delegate to static assets and unknown API returns 404', async () => {
  const env = { ASSETS: { fetch: async () => new Response('static') } };
  assert.equal(await (await worker.fetch(new Request('https://wildfire.example/'), env)).text(), 'static');
  assert.equal((await worker.fetch(new Request('https://wildfire.example/api/unknown'), env)).status, 404);
});
