import { site, termsVersion } from '../src/lib/content.mjs';
import { ApplicationError, validateApplication } from './validation.mjs';
import { sendApplicationEmail } from './email.mjs';

const FAILURE = '提交没有成功，请稍后再试。';
const escapeHtml = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function reply(request, status, message, ok = false, extra = {}) {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if ((request.headers.get('Accept') || '').includes('text/html')) {
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>野火申请表</title><link rel="stylesheet" href="/response.css"></head><body><main><h1>${ok ? '收到了' : escapeHtml(message)}</h1>${ok ? `<p>${escapeHtml(site.applicationSuccess)}</p>` : ''}<a href="${ok ? '/' : '/apply'}">${ok ? '回到首页' : '申请加入'}</a></main></body></html>`;
    return new Response(html, { status, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
  }
  return Response.json({ ok, message, ...extra }, { status, headers });
}

async function limitedFormData(request) {
  const max = site.resumeMaxMb * 1024 * 1024 + 128 * 1024;
  const length = request.headers.get('Content-Length');
  if (length && (!/^\d+$/.test(length) || Number(length) > max)) throw new ApplicationError(`简历不能超过 ${site.resumeMaxMb}MB。`, 413);
  if (!request.body) throw new ApplicationError('请填写所有必填项。');
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) { await reader.cancel(); throw new ApplicationError(`简历不能超过 ${site.resumeMaxMb}MB。`, 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let position = 0;
  for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.byteLength; }
  try { return await new Response(bytes, { headers: { 'Content-Type': request.headers.get('Content-Type') } }).formData(); }
  catch { throw new ApplicationError('请检查填写内容。'); }
}

export async function handleApply(request, env, dependencies = {}) {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } });
  if (env.APPLICATIONS_CLOSED === '1') return reply(request, 503, '申请暂未开放。');
  const origin = request.headers.get('Origin');
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  if ((origin && origin !== new URL(request.url).origin) || fetchSite === 'cross-site') return reply(request, 403, FAILURE);
  if (!/^multipart\/form-data\s*;/i.test(request.headers.get('Content-Type') || '')) return reply(request, 415, '请使用申请表提交。');
  try {
    // Platform counters are per Cloudflare location, not global accounting.
    if (!env.APPLY_RATE_LIMITER) return reply(request, 503, FAILURE);
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    const { success } = await env.APPLY_RATE_LIMITER.limit({ key: `apply:${ip}` });
    if (!success) return reply(request, 429, '提交过于频繁，请稍后再试。');
    const form = await limitedFormData(request);
    if (form.getAll('website').some((value) => typeof value !== 'string' || value.trim())) return reply(request, 400, FAILURE);
    const application = await validateApplication(form);
    const version = dependencies.version ?? termsVersion;
    if (!version || env.TERMS_VERSION !== version || Number(env.RESUME_MAX_MB) !== site.resumeMaxMb) return reply(request, 503, FAILURE);
    if (application.termsVersion !== version) return reply(request, 409, '参与须知已更新，请重新阅读并勾选同意后再提交。', false, { termsVersion: version });
    await sendApplicationEmail(application, version, env, dependencies.fetcher, dependencies.now);
    return reply(request, 200, '', true);
  } catch (error) {
    if (error instanceof ApplicationError) return reply(request, error.status, error.message);
    // Do not expose/log exceptions or responses containing applicant information.
    return reply(request, 502, FAILURE);
  }
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/api/apply') return handleApply(request, env);
    if (path.startsWith('/api/')) return new Response(null, { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
