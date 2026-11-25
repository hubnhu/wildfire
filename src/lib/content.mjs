import projects from '../data/projects.json' with { type: 'json' };
import initiators from '../data/initiators.json' with { type: 'json' };
import site from '../data/site.json' with { type: 'json' };
import roles from '../data/roles.json' with { type: 'json' };
import collaboration from '../data/collaboration.json' with { type: 'json' };
import terms from '../data/terms/current.json' with { type: 'json' };

export { projects, initiators, site, terms, roles, collaboration };
export const publishedProjects = (items = projects) => items.filter((project) => project.published);
export const initiatorProjects = (slug, items = projects) => publishedProjects(items).filter((project) => project.initiator === slug);
export const termsVersion = terms.version;
export const termsLabel = termsVersion || site.termsDraftLabel;
export const statusOptions = { student: '在校学生', switch: '已经工作，想转行', other: '其他' };
export const roleNames = Object.fromEntries(roles.map(({ id, name }) => [id, name]));
export const applicationProjectOptions = (items = projects) => publishedProjects(items).filter((project) => project.acceptingApplications || isProjectFull(project));
export const applicationProjects = (items = projects) => publishedProjects(items).filter(canApplyToProject);
export const founder = initiators.find((initiator) => initiator.slug === site.founder);

export function getRoleCounts(position) {
  return {
    filledCount: position.filledCount ?? 0,
    requiredCount: position.requiredCount ?? 4,
  };
}

export function getRoleRecruitmentText(position) {
  const { filledCount, requiredCount } = getRoleCounts(position);
  return `${roleNames[position.role]}（${filledCount}/${requiredCount}）`;
}

export function isRoleFull(position) {
  const { filledCount, requiredCount } = getRoleCounts(position);
  return filledCount >= requiredCount;
}

export function isProjectFull(project) {
  return project.roles.length > 0 && project.roles.every(isRoleFull);
}

export function canApplyToProject(project) {
  return project.published && project.acceptingApplications && !isProjectFull(project);
}

export function validateRecruitmentData(project) {
  const checkCount = (value, field) => {
    if (value != null && (!Number.isSafeInteger(value) || value < 0)) {
      throw new Error(`${project.slug}: ${field} 必须为非负安全整数或留空`);
    }
  };
  checkCount(project.memberCount, 'memberCount');
  for (const position of project.roles) {
    checkCount(position.filledCount, `${position.role}.filledCount`);
    checkCount(position.requiredCount, `${position.role}.requiredCount`);
  }
}
