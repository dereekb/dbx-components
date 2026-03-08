import { authRolesSetHasRoles, AUTH_ADMIN_ROLE, AUTH_USER_ROLE, AUTH_TOS_SIGNED_ROLE, type AuthRoleSet } from './auth.role';

describe('authRolesSetHasRoles', () => {
  const rolesSet: AuthRoleSet = new Set([AUTH_ADMIN_ROLE, AUTH_USER_ROLE, AUTH_TOS_SIGNED_ROLE]);

  it('should return true when the set contains all specified roles', () => {
    const result = authRolesSetHasRoles(rolesSet, [AUTH_ADMIN_ROLE, AUTH_USER_ROLE]);
    expect(result).toBe(true);
  });

  it('should return false when the set is missing a specified role', () => {
    const result = authRolesSetHasRoles(rolesSet, [AUTH_ADMIN_ROLE, 'nonexistent']);
    expect(result).toBe(false);
  });

  it('should return true when roles is null', () => {
    const result = authRolesSetHasRoles(rolesSet, null);
    expect(result).toBe(true);
  });

  it('should return true when roles is undefined', () => {
    const result = authRolesSetHasRoles(rolesSet, undefined);
    expect(result).toBe(true);
  });

  it('should return true when roles is an empty array', () => {
    const result = authRolesSetHasRoles(rolesSet, []);
    expect(result).toBe(true);
  });

  it('should return true when checking a single role that exists', () => {
    const result = authRolesSetHasRoles(rolesSet, [AUTH_ADMIN_ROLE]);
    expect(result).toBe(true);
  });
});
