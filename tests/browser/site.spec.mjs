import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const routes = ['/', '/projects/stadium', '/initiators/ma', '/projects/point', '/projects/wildfire', '/projects/holdem-manager', '/projects/taste', '/initiators/bai', '/apply', '/terms'];
const pdf = { name: 'resume.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF') };
async function fillForm(page) {
  await page.getByLabel('怎么称呼你').fill('浏览器测试');
  await page.getByLabel('联系方式', { exact: true }).fill('test@example.invalid');
  await page.getByLabel('在校学生', { exact: true }).check();
  await page.getByLabel('每周大概能投入多少时间').fill('如实填写');
  await page.getByLabel('简历', { exact: true }).setInputFiles(pdf);
  await page.locator('[name=tos]').check();
}

test('page routes: mobile overflow, metadata, external requests, labels and keyboard focus', async ({ page }) => {
  const remote = [];
  page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1:4321')) remote.push(request.url()); });
  for (const route of routes) {
    const response = await page.goto(route);
    expect(response.status()).toBe(200);
    if (route.startsWith('/projects/')) await expect(page.getByText('是一份真实工作的样子', { exact: true })).toHaveCount(0);
    if (route === '/') await expect(page.getByRole('heading', { name: '加入之后，是一份真实工作的样子', exact: true })).toBeVisible();
    expect(await page.locator('html').getAttribute('lang')).toBe('zh-CN');
    expect(await page.title()).toContain('野火');
    expect(await page.locator('meta[name=description]').getAttribute('content')).toBeTruthy();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const anchor of await page.locator('a').all()) {
      if ((await anchor.textContent()).includes('申请')) {
        const target = new URL(await anchor.getAttribute('href'), page.url());
        expect(target.origin).toBe(new URL(page.url()).origin);
        expect(target.pathname).toBe('/apply');
        expect(target.hash).toBe('');
      }
    }
  }
  expect(remote).toEqual([]);
  await page.goto('/apply');
  const unlabeled = await page.locator('input:not([type=hidden]), select, textarea').evaluateAll((fields) => fields.filter((field) => !field.labels?.length).map((field) => field.name));
  expect(unlabeled).toEqual([]);
  await page.getByLabel('怎么称呼你').focus();
  const visited = new Set();
  for (let index = 0; index < 30; index++) {
    visited.add(await page.evaluate(() => document.activeElement?.getAttribute('name') || document.activeElement?.tagName));
    await page.keyboard.press('Tab');
  }
  for (const name of ['name', 'contact', 'status', 'project', 'role', 'resume', 'time', 'work', 'why', 'tos', 'BUTTON']) expect(visited.has(name)).toBe(true);
});

test('content remains readable without JavaScript; project rail and table scroll locally', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.goto('/');
  await expect(page.locator('.project-card')).toHaveCount(5);
  expect(await page.locator('.project-scroller').evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(await page.locator('.comparison-wrap').evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await context.close();
});

test('application options, role order and project preselection follow the shared data; consent defaults unchecked', async ({ page }) => {
  await page.goto('/projects/point');
  await expect(page.getByRole('link', { name: '体验产品', exact: true })).toHaveCount(0);
  await expect(page.getByText('加入之后', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '想做Point？', exact: true })).toBeVisible();
  await expect(page.locator('.detail-facts')).toContainText('低');
  await page.locator('.button-row').getByRole('link', { name: '申请加入', exact: true }).click();
  await expect(page.locator('#f-project')).toHaveValue('point');
  await expect(page.locator('#project-help')).toBeVisible();
  await expect(page.locator('#f-project')).toHaveAttribute('aria-describedby', 'project-help');
  await expect(page.locator('#f-project option')).toHaveCount(6);
  await expect(page.locator('#f-project option')).toHaveText(['还没确定，想先聊聊', '野火本身', 'Stadium', 'Taste', 'Point', 'Holdem Manager']);
  await expect(page.locator('[name=role]')).toHaveCount(5);
  expect(await page.locator('[name=role]').evaluateAll((items) => items.map((item) => item.value))).toEqual(['product', 'design', 'dev', 'data', 'social']);
  await expect(page.locator('[name=role]').locator('..')).toHaveText(['产品', '设计', '开发', '数据', '社交媒体运营']);
  await expect(page.locator('[name=tos]')).not.toBeChecked();
  await expect(page.locator('.consent a')).toHaveAttribute('target', '_blank');
  await page.goto('/projects/holdem-manager');
  await expect(page.getByRole('link', { name: '体验产品', exact: true })).toHaveCount(0);
  await expect(page.getByText('加入之后', { exact: true })).toHaveCount(0);
  await page.locator('.button-row').getByRole('link', { name: '申请加入', exact: true }).click();
  await expect(page.locator('#f-project')).toHaveValue('holdem-manager');
  await page.goto('/projects/taste');
  await expect(page.getByRole('link', { name: '体验产品', exact: true })).toHaveCount(0);
  await expect(page.getByText('加入之后', { exact: true })).toHaveCount(0);
  await page.locator('.button-row').getByRole('link', { name: '申请加入', exact: true }).click();
  await expect(page.locator('#f-project')).toHaveValue('taste');
  for (const slug of ['unpublished-example']) {
    await page.goto(`/apply?project=${slug}`);
    await expect(page.locator('#f-project')).toHaveValue('any');
  }
  await page.goto('/apply?project=wildfire');
  await expect(page.locator('#f-project')).toHaveValue('wildfire');
  await expect(page.locator('[name=role]')).toHaveCount(5);
  await page.goto('/projects/wildfire');
  await expect(page.locator('.button-row a')).toHaveAttribute('href', '/apply?project=wildfire');
});

