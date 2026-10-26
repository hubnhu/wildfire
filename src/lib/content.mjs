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
export const applicationProjects = (items = projects) => publishedProjects(items).filter((project) => project.acceptingApplications);
export const founder = initiators.find((initiator) => initiator.slug === site.founder);
