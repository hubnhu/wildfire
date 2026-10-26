const form = document.querySelector<HTMLFormElement>('#application-form');
if (form) {
  const error = document.querySelector<HTMLElement>('#form-error')!;
  const project = form.querySelector<HTMLSelectElement>('[name="project"]')!;
  const resume = form.querySelector<HTMLInputElement>('[name="resume"]')!;
  const submit = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
  const requestedProject = new URLSearchParams(location.search).get('project');
  if (requestedProject && [...project.options].some((option) => option.value === requestedProject)) project.value = requestedProject;
  // Custom validation ensures Chinese feedback regardless of the browser locale.
  form.noValidate = true;
  let pending = false;
  const showError = (message: string, field?: HTMLElement) => {
    error.textContent = message;
    error.hidden = false;
    if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
    else error.focus();
  };
  form.addEventListener('input', (event) => {
    (event.target as HTMLElement).removeAttribute('aria-invalid');
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (pending) return;
    error.hidden = true;
    form.querySelectorAll('[aria-invalid]').forEach((field) => field.removeAttribute('aria-invalid'));
    for (const [name, message] of [['name', '请填写怎么称呼你。'], ['contact', '请填写联系方式。'], ['time', '请填写每周大概能投入多少时间。']]) {
      const field = form.elements.namedItem(name) as HTMLInputElement;
      if (!field.value.trim()) { showError(message, field); return; }
    }
    if (!form.querySelector('[name="status"]:checked')) { showError('请选择你现在的状态。', form.querySelector<HTMLElement>('[name="status"]')!); return; }
    const file = resume.files?.[0];
    if (!file || file.size === 0) { showError('请选择简历文件。', resume); return; }
    if (!/\.(pdf|doc|docx)$/i.test(file.name)) { showError('简历只支持 PDF、DOC 或 DOCX。', resume); return; }
    if (file.size > Number(form.dataset.resumeMax) * 1024 * 1024) { showError(`简历不能超过 ${form.dataset.resumeMax}MB。`, resume); return; }
    const consent = form.querySelector<HTMLInputElement>('[name="tos"]')!;
    if (!consent.checked) { showError('请阅读并同意参与须知。', consent); return; }
    if (!form.checkValidity()) { showError('请检查填写内容。'); return; }
    pending = true;
    submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(form.action, {
        method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(45000),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) {
        if (response.status === 409 && /^\d{4}-\d{2}-\d{2}$/.test(result.termsVersion || '')) {
          (form.elements.namedItem('termsVersion') as HTMLInputElement).value = result.termsVersion;
          consent.checked = false;
        }
        showError(result.message || '提交没有成功，请稍后再试。');
        return;
      }
      document.querySelector<HTMLElement>('[data-state="form"]')!.hidden = true;
      const sent = document.querySelector<HTMLElement>('[data-state="sent"]')!;
      sent.hidden = false;
      sent.focus();
      const analyticsWindow = window as Window & { dataLayer?: unknown[] };
      analyticsWindow.dataLayer ??= [];
      analyticsWindow.dataLayer.push({ event: 'apply_success', apply_project: project.value });
      form.reset();
    } catch {
      showError('提交没有成功，请稍后再试。');
    } finally {
      pending = false;
      submit.disabled = false;
      form.removeAttribute('aria-busy');
    }
  });
}
