import { AUTH_USER_ROLE } from '@dereekb/util';
import { authRoleClaimsService, AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE, AUTH_ROLE_CLAIMS_DEFAULT_EMPTY_VALUE } from "./auth.role.claims";

describe('authRoleClaimsFactory()', () => {

  describe('function', () => {

    describe('simple claims', () => {

      const nonExistentClaim = 'x';

      const claimsConfig = {
        test: { role: 'n' },
        u: {
          role: AUTH_USER_ROLE,
          value: 10
        },
        m: {
          role: ['a', 'b', 'c'] // multiple roles applied when m exists.
        }
      };

      const service = authRoleClaimsService(claimsConfig);

      it('should apply a value for every key in the config.', () => {
        const roles = new Set([AUTH_USER_ROLE, ...claimsConfig.m.role, nonExistentClaim]);
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

        const roles = new Set([AUTH_USER_ROLE, ...claimsConfig.m.role, nonExistentClaim]);

        const result = service.toClaims(roles);

        expect(Object.keys(result).length).toBe(3);
        expect(result['test']).toBe(emptyValue);
        expect(result['u']).toBe(claimsConfig['u'].value);
        expect(result['m']).toBe(AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE);
      });

      it('should have an empty value for claims that do not have all the roles.', () => {
        const roles = new Set(['a']);
        const result = service.toClaims(roles);

        expect(Object.keys(result).length).toBe(3);
        expect(result['m']).toBe(AUTH_ROLE_CLAIMS_DEFAULT_EMPTY_VALUE);
      });

    });

  });

});