test('second initiator and project follow data order without changing the site founder', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.project-card h3')).toHaveText(['野火本身', 'Stadium', 'Taste', 'Point', 'Holdem Manager']);
  await expect(page.locator('[data-count]')).toHaveText('5');
  await expect(page.locator('#founder h2')).toHaveText('白老师');
  await page.goto('/initiators/ma');
  await expect(page.getByRole('heading', { name: '小马老师', exact: true })).toBeVisible();
  await expect(page.locator('.initiator-project')).toHaveCount(1);
  await expect(page.locator('.initiator-project-name a')).toHaveAttribute('href', '/projects/stadium');
  await expect(page.locator('.detail-hero .button-row')).toHaveCount(0);
  await page.goto('/projects/stadium');
  await expect(page.getByText('加入之后', { exact: true })).toHaveCount(0);
  await expect(page.locator('.role-card h3')).toHaveText(['开发', '产品', '设计']);
  await page.locator('.button-row').getByRole('link', { name: '申请加入', exact: true }).click();
  await expect(page.locator('#f-project')).toHaveValue('stadium');
});

test('Chinese client validation prevents missing, wrong files, oversized files and no consent', async ({ page }) => {
  const posts = [];
  page.on('request', (request) => { if (request.method() === 'POST') posts.push(request.url()); });
  await page.goto('/apply');
  await page.getByRole('button', { name: '提交申请' }).click();
  await expect(page.locator('#form-error')).toContainText('请填写');
  await fillForm(page);
  await page.getByLabel('简历', { exact: true }).setInputFiles({ name: 'resume.txt', mimeType: 'text/plain', buffer: Buffer.from('not a resume') });
  await page.getByRole('button', { name: '提交申请' }).click();
  await expect(page.locator('#form-error')).toContainText('PDF');
  await page.getByLabel('简历', { exact: true }).setInputFiles({ name: 'large.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await page.getByRole('button', { name: '提交申请' }).click();
  await expect(page.locator('#form-error')).toContainText('5MB');
  await page.getByLabel('简历', { exact: true }).setInputFiles(pdf);
  await page.locator('[name=tos]').uncheck();
  await page.getByRole('button', { name: '提交申请' }).click();
  await expect(page.locator('#form-error')).toContainText('同意');
  expect(posts).toEqual([]);
  expect(await page.evaluate(() => window.dataLayer ?? [])).toEqual([]);
});

test('pending prevents duplicate posts; success and failure display correctly and preserve input', async ({ page }) => {
  await page.goto('/apply');
  await fillForm(page);
  let release;
  let calls = 0;
  await page.route('**/api/apply', async (route) => {
    calls++;
    await new Promise((resolve) => { release = resolve; });
    await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ ok: false, message: '提交没有成功，请稍后再试。' }) });
  });
  await page.getByRole('button', { name: '提交申请' }).click();
  await expect(page.getByRole('button', { name: '提交申请' })).toBeDisabled();
  expect(calls).toBe(1);
  release();
  await expect(page.locator('#form-error')).toHaveText('提交没有成功，请稍后再试。');
  await expect(page.locator('#f-name')).toHaveValue('浏览器测试');
  expect(await page.locator('#f-resume').evaluate((element) => element.files.length)).toBe(1);
  await expect(page.locator('[data-state=sent]')).toBeHidden();
  expect(await page.evaluate(() => window.dataLayer ?? [])).toEqual([]);
  await page.unroute('**/api/apply');
  await page.route('**/api/apply', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await page.getByRole('button', { name: '提交申请' }).click();
  await expect(page.getByRole('heading', { name: '收到了' })).toBeVisible();
  await expect(page.locator('[data-state=sent]')).toContainText('你的申请已经收到。我们会尽快查看，并通过你留下的联系方式与你联系。');
  await expect(page.locator('[data-state=form]')).toBeHidden();
  expect(await page.evaluate(() => window.dataLayer)).toEqual([{ event: 'apply_success', apply_project: 'any' }]);
});

