import { noAccessContextGrantedModelRoles, fullAccessGrantedModelRoles, contextGrantedModelRoles } from './permission';
import { fullAccessRoleMap, noAccessRoleMap, type GrantedRoleMap } from './role';

describe('noAccessContextGrantedModelRoles()', () => {
  it('should create a result with a no-access role map', () => {
    const context = { userId: 'user1' };
    const result = noAccessContextGrantedModelRoles(context);

    expect(result.context).toBe(context);
    expect(result.data).toBeUndefined();
    expect(result.roleMap).toEqual(noAccessRoleMap());
  });

  it('should include data when provided', () => {
    const context = { userId: 'user1' };
    const data = { name: 'test' };
    const result = noAccessContextGrantedModelRoles(context, data);

    expect(result.data).toBe(data);
    expect(result.roleMap).toEqual(noAccessRoleMap());
  });
});

describe('fullAccessGrantedModelRoles()', () => {
  it('should create a result with a full-access role map', () => {
    const context = { userId: 'admin' };
    const result = fullAccessGrantedModelRoles(context);

    expect(result.context).toBe(context);
    expect(result.data).toBeUndefined();
    expect(result.roleMap).toEqual(fullAccessRoleMap());
  });

  it('should include data when provided', () => {
    const context = { userId: 'admin' };
    const data = { name: 'test' };
    const result = fullAccessGrantedModelRoles(context, data);

    expect(result.data).toBe(data);
    expect(result.roleMap).toEqual(fullAccessRoleMap());
  });
});

describe('contextGrantedModelRoles()', () => {
  it('should create a result with the given role map', () => {
    const context = { userId: 'user1' };
    const data = { name: 'test' };
    const roles: GrantedRoleMap = { read: true, write: false };

    const result = contextGrantedModelRoles(context, data, roles);

    expect(result.context).toBe(context);
    expect(result.data).toBe(data);
    expect(result.roleMap).toBe(roles);
  });

  it('should allow undefined data', () => {
    const context = { userId: 'user1' };
    const roles: GrantedRoleMap = { read: true };

    const result = contextGrantedModelRoles(context, undefined, roles);

    expect(result.data).toBeUndefined();
    expect(result.roleMap).toBe(roles);
  });
});
