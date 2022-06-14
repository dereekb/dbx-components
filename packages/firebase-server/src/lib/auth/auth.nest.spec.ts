import { AuthData } from 'firebase-functions/lib/common/providers/https';
import { DecodedIdToken } from 'firebase-admin/lib/auth/token-verifier';
import * as admin from 'firebase-admin';
import { Module } from '@nestjs/common';
import { firebaseServerAuthModuleMetadata } from './auth.nest';
import { authorizedUserContextFactory, firebaseAdminFunctionNestContextFactory, initFirebaseServerAdminTestEnvironment } from '@dereekb/firebase-server/test';
import { AbstractFirebaseServerAuthContext, AbstractFirebaseServerAuthService, AbstractFirebaseServerAuthUserContext } from './auth.service';
import { AuthClaims, AuthClaimsUpdate, authRoleClaimsService, AuthRoleSet, AUTH_ADMIN_ROLE, AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE, objectHasNoKeys } from '@dereekb/util';
import { CallableContextWithAuthData } from '../function/context';
import { NestContextCallableRequestWithAuth } from '../nest/function/nest';
import { AbstractFirebaseNestContext } from '../nest/nest.provider';
import { assertIsAdminOrTargetUserInRequestData, isAdminInRequest, isAdminOrTargetUserInRequestData } from './auth.nest.util';

const TEST_CLAIMS_SERVICE_CONFIG = {
  a: { roles: [AUTH_ADMIN_ROLE] }
};

type TestAuthClaims = {
  a?: 1;
};

const TEST_ADMIN_USER_CLAIMS: TestAuthClaims = {
  a: 1
};

export class TestFirebaseServerAuthUserContext extends AbstractFirebaseServerAuthUserContext<TestAuthService> {}
export class TestFirebaseServerAuthContext extends AbstractFirebaseServerAuthContext<TestFirebaseServerAuthContext, TestFirebaseServerAuthUserContext, TestAuthService> {}
export class TestAuthService extends AbstractFirebaseServerAuthService<TestFirebaseServerAuthUserContext, TestFirebaseServerAuthContext> {
  static readonly TEST_CLAIMS_SERVICE = authRoleClaimsService<TestAuthClaims>(TEST_CLAIMS_SERVICE_CONFIG);

  protected _context(context: CallableContextWithAuthData): TestFirebaseServerAuthContext {
    return new TestFirebaseServerAuthContext(this, context);
  }

  userContext(uid: string): TestFirebaseServerAuthUserContext {
    return new TestFirebaseServerAuthUserContext(this, uid);
  }

  readRoles(claims: AuthClaims): AuthRoleSet {
    return TestAuthService.TEST_CLAIMS_SERVICE.toRoles(claims);
  }

  claimsForRoles(roles: AuthRoleSet): AuthClaimsUpdate<TestAuthClaims> {
    return TestAuthService.TEST_CLAIMS_SERVICE.toClaims(roles);
  }
}

@Module(
  firebaseServerAuthModuleMetadata({
    serviceProvider: {
      provide: TestAuthService,
      useFactory: (auth: admin.auth.Auth) => new TestAuthService(auth)
    }
  })
)
export class TestAuthAppModule {}

/**
 * Test context factory that will automatically instantiate TestAppModule for each test, and make it available.
 */
const firebaseAdminFunctionNestContext = firebaseAdminFunctionNestContextFactory({
  nestModules: TestAuthAppModule,
  injectFirebaseServerAppTokenProvider: true
});

const userContext = authorizedUserContextFactory({});

type LoadClaimsTest = {
  test?: number;
  second?: number;
};

