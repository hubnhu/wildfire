import { site, statusOptions, roleNames, applicationProjects } from '../src/lib/content.mjs';

export class ApplicationError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const scalar = (form, name, maxLength, required = false) => {
  const values = form.getAll(name);
  if (values.length > 1 || values.some((value) => typeof value !== 'string')) throw new ApplicationError('请检查填写内容。');
  const value = (values[0] || '').trim();
  if (required && !value) throw new ApplicationError('请填写所有必填项。');
  if (value.length > maxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new ApplicationError('请检查填写内容。');
  return value;
};

export async function validateResume(file, maxMb = site.resumeMaxMb) {
  if (!file || typeof file === 'string' || !file.name || file.size === 0) throw new ApplicationError('请选择简历文件。');
  if (file.size > maxMb * 1024 * 1024) throw new ApplicationError(`简历不能超过 ${maxMb}MB。`, 413);
  if (file.name.length > 180 || /[\x00-\x1f\x7f/\\]/.test(file.name)) throw new ApplicationError('请检查简历文件名。');
  const extension = file.name.split('.').pop().toLowerCase();
  const mimeTypes = {
    pdf: ['application/pdf'],
    doc: ['application/msword', 'application/vnd.ms-word'],
    docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
  };
  if (!mimeTypes[extension] || (file.type && file.type !== 'application/octet-stream' && !mimeTypes[extension].includes(file.type))) throw new ApplicationError('简历只支持 PDF、DOC 或 DOCX。');
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (extension === 'pdf') {
    if (new TextDecoder().decode(head.slice(0, 5)) !== '%PDF-') throw new ApplicationError('请上传有效的 PDF 文件。');
  } else if (extension === 'doc') {
    const signature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    if (!signature.every((byte, index) => byte === head[index])) throw new ApplicationError('请上传有效的 Word 文件。');
  } else {
    if (head[0] !== 0x50 || head[1] !== 0x4b || head[2] !== 0x03 || head[3] !== 0x04) throw new ApplicationError('请上传有效的 Word 文件。');
    // Read ZIP directory names without inflating attacker-controlled compressed data.
    const tail = new Uint8Array(await file.slice(Math.max(0, file.size - 65557)).arrayBuffer());
    const view = new DataView(tail.buffer);
    let eocd = -1;
    for (let index = tail.length - 22; index >= 0; index--) {
      if (view.getUint32(index, true) === 0x06054b50 && index + 22 + view.getUint16(index + 20, true) === tail.length) { eocd = index; break; }
    }
    if (eocd < 0 || view.getUint16(eocd + 4, true) !== 0 || view.getUint16(eocd + 6, true) !== 0) throw new ApplicationError('请上传有效的 Word 文件。');
    const directorySize = view.getUint32(eocd + 12, true);
    const offset = view.getUint32(eocd + 16, true);
    if (directorySize > 256 * 1024 || offset + directorySize > file.size - 22) throw new ApplicationError('请上传有效的 Word 文件。');
    const directory = new Uint8Array(await file.slice(offset, offset + directorySize).arrayBuffer());
    const directoryView = new DataView(directory.buffer);
    const names = new Set();
    let position = 0;
    while (position + 46 <= directory.length) {
      if (directoryView.getUint32(position, true) !== 0x02014b50) throw new ApplicationError('请上传有效的 Word 文件。');
      const nameSize = directoryView.getUint16(position + 28, true);
      const extraSize = directoryView.getUint16(position + 30, true);
      const commentSize = directoryView.getUint16(position + 32, true);
      const next = position + 46 + nameSize + extraSize + commentSize;
      if (next > directory.length) throw new ApplicationError('请上传有效的 Word 文件。');
      names.add(new TextDecoder().decode(directory.slice(position + 46, position + 46 + nameSize)));
      position = next;
    }
    if (position !== directory.length || !names.has('[Content_Types].xml') || !names.has('word/document.xml')) throw new ApplicationError('请上传有效的 Word 文件。');
  }
}

export async function validateApplication(form) {
  const name = scalar(form, 'name', 100, true);
  const contact = scalar(form, 'contact', 200, true);
  const time = scalar(form, 'time', 200, true);
  if ([name, contact, time].some((value) => /[\r\n]/.test(value))) throw new ApplicationError('请检查填写内容。');
  const status = scalar(form, 'status', 20, true);
  if (!Object.hasOwn(statusOptions, status)) throw new ApplicationError('请选择你现在的状态。');
  const project = scalar(form, 'project', 100) || 'any';
  const selectedProject = applicationProjects().find((item) => item.slug === project);
  if (project !== 'any' && !selectedProject) throw new ApplicationError('这个项目暂未开放申请，请重新选择。');
  const roles = form.getAll('role');
  if (roles.length > Object.keys(roleNames).length || roles.some((role) => typeof role !== 'string' || !Object.hasOwn(roleNames, role))) throw new ApplicationError('请选择有效的岗位。');
  if (scalar(form, 'tos', 10, true) !== 'yes') throw new ApplicationError('请阅读并同意参与须知。');
  const resumes = form.getAll('resume');
  if (resumes.length !== 1) throw new ApplicationError('请选择一个简历文件。');
  const resume = resumes[0];
  await validateResume(resume);
  return {
    name, contact, statusLabel: statusOptions[status], projectName: selectedProject?.name ?? site.generalApplicationLabel,
    roles: [...new Set(roles)].map((role) => roleNames[role]), resume, time,
    work: scalar(form, 'work', 5000), why: scalar(form, 'why', 5000),
    termsVersion: scalar(form, 'termsVersion', 100, true),
  };
}
