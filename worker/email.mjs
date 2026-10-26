import { Buffer } from 'node:buffer';

// Contact also accepts WeChat IDs. Only a single plain email address can be a reply header.
const replyEmailPattern = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

export function formatApplicationEmail(application, version, now = new Date()) {
  const beijing = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(now);
  const utc = now.toISOString().replace('T', ' ').slice(0, 19);
  const text = [
    `怎么称呼你：${application.name}`,
    `联系方式：${application.contact}`,
    `你现在的状态：${application.statusLabel}`,
    `想加入哪个项目：${application.projectName}`,
    `想做的岗位：${application.roles.join('、') || '未填写'}`,
    `简历：${application.resume.name}`,
    `每周大概能投入多少时间：${application.time}`,
    `你做过的东西：${application.work || '未填写'}`,
    `为什么想来：${application.why || '未填写'}`,
    '',
    '已勾选同意参与须知：是',
    `参与须知最后更新：${version}`,
    `提交时间（北京时间）：${beijing}（UTC ${utc}）`,
  ].join('\n');
  return { subject: `【野火申请】${application.name} · ${application.projectName}`, text };
}

export async function sendApplicationEmail(application, version, env, fetcher = fetch, now = new Date()) {
  if (env.EMAIL_PROVIDER !== 'resend' || !env.EMAIL_API_KEY || !env.EMAIL_FROM || !env.APPLY_TO_EMAIL) throw new Error('email_not_configured');
  const message = formatApplicationEmail(application, version, now);
  const content = Buffer.from(await application.resume.arrayBuffer()).toString('base64');
  const extension = application.resume.name.split('.').pop().toLowerCase();
  const contentType = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }[extension];
  const response = await fetcher('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.EMAIL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_FROM, to: [env.APPLY_TO_EMAIL], ...message,
      ...(replyEmailPattern.test(application.contact) ? { reply_to: application.contact } : {}),
      attachments: [{ filename: application.resume.name, content, content_type: contentType }],
    }),
    signal: AbortSignal.timeout(30000),
  });
  // Never log the provider response; it may contain submitted information.
  if (!response.ok) throw new Error('email_send_failed');
  const result = await response.json();
  if (typeof result.id !== 'string' || !result.id) throw new Error('email_send_failed');
}