describe('firebase server auth', () => {
  initFirebaseServerAdminTestEnvironment();

  firebaseAdminFunctionNestContext((f) => {
    let authService: TestAuthService;

    beforeEach(() => {
      authService = f.get(TestAuthService);
    });

    describe('FirebaseServerAuthService', () => {
      let authUserContext: TestFirebaseServerAuthUserContext;

      describe('user exists', () => {
        userContext({ f }, (u) => {
          beforeEach(() => {
            authUserContext = authService.userContext(u.uid);
          });

          describe('loadRecord()', () => {
            it('should load the record for the user.', async () => {
              const record = await authUserContext.loadRecord();
              expect(record).toBeDefined();
            });
          });

          describe('addRoles()', () => {
            it('should update the claims to have the roles (as configured by the service).', async () => {
              await authUserContext.addRoles(AUTH_ADMIN_ROLE);
              const claims: AuthClaims<typeof TEST_CLAIMS_SERVICE_CONFIG> = await authUserContext.loadClaims();
              expect(claims).toBeDefined();
              expect(claims.a).toBe(AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE);

              const roles = await authUserContext.loadRoles();
              expect(roles.has(AUTH_ADMIN_ROLE)).toBe(true);
            });
          });

          describe('removeRoles()', () => {
            it('should update the claims to remove the roles (as configured by the service).', async () => {
              await authUserContext.addRoles(AUTH_ADMIN_ROLE);
              await authUserContext.removeRoles(AUTH_ADMIN_ROLE);

              const claims: AuthClaims<typeof TEST_CLAIMS_SERVICE_CONFIG> = await authUserContext.loadClaims();
              expect(claims.a).not.toBeDefined();

              const roles = await authUserContext.loadRoles();
              expect(roles.has(AUTH_ADMIN_ROLE)).toBe(false);
            });

            it('should not remove other unassociated roles from the one being removed.', async () => {
              await authUserContext.addRoles(AUTH_ADMIN_ROLE);
              await authUserContext.removeRoles('test');

              const claims: AuthClaims<typeof TEST_CLAIMS_SERVICE_CONFIG> = await authUserContext.loadClaims();
              expect(claims.a).toBeDefined();
              expect(claims.a).toBe(AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE);

              const roles = await authUserContext.loadRoles();
              expect(roles.has(AUTH_ADMIN_ROLE)).toBe(true);
            });
          });

          describe('loadClaims()', () => {
            it('should load claims for the user.', async () => {
              const data = {
                test: 1
              };

              let claims = await authUserContext.loadClaims<LoadClaimsTest>();
              expect(claims).toBeDefined();
              expect(objectHasNoKeys(claims)).toBe(true);

              await authUserContext.setClaims(data);

              claims = await authUserContext.loadClaims<LoadClaimsTest>();
              expect(claims).toBeDefined();
              expect(claims.test).toBe(1);
            });
          });

          describe('updateClaims()', () => {
            it('should update the existing claims.', async () => {
              await authUserContext.setClaims({
                test: 1
              });

              let claims = await authUserContext.loadClaims<LoadClaimsTest>();
              expect(claims).toBeDefined();
              expect(claims!.test).toBe(1);
              expect(claims!.second).not.toBe(2);

              await authUserContext.updateClaims({
                second: 2
              });

              claims = await authUserContext.loadClaims();
              expect(claims).toBeDefined();
              expect(claims!.test).toBe(1);
              expect(claims!.second).toBe(2);
            });

            it('should remove any keys with null update values', async () => {
              await authUserContext.setClaims({
                test: 1,
                second: 2
              });

              let claims = await authUserContext.loadClaims<LoadClaimsTest>();
              expect(claims).toBeDefined();
              expect(claims!.test).toBe(1);

              await authUserContext.updateClaims({
                test: null
              });

              claims = await authUserContext.loadClaims();
              expect(claims).toBeDefined();
              expect(claims!.test).toBeUndefined();
              expect(claims!.second).toBe(2);
            });
          });

          describe('clearClaims()', () => {
            it('should clear the claims.', async () => {
              await authUserContext.setClaims({
                test: 1
              });

              let claims = await authUserContext.loadClaims<LoadClaimsTest>();
              expect(claims).toBeDefined();
              expect(claims!.test).toBe(1);

              await authUserContext.clearClaims();

              claims = await authUserContext.loadClaims();
              expect(claims).toBeDefined();
              expect(objectHasNoKeys(claims!)).toBe(true);
            });
          });
        });
      });

      describe('user does not exist', () => {
        beforeEach(() => {
          authUserContext = authService.userContext('test');
        });

        describe('loadRecord()', () => {
          it('should throw an exception.', async () => {
            try {
              await authUserContext.loadRecord();
              fail();
            } catch (e) {
              expect(e).toBeDefined();
            }
          });
        });

        describe('loadClaims()', () => {
          it('should throw an exception.', async () => {
            try {
              await authUserContext.loadClaims();
              fail();
            } catch (e) {
              expect(e).toBeDefined();
            }
          });
        });

        describe('updateClaims()', () => {
          it('should throw an exception.', async () => {
            try {
              await authUserContext.updateClaims({});
              fail();
            } catch (e) {
              expect(e).toBeDefined();
            }
          });
        });

        describe('clearClaims()', () => {
          it('should throw an exception.', async () => {
            try {
              await authUserContext.clearClaims();
              fail();
            } catch (e) {
              expect(e).toBeDefined();
            }
          });
        });
      });
    });

    describe('auth.nest.util', () => {
      let context: AbstractFirebaseNestContext<any, any>;

      beforeEach(() => {
        context = {
          authService
        } as unknown as AbstractFirebaseNestContext<any, any>;
      });

      describe('with admin', () => {
        userContext({ f, template: { claims: TEST_ADMIN_USER_CLAIMS } }, (u) => {
          let token: DecodedIdToken;
          let auth: AuthData;

          beforeEach(async () => {
            token = await u.loadDecodedIdToken();
            auth = {
              uid: u.uid,
              token
            };
          });

          describe('isAdminInRequest', () => {
            it('should return true.', async () => {
              const request: NestContextCallableRequestWithAuth<AbstractFirebaseNestContext<any, any>, any> = {
                nest: context,
                rawRequest: {} as any,
                auth,
                data: {} as any
              };

              const result = isAdminInRequest(request);
              expect(result).toBe(true);
            });
          });

          describe('isAdminOrTargetUserInRequestData', () => {
            it('should return true.', async () => {
              const request: NestContextCallableRequestWithAuth<AbstractFirebaseNestContext<any, any>, any> = {
                nest: context,
                rawRequest: {} as any,
                auth,
                data: {} as any
              };

              const result = isAdminOrTargetUserInRequestData(request);
              expect(result).toBe(true);
            });
          });
        });
      });

      describe('without admin', () => {
        userContext({ f }, (u) => {
          let token: DecodedIdToken;
          let auth: AuthData;

          beforeEach(async () => {
            token = await u.loadDecodedIdToken();
            auth = {
              uid: u.uid,
              token
            };
          });

          describe('isAdminInRequest', () => {
            it('should return false', async () => {
              const request: NestContextCallableRequestWithAuth<AbstractFirebaseNestContext<any, any>, any> = {
                nest: context,
                rawRequest: {} as any,
                auth,
                data: {} as any
              };

              const result = isAdminInRequest(request);
              expect(result).toBe(false);
            });
          });

          describe('isAdminOrTargetUserInRequestData', () => {
            let request: NestContextCallableRequestWithAuth<AbstractFirebaseNestContext<any, any>, any>;

            beforeEach(() => {
              request = {
                nest: context,
                rawRequest: {} as any,
                auth,
                data: {} as any
              };
            });

            describe('assertIsAdminOrTargetUserInRequestData', () => {
              describe('requireUid=false', () => {
                it('should return the uid of the auth if the uid is not provided.', async () => {
                  const result = assertIsAdminOrTargetUserInRequestData(request, false);
                  expect(result).toBe(auth.uid);
                });
              });
            });

            describe('requireUid=false', () => {
              it('should return true if the uid is not provided.', async () => {
                const result = isAdminOrTargetUserInRequestData(request, false);
                expect(result).toBe(true);
              });

              it('should return true if the uid is provided and matches the auth uid', async () => {
                request.data.uid = auth.uid;
                const result = isAdminOrTargetUserInRequestData(request, false);
                expect(result).toBe(true);
              });

              it('should return false if the uid is provided and does not match the auth uid', async () => {
                request.data.uid = 'otheruid';
                const result = isAdminOrTargetUserInRequestData(request, false);
                expect(result).toBe(false);
              });
            });

            describe('requireUid=true', () => {
              it('should return false if the uid is not provided.', async () => {
                const result = isAdminOrTargetUserInRequestData(request, true);
                expect(result).toBe(false);
              });

              it('should return true if the uid is provided and matches the auth uid.', async () => {
                request.data.uid = auth.uid;
                const result = isAdminOrTargetUserInRequestData(request, true);
                expect(result).toBe(true);
              });

              it('should return false if the uid is provided and does not match the auth uid', async () => {
                request.data.uid = 'otheruid';
                const result = isAdminOrTargetUserInRequestData(request, false);
                expect(result).toBe(false);
              });
            });
          });
        });
      });
    });
  });
});
