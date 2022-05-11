import { AUTH_USER_ROLE } from '@dereekb/util';
import { containsAllValues, hasDifferentValues } from '../set';
import { AuthRoleSet, AUTH_ADMIN_ROLE } from './auth.role';
import { AuthClaimValue, AuthRoleClaimsService, authRoleClaimsService, AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE, AUTH_ROLE_CLAIMS_DEFAULT_EMPTY_VALUE } from "./auth.role.claims";

describe('authRoleClaimsFactory()', () => {

  describe('function', () => {

    function testConversion(service: AuthRoleClaimsService, rolesSet: AuthRoleSet, name?: string) {

      it(`should convert the the roles ${((name) ? `"${name}"` : '')} to claims claims and back.`, () => {
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
        test: { roles: 'n' },
        u: {
          roles: AUTH_USER_ROLE,
          value: 10
        },
        m: {
          roles: ['a', 'b', 'c'] // multiple roles applied when m exists.
        }
      };

      const service = authRoleClaimsService(claimsConfig);

      testConversion(service, new Set([claimsConfig.u.roles, ...claimsConfig.m.roles, claimsConfig.test.roles]));

      it('should apply a value for every key in the config.', () => {
        const roles = new Set([AUTH_USER_ROLE, ...claimsConfig.m.roles, nonExistentClaim]);
        const result = service.toClaims(roles);

        expect(Object.keys(result).length).toBe(3);
        expect(result['test']).toBe(AUTH_ROLE_CLAIMS_DEFAULT_EMPTY_VALUE);
        expect(result['u']).toBe(claimsConfig['u'].value);
        expect(result['m']).toBe(AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE);
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
          decodeRolesFromValue: (value: AuthClaimValue) => {
            switch (value) {
              case 1:
                return [AUTH_ADMIN_ROLE];
              case 2:
                return [AUTH_USER_ROLE];
            }
          }
        }
      };

      const service = authRoleClaimsService(claimsConfig);

      testConversion(service, new Set([AUTH_ADMIN_ROLE]), 'admin');
      testConversion(service, new Set([AUTH_USER_ROLE]), 'user');

      it('should have an empty value for claims that do not have all the roles.', () => {
        const roles = new Set([]);
        const result = service.toClaims(roles);

        expect(Object.keys(result).length).toBe(1);
        expect(result.type).toBe(AUTH_ROLE_CLAIMS_DEFAULT_EMPTY_VALUE);
      });

    });

  });

});
