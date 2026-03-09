import { AUTH_ADMIN_ROLE, AUTH_ONBOARDED_ROLE, AUTH_TOS_SIGNED_ROLE, AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE, objectHasNoKeys } from '@dereekb/util';
import { itShouldFail, expectFail } from '@dereekb/util/test';
import { demoApiFunctionContextFactory, demoAuthorizedUserContext, demoAuthorizedUserAdminContext } from './../../../test/fixture';
import { type DemoApiAuthService } from './auth.service';

demoApiFunctionContextFactory((f) => {
  let authService: DemoApiAuthService;

  beforeEach(() => {
    authService = f.authService;
  });

  describe('DemoApiAuthService', () => {
    describe('readRoles()', () => {
      it('should return an empty role set for empty claims', () => {
        const roles = authService.readRoles({});
        expect(roles.size).toBe(0);
      });

      it('should read admin role from claims', () => {
        const roles = authService.readRoles({ a: 1 });
        expect(roles.has(AUTH_ADMIN_ROLE)).toBe(true);
      });

      it('should read onboarded role from claims', () => {
        const roles = authService.readRoles({ o: 1 });
        expect(roles.has(AUTH_TOS_SIGNED_ROLE)).toBe(true);
        expect(roles.has(AUTH_ONBOARDED_ROLE)).toBe(true);
      });
    });

    describe('claimsForRoles()', () => {
      it('should return null for all claim keys when given empty roles', () => {
        const claims = authService.claimsForRoles(new Set());
        expect(claims.a).toBeNull();
        expect(claims.o).toBeNull();
      });

      it('should return admin claim for admin role', () => {
        const claims = authService.claimsForRoles(new Set([AUTH_ADMIN_ROLE]));
        expect(claims.a).toBe(AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE);
      });

      it('should return onboarded claim for onboarded roles', () => {
        const claims = authService.claimsForRoles(new Set([AUTH_TOS_SIGNED_ROLE, AUTH_ONBOARDED_ROLE]));
        expect(claims.o).toBe(AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE);
      });
    });

    describe('isAdmin()', () => {
      it('should return false for empty claims', () => {
        expect(authService.isAdmin({})).toBe(false);
      });

      it('should return true for admin claims', () => {
        expect(authService.isAdmin({ a: 1 })).toBe(true);
      });
    });

    describe('hasSignedTos()', () => {
      it('should return false for empty claims', () => {
        expect(authService.hasSignedTos({})).toBe(false);
      });

      it('should return true for onboarded claims', () => {
        expect(authService.hasSignedTos({ o: 1 })).toBe(true);
      });
    });

    describe('userContext()', () => {
      describe('user exists', () => {
        demoAuthorizedUserContext({ f }, (u) => {
          it('should return a user context with the given uid', () => {
            const userContext = authService.userContext(u.uid);
            expect(userContext).toBeDefined();
            expect(userContext.uid).toBe(u.uid);
          });

          describe('exists()', () => {
            it('should return true for an existing user', async () => {
              const userContext = authService.userContext(u.uid);
              const exists = await userContext.exists();
              expect(exists).toBe(true);
            });
          });

          describe('loadRecord()', () => {
            it('should load the user record', async () => {
              const userContext = authService.userContext(u.uid);
              const record = await userContext.loadRecord();
              expect(record).toBeDefined();
              expect(record.uid).toBe(u.uid);
            });
          });

          describe('loadDetails()', () => {
            it('should load the auth details for the user', async () => {
              const userContext = authService.userContext(u.uid);
              const details = await userContext.loadDetails();
              expect(details).toBeDefined();
              expect(details.uid).toBe(u.uid);
            });
          });

          describe('loadRoles()', () => {
            it('should load the roles for the user', async () => {
              const userContext = authService.userContext(u.uid);
              const roles = await userContext.loadRoles();
              expect(roles).toBeDefined();
            });
          });

          describe('addRoles()', () => {
            it('should add admin role to user', async () => {
              const userContext = authService.userContext(u.uid);
              await userContext.addRoles(AUTH_ADMIN_ROLE);

              const roles = await userContext.loadRoles();
              expect(roles.has(AUTH_ADMIN_ROLE)).toBe(true);

              const claims = await userContext.loadClaims();
              expect(claims.a).toBe(AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE);
            });
          });

          describe('removeRoles()', () => {
            it('should remove admin role from user', async () => {
              const userContext = authService.userContext(u.uid);
              await userContext.addRoles(AUTH_ADMIN_ROLE);
              await userContext.removeRoles(AUTH_ADMIN_ROLE);

              const roles = await userContext.loadRoles();
              expect(roles.has(AUTH_ADMIN_ROLE)).toBe(false);
            });

            it('should not remove other roles when removing a specific role', async () => {
              const userContext = authService.userContext(u.uid);
              await userContext.addRoles(AUTH_ADMIN_ROLE);
              await userContext.removeRoles('nonexistent');

              const roles = await userContext.loadRoles();
              expect(roles.has(AUTH_ADMIN_ROLE)).toBe(true);
            });
          });

          describe('setRoles()', () => {
            it('should set the roles replacing any existing roles', async () => {
              const userContext = authService.userContext(u.uid);
              await userContext.addRoles(AUTH_ADMIN_ROLE);
              await userContext.setRoles(new Set([AUTH_TOS_SIGNED_ROLE, AUTH_ONBOARDED_ROLE]));

              const roles = await userContext.loadRoles();
              expect(roles.has(AUTH_TOS_SIGNED_ROLE)).toBe(true);
              expect(roles.has(AUTH_ONBOARDED_ROLE)).toBe(true);
              expect(roles.has(AUTH_ADMIN_ROLE)).toBe(false);
            });
          });

          describe('loadClaims()', () => {
            it('should load claims for the user', async () => {
              const userContext = authService.userContext(u.uid);
              const claims = await userContext.loadClaims();
              expect(claims).toBeDefined();
            });
          });

          describe('setClaims()', () => {
            it('should set the claims on the user', async () => {
              const userContext = authService.userContext(u.uid);
              await userContext.setClaims({ a: 1 });

              const claims = await userContext.loadClaims();
              expect(claims.a).toBe(1);
            });
          });

          describe('updateClaims()', () => {
            it('should merge new claims with existing claims', async () => {
              const userContext = authService.userContext(u.uid);
              await userContext.setClaims({ a: 1 });
              await userContext.updateClaims({ o: 1 });

              const claims = await userContext.loadClaims();
              expect(claims.a).toBe(1);
              expect(claims.o).toBe(1);
            });

            it('should remove claims with null values', async () => {
              const userContext = authService.userContext(u.uid);
              await userContext.setClaims({ a: 1, o: 1 });
              await userContext.updateClaims({ a: null });

              const claims = await userContext.loadClaims();
              expect(claims.a).toBeUndefined();
              expect(claims.o).toBe(1);
            });
          });

          describe('clearClaims()', () => {
            it('should clear all claims from the user', async () => {
              const userContext = authService.userContext(u.uid);
              await userContext.setClaims({ a: 1 });
              await userContext.clearClaims();

              const claims = await userContext.loadClaims();
              expect(objectHasNoKeys(claims)).toBe(true);
            });
          });

          describe('beginResetPassword()', () => {
            it('should set a password and add reset password claims', async () => {
              const userContext = authService.userContext(u.uid);

              let resetPasswordClaims = await userContext.loadResetPasswordClaims();
              expect(resetPasswordClaims).toBeUndefined();

              await userContext.beginResetPassword();

              const freshContext = authService.userContext(u.uid);
              const record = await freshContext.loadRecord();
              expect(record.passwordHash).toBeDefined();

              resetPasswordClaims = await freshContext.loadResetPasswordClaims();
              expect(resetPasswordClaims).toBeDefined();
            });
          });

          describe('setPassword()', () => {
            it('should clear reset password claims after setting a new password', async () => {
              const userContext = authService.userContext(u.uid);
              await userContext.beginResetPassword();

              const freshContext = authService.userContext(u.uid);
              let resetPasswordClaims = await freshContext.loadResetPasswordClaims();
              expect(resetPasswordClaims).toBeDefined();

              await freshContext.setPassword('newpassword123');

              const afterContext = authService.userContext(u.uid);
              resetPasswordClaims = await afterContext.loadResetPasswordClaims();
              expect(resetPasswordClaims).not.toBeDefined();
            });
          });
        });
      });

      describe('user does not exist', () => {
        it('should return false for exists()', async () => {
          const userContext = authService.userContext('nonexistent-uid');
          const exists = await userContext.exists();
          expect(exists).toBe(false);
        });

        describe('loadRecord()', () => {
          itShouldFail('for a nonexistent user', async () => {
            const userContext = authService.userContext('nonexistent-uid');
            await expectFail(() => userContext.loadRecord());
          });
        });

        describe('loadClaims()', () => {
          itShouldFail('for a nonexistent user', async () => {
            const userContext = authService.userContext('nonexistent-uid');
            await expectFail(() => userContext.loadClaims());
          });
        });

        describe('updateClaims()', () => {
          itShouldFail('for a nonexistent user', async () => {
            const userContext = authService.userContext('nonexistent-uid');
            await expectFail(() => userContext.updateClaims({}));
          });
        });

        describe('clearClaims()', () => {
          itShouldFail('for a nonexistent user', async () => {
            const userContext = authService.userContext('nonexistent-uid');
            await expectFail(() => userContext.clearClaims());
          });
        });
      });
    });

    describe('context()', () => {
      demoAuthorizedUserContext({ f }, (u) => {
        it('should create an auth context from callable context', async () => {
          const token = await u.loadDecodedIdToken();
          const callableContext = {
            auth: { uid: u.uid, token, rawToken: '' },
            rawRequest: {} as any,
            acceptsStreaming: false
          };

          const authContext = authService.context(callableContext as any);
          expect(authContext).toBeDefined();
          expect(authContext.uid).toBe(u.uid);
        });
      });

      demoAuthorizedUserAdminContext({ f }, (u) => {
        it('should detect admin in auth context', async () => {
          const token = await u.loadDecodedIdToken();
          const callableContext = {
            auth: { uid: u.uid, token, rawToken: '' },
            rawRequest: {} as any,
            acceptsStreaming: false
          };

          const authContext = authService.context(callableContext as any);
          expect(authContext.isAdmin).toBe(true);
        });
      });
    });
  });
});
