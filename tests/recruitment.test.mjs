import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRoleCounts, getRoleRecruitmentText, isRoleFull, isProjectFull,
  applicationProjectOptions, applicationProjects, validateRecruitmentData,
} from '../src/lib/content.mjs';

const position = (filledCount, requiredCount = 4) => ({ role: 'dev', filledCount, requiredCount });
const project = (roles, overrides = {}) => ({ slug: 'synthetic-project', published: true, acceptingApplications: true, roles, ...overrides });

test('missing counts default to 0/4 and explicit zero demand is preserved', () => {
  assert.deepEqual(getRoleCounts({ role: 'dev' }), { filledCount: 0, requiredCount: 4 });
  assert.equal(getRoleRecruitmentText({ role: 'dev' }), '开发（0/4）');
  assert.equal(getRoleRecruitmentText(position(5)), '开发（5/4）');
  assert.equal(getRoleRecruitmentText(position(0, 0)), '开发（0/0）');
  assert.equal(isRoleFull(position(0, 0)), true);
});

test('every position must reach its demand; an empty role list is not full', () => {
  assert.equal(isRoleFull(position(3)), false);
  assert.equal(isRoleFull(position(4)), true);
  assert.equal(isRoleFull(position(5)), true);
  assert.equal(isProjectFull(project([position(5), position(3)])), false);
  assert.equal(isProjectFull(project([position(5), position(4)])), true);
  assert.equal(isProjectFull(project([])), false);
  assert.equal(isProjectFull(project([{ role: 'dev' }])), false);
});

test('a vacancy reopens applications without changing the manual switch', () => {
  const item = project([position(4)]);
  assert.deepEqual(applicationProjects([item]), []);
  assert.deepEqual(applicationProjectOptions([item]), [item]);
  item.roles[0].filledCount = 3;
  assert.deepEqual(applicationProjects([item]), [item]);
  assert.equal(isProjectFull(item), false);
});

test('full projects remain visible as options; unpublished projects and manual closures cannot receive applications', () => {
  const open = project([position(1)]);
  const full = project([position(5)], { slug: 'full', acceptingApplications: false });
  const closed = project([position(1)], { slug: 'closed', acceptingApplications: false });
  const hidden = project([position(4)], { slug: 'hidden', published: false, acceptingApplications: false });
  assert.deepEqual(applicationProjectOptions([open, full, closed, hidden]).map((item) => item.slug), ['synthetic-project', 'full']);
  assert.deepEqual(applicationProjects([open, full, closed, hidden]), [open]);
});

test('participants are independent of role totals and counts reject strings, fractions and negative numbers', () => {
  assert.doesNotThrow(() => validateRecruitmentData(project([position(5)], { memberCount: 12 })));
  assert.doesNotThrow(() => validateRecruitmentData(project([{ role: 'dev' }])));
  for (const value of [-1, 1.5, '4', false, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    for (const key of ['filledCount', 'requiredCount']) {
      assert.throws(() => validateRecruitmentData(project([{ ...position(0), [key]: value }])), /必须为非负安全整数/);
    }
    assert.throws(() => validateRecruitmentData(project([], { memberCount: value })), /memberCount/);
  }
});
