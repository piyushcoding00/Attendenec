const { validationResult } = require('express-validator');
const { inviteAdminRules } = require('../validators/adminInvite.validators');
const { createEmployeeRules, updateEmployeeRules } = require('../validators/employee.validators');

const validateInvite = async (body) => {
  const req = { body };
  await Promise.all(inviteAdminRules.map((rule) => rule.run(req)));
  return { req, errors: validationResult(req).array() };
};

describe('Admin invitation validation', () => {
  test('normalizes email and accepts valid invite details', async () => {
    const { req, errors } = await validateInvite({
      name: '  Alex Morgan  ',
      email: '  ADMIN@EXAMPLE.COM ',
      department: ' Human Resources ',
      designation: ' HR Administrator ',
      password: 'StrongTempPass1'
    });

    expect(errors).toHaveLength(0);
    expect(req.body.name).toBe('Alex Morgan');
    expect(req.body.email).toBe('admin@example.com');
    expect(req.body.department).toBe('Human Resources');
  });

  test('rejects missing identity fields and weak passwords', async () => {
    const { errors } = await validateInvite({
      name: '',
      email: 'not-an-email',
      department: '',
      designation: '',
      password: 'short'
    });

    expect(errors.length).toBeGreaterThanOrEqual(5);
  });

  test.each([[createEmployeeRules], [updateEmployeeRules]])(
    'does not allow employee endpoints to grant admin roles',
    async (rules) => {
      const roleRule = rules.find((rule) => rule.builder.fields.includes('role'));
      const req = { body: { role: 'hr_admin' } };
      await roleRule.run(req);

      expect(validationResult(req).isEmpty()).toBe(false);
    }
  );
});
