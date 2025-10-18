import { AUTH_USER_ROLE, type Maybe, objectHasKey } from '@dereekb/util';
import { containsAllValues, hasDifferentValues } from '../set';
import { type AuthRoleSet, AUTH_ADMIN_ROLE } from './auth.role';
import { type AuthClaimsObject, type AuthRoleClaimsService, authRoleClaimsService, AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE, AUTH_ROLE_CLAIMS_DEFAULT_EMPTY_VALUE, type AuthRoleClaimsFactoryConfigEntrySimpleOptions } from './auth.role.claims';

type TestClaims = {
  test: string;
  u: number;
  m: string;
  ignoredValue: boolean;
};

type TestInverseClaims = {
  /**
   * Inverse "any" restrictions test.
   */
  any?: 1;
  /**
   * Inverse "all" restrictions test.
   */
  all?: 1;
  /**
   * Inverse "all"/true restrictions test.
   */
  true?: 1;
};

type TestComplexClaims = {
  type: number;
  ignoredValue: boolean;
};

describe('authRoleClaimsFactory()', () => {
  describe('function', () => {
    function testConversion<T extends AuthClaimsObject>(service: AuthRoleClaimsService<T>, rolesSet: AuthRoleSet, name?: string) {
      it(`should convert the the roles ${name ? `"${name}"` : ''} to claims claims and back.`, () => {
        const claims = service.toClaims(rolesSet);

        expect(claims).toBeDefined();

        const roles = service.toRoles(claims);
        expect(hasDifferentValues(roles, rolesSet)).toBe(false);
        expect(containsAllValues(roles, rolesSet)).toBe(true);
      });
    }

    describe('simple claims', () => {
      const nonExistentClaim = 'x';

      const claimsConfig = {
        test: {
          roles: 'n'
        },
        u: {
          roles: AUTH_USER_ROLE,
          value: 10
        },
        m: {
          roles: ['a', 'b', 'c'] // multiple roles applied when m exists.
        },
        ignoredValue: null // set ignored
      };

      const service = authRoleClaimsService<TestClaims>(claimsConfig);

      testConversion(service, new Set([claimsConfig.u.roles, ...claimsConfig.m.roles, claimsConfig.test.roles]));

      it('should apply a value for every key in the config.', () => {
        const roles = new Set([AUTH_USER_ROLE, ...claimsConfig.m.roles, nonExistentClaim]);
        const result = service.toClaims(roles);

        expect(Object.keys(result).length).toBe(3);
        expect(result['test']).toBe(AUTH_ROLE_CLAIMS_DEFAULT_EMPTY_VALUE);
        expect(result['u']).toBe(claimsConfig['u'].value);
        expect(result['m']).toBe(AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE);
        expect(result['ignoredValue']).not.toBeDefined();
        expect(objectHasKey(result, 'ignoredValue')).toBe(false);
      });

      it(`should apply the default value for every key in the config that doesn't exist in the roles set.`, () => {
        const emptyValue = 100;
        const service = authRoleClaimsService(claimsConfig, {
          emptyValue
        });

        const roles = new Set([AUTH_USER_ROLE, ...claimsConfig.m.roles, nonExistentClaim]);

        const result = service.toClaims(roles);

        expect(Object.keys(result).length).toBe(3);
        expect(result.test).toBe(emptyValue);
        expect(result.u).toBe(claimsConfig['u'].value);
        expect(result.m).toBe(AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE);
      });

      it('should have an empty value for claims that do not have all the roles.', () => {
        const roles = new Set(['a']);
        const result = service.toClaims(roles);

        expect(Object.keys(result).length).toBe(3);
        expect(result.m).toBe(AUTH_ROLE_CLAIMS_DEFAULT_EMPTY_VALUE);
      });
    });

    describe('inverse claims', () => {
      const roles = ['a', 'b', 'c'];

      const claimsConfig = {
        any: {
          roles,
          inverse: 'any'
        } as AuthRoleClaimsFactoryConfigEntrySimpleOptions<1>,
        all: {
          roles,
          inverse: 'all'
        } as AuthRoleClaimsFactoryConfigEntrySimpleOptions<1>,
        true: {
          roles,
          inverse: true
        } as AuthRoleClaimsFactoryConfigEntrySimpleOptions<1>
      };

      const service = authRoleClaimsService<TestInverseClaims>(claimsConfig);

      it('should not add the inverse claim when the roles are present.', () => {
        const rolesSet = new Set(roles);
        const result = service.toClaims(rolesSet);

        expect(Object.keys(result).length).toBe(3); // all 3 returned
        expect(result.any).toBe(null);
        expect(result.all).toBe(null);
        expect(result.true).toBe(null);
      });

      it('should add the inverse claim to all, but not any, if some of the roles are not present.', () => {
        const rolesSet = new Set(['a']);
        const result = service.toClaims(rolesSet);

        expect(Object.keys(result).length).toBe(3); // all 3 returned
        expect(result.all).toBe(1);
        expect(result.any).toBe(null);
        expect(result.true).toBe(null);
      });

      it('should add the inverse claim when all of the roles are not present.', () => {
        const rolesSet = new Set([]);
        const result = service.toClaims(rolesSet);

        expect(Object.keys(result).length).toBe(3); // all 3 returned
        expect(result.any).toBe(1);
        expect(result.all).toBe(1);
        expect(result.true).toBe(1);
      });
    });

    describe('encode/decoded claims', () => {
      // Encodes the user's role type in the "type" claims key.
      const claimsConfig = {
        type: {
          encodeValueFromRoles: (roles: AuthRoleSet) => {
            if (roles.has(AUTH_ADMIN_ROLE)) {
              return 1;
            } else if (roles.has(AUTH_USER_ROLE)) {
              return 2;
            }
          },
          decodeRolesFromValue: (value: Maybe<number>) => {
            switch (value) {
              case 1:
                return [AUTH_ADMIN_ROLE];
              case 2:
                return [AUTH_USER_ROLE];
            }
          }
        },
        ignoredValue: null // set ignored
      };

      const service = authRoleClaimsService<TestComplexClaims>(claimsConfig);

      testConversion(service, new Set([AUTH_ADMIN_ROLE]), 'admin');
      testConversion(service, new Set([AUTH_USER_ROLE]), 'user');

      it('should have an empty value for claims that do not have all the roles.', () => {
        const roles = new Set([]);
        const result = service.toClaims(roles);

        expect(Object.keys(result).length).toBe(1);
        expect(result.type).toBe(AUTH_ROLE_CLAIMS_DEFAULT_EMPTY_VALUE);
      });

      it('should have ignored the ignoredValue.', () => {
        const roles = new Set([]);
        const result = service.toClaims(roles);

        expect(Object.keys(result).length).toBe(1);
        expect(result.ignoredValue).not.toBeDefined();
        expect(objectHasKey(result, 'ignoredValue')).toBe(false);
      });
    });
  });
});