test('successful project submission preserves dataLayer and adds only the project event before reset', async ({ page }) => {
  await page.goto('/apply?project=point');
  await page.evaluate(() => { window.dataLayer = [{ event: 'existing_event' }]; });
  await fillForm(page);
  await page.route('**/api/apply', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await page.getByRole('button', { name: '提交申请' }).click();
  await expect(page.getByRole('heading', { name: '收到了' })).toBeVisible();
  expect(await page.evaluate(() => window.dataLayer)).toEqual([
    { event: 'existing_event' }, { event: 'apply_success', apply_project: 'point' },
  ]);
  await expect(page.locator('#f-project')).toHaveValue('any');
});

test('actual local backend fails safely without email configuration', async ({ page }) => {
  await page.goto('/apply');
  await fillForm(page);
  await page.getByRole('button', { name: '提交申请' }).click();
  await expect(page.locator('#form-error')).toHaveText('提交没有成功，请稍后再试。');
  await expect(page.locator('#f-name')).toHaveValue('浏览器测试');
  await expect(page.locator('[data-state=sent]')).toBeHidden();
  expect(await page.evaluate(() => window.dataLayer ?? [])).toEqual([]);
});

test('project arrows and mouse dragging work without activating the dragged link', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: '下一个项目' }).click();
  await expect.poll(() => page.locator('.project-scroller').evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  const link = page.locator('.project-card[data-project=point] .project-link');
  await link.scrollIntoViewIfNeeded();
  const box = await link.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  expect(new URL(page.url()).pathname).toBe('/');
});

test('updated terms require fresh consent without losing the application', async ({ page }) => {
  await page.goto('/apply');
  await fillForm(page);
  await page.route('**/api/apply', (route) => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ ok: false, message: '参与须知已更新，请重新阅读并勾选同意后再提交。', termsVersion: '2026-10-14' }) }));
  await page.getByRole('button', { name: '提交申请' }).click();
  expect(await page.evaluate(() => window.dataLayer ?? [])).toEqual([]);
  await expect(page.locator('[name=tos]')).not.toBeChecked();
  await expect(page.locator('[name=termsVersion]')).toHaveValue('2026-10-14');
  await expect(page.locator('#f-name')).toHaveValue('浏览器测试');
});

test('capture desktop and mobile screenshots for visual inspection', async ({ page }) => {
  await mkdir('artifacts/screenshots', { recursive: true });
  for (const route of routes) {
    await page.goto(route);
    const name = route === '/' ? 'home' : route.split('/').pop();
    const qr = page.locator('.qr');
    if (await qr.count()) {
      await qr.scrollIntoViewIfNeeded();
      await expect.poll(() => qr.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    }
    await page.screenshot({ path: `artifacts/screenshots/${name}-mobile.png`, fullPage: true });
    if (route === '/') await page.screenshot({ path: 'artifacts/screenshots/home-mobile-first.png' });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.locator('.qr').scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('.qr').evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: 'artifacts/screenshots/home-desktop.png', fullPage: true });
  await page.screenshot({ path: 'artifacts/screenshots/home-desktop-first.png' });
  await page.goto('/projects/wildfire');
  await page.screenshot({ path: 'artifacts/screenshots/wildfire-desktop.png', fullPage: true });
});

test('visible text contrast and link/button hit targets meet the specification', async ({ page }) => {
  for (const route of routes) {
    await page.goto(route);
    const failures = await page.evaluate(() => {
      const rgb = (value) => value.match(/[\d.]+/g)?.map(Number) || [];
      const luminance = (channels) => channels.slice(0, 3).map((channel) => {
        const value = channel / 255;
        return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
      }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
      const failures = [];
      for (const element of document.querySelectorAll('main *, header *, footer *')) {
        if (!element.getClientRects().length || !element.textContent.trim()) continue;
        if (element.matches('a, button') && element.getBoundingClientRect().height < 44) failures.push(`small target: ${element.textContent}`);
        if (element.childElementCount || element.matches('script, style, option, select, textarea')) continue;
        const style = getComputedStyle(element);
        const foreground = rgb(style.color);
        let ancestor = element;
        let background;
        while (ancestor) {
          const candidate = rgb(getComputedStyle(ancestor).backgroundColor);
          if (candidate.length === 3 || candidate[3] === 1) { background = candidate; break; }
          ancestor = ancestor.parentElement;
        }
        if (!background || !foreground.length) continue;
        const first = luminance(foreground); const second = luminance(background);
        const contrast = (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
        if (contrast < 4.5) failures.push(`contrast ${contrast.toFixed(2)}: ${element.textContent}`);
      }
      return failures;
    });
    expect(failures, route).toEqual([]);
  }
});
