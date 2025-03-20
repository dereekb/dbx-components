import { FIREBASE_SERVER_AUTH_CLAIMS_SETUP_LAST_COM_DATE_KEY, FIREBASE_SERVER_AUTH_CLAIMS_SETUP_PASSWORD_KEY } from '@dereekb/firebase';
import { itShouldFail, expectFail } from '@dereekb/util/test';
import { type AuthData } from 'firebase-functions/lib/common/providers/https';
import { type DecodedIdToken } from 'firebase-admin/lib/auth/token-verifier';
import type * as admin from 'firebase-admin';
import { Module } from '@nestjs/common';
import { firebaseServerAuthModuleMetadata } from './auth.module';
import { authorizedUserContextFactory, firebaseAdminFunctionNestContextFactory, initFirebaseServerAdminTestEnvironment } from '@dereekb/firebase-server/test';
import { AbstractFirebaseServerAuthContext, AbstractFirebaseServerAuthService, AbstractFirebaseServerAuthUserContext, AbstractFirebaseServerNewUserService, type FirebaseServerAuthNewUserSetupDetails, type FirebaseServerAuthUserContext } from '../../auth/auth.service';
import { type AuthClaims, type AuthClaimsUpdate, authRoleClaimsService, type AuthRoleSet, AUTH_ADMIN_ROLE, AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE, type Maybe, objectHasNoKeys } from '@dereekb/util';
import { type CallableContextWithAuthData } from '../../function/context';
import { type NestContextCallableRequestWithAuth } from '../function/nest';
import { type AbstractFirebaseNestContext } from '../nest.provider';
import { assertIsAdminOrTargetUserInRequestData, isAdminInRequest, isAdminOrTargetUserInRequestData } from './auth.util';
import { addDays } from 'date-fns';

const TEST_CLAIMS_SERVICE_CONFIG = {
  a: { roles: [AUTH_ADMIN_ROLE] }
};

type TestAuthClaims = {
  a?: 1;
};

const TEST_ADMIN_USER_CLAIMS: TestAuthClaims = {
  a: 1
};

export class TestSetupContentFirebaseServerNewUserService extends AbstractFirebaseServerNewUserService<TestFirebaseServerAuthUserContext> {
  onSetupUser?: (x: Maybe<FirebaseServerAuthNewUserSetupDetails<TestFirebaseServerAuthUserContext>>) => void;

  protected async sendSetupContentToUser(user: Maybe<FirebaseServerAuthNewUserSetupDetails<TestFirebaseServerAuthUserContext>>): Promise<void> {
    // send nothing.
    this.onSetupUser?.(user);
  }
}

export class TestFirebaseServerAuthUserContext extends AbstractFirebaseServerAuthUserContext<TestAuthService> implements FirebaseServerAuthUserContext {}
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

  override newUser() {
    return new TestSetupContentFirebaseServerNewUserService(this);
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
const firebaseAuthAdminFunctionNestContext = firebaseAdminFunctionNestContextFactory({
  nestModules: TestAuthAppModule,
  injectFirebaseServerAppTokenProvider: true
});

const userContext = authorizedUserContextFactory({});

type LoadClaimsTest = {
  test?: number;
  second?: number;
};

describe('firebase server nest auth', () => {
  initFirebaseServerAdminTestEnvironment();

  firebaseAuthAdminFunctionNestContext((f) => {
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

          describe('loadDetails()', () => {
            it('should load the details for the user.', async () => {
              const details = await authUserContext.loadDetails();
              expect(details).toBeDefined();
            });
          });

          describe('beginResetPassword()', () => {
            it('should add password reset claims to the user and change their password.', async () => {
              let record = await authUserContext.loadRecord();
              const passwordHash = record.passwordHash;
              expect(passwordHash).not.toBeDefined(); // no password set in this test

              let resetPasswordClaims = await authUserContext.loadResetPasswordClaims();
              expect(resetPasswordClaims).toBeUndefined();

              await authUserContext.beginResetPassword();

              authUserContext = authService.userContext(u.uid);
              record = await authUserContext.loadRecord();

              expect(record.passwordHash).not.toBe(passwordHash);

              resetPasswordClaims = await authUserContext.loadResetPasswordClaims();
              expect(resetPasswordClaims).toBeDefined();
            });
          });

          describe('setPassword()', () => {
            it('should clear any reset password claims.', async () => {
              await authUserContext.beginResetPassword();

              authUserContext = authService.userContext(u.uid);
              let record = await authUserContext.loadRecord();

              expect(record.passwordHash).toBeDefined();

              let resetPasswordClaims = await authUserContext.loadResetPasswordClaims();
              expect(resetPasswordClaims).toBeDefined();

              // set new password
              await authUserContext.setPassword('newpassword');

              authUserContext = authService.userContext(u.uid);
              record = await authUserContext.loadRecord();

              resetPasswordClaims = await authUserContext.loadResetPasswordClaims();
              expect(resetPasswordClaims).not.toBeDefined();
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

        describe('exists()', () => {
          it('should return false', async () => {
            const exists = await authUserContext.exists();
            expect(exists).toBe(false);
          });
        });

        describe('loadRecord()', () => {
          itShouldFail('', async () => {
            await expectFail(() => authUserContext.loadRecord());
          });
        });

        describe('loadClaims()', () => {
          itShouldFail(async () => {
            await expectFail(() => authUserContext.loadClaims());
          });
        });

        describe('updateClaims()', () => {
          itShouldFail(async () => {
            await expectFail(() => authUserContext.updateClaims({}));
          });
        });

        describe('clearClaims()', () => {
          itShouldFail(async () => {
            await expectFail(() => authUserContext.clearClaims());
          });
        });
      });
    });

    describe('AbstractFirebaseServerNewUserService', () => {
      let newUserService: TestSetupContentFirebaseServerNewUserService;

      beforeEach(() => {
        newUserService = authService.newUser();
      });

      describe('initializeNewUser()', () => {
        const email = 'test@test.com';

        it('should initialize a new user', async () => {
          let setupSent = false;

          newUserService.onSetupUser = () => {
            setupSent = true;
          };

          const exists = await authService.auth
            .getUserByEmail(email)
            .then((x) => true)
            .catch(() => false);

          expect(exists).toBe(false);

          const result = await newUserService.initializeNewUser({
            email,
            sendSetupContent: true
          });

          expect(result).toBeDefined();
          expect(setupSent).toBe(true);

          const claims = result.customClaims as Record<string, string>;

          expect(claims[FIREBASE_SERVER_AUTH_CLAIMS_SETUP_PASSWORD_KEY]).toBeDefined();
          expect(claims[FIREBASE_SERVER_AUTH_CLAIMS_SETUP_LAST_COM_DATE_KEY]).toBeDefined();
        });
      });

      describe('newly initialized user', () => {
        const email = 'inittest@test.com';
        let initializedUser: admin.auth.UserRecord;

        beforeEach(async () => {
          initializedUser = await newUserService.initializeNewUser({
            email,
            sendSetupContent: false
          });
        });

        describe('markUserSetupAsComplete()', () => {
          it('should clear the setup claims from the user.', async () => {
            await newUserService.markUserSetupAsComplete(initializedUser.uid);

            const claims = await authService.userContext(initializedUser.uid).loadClaims();

            expect(claims[FIREBASE_SERVER_AUTH_CLAIMS_SETUP_PASSWORD_KEY]).not.toBeDefined();
            expect(claims[FIREBASE_SERVER_AUTH_CLAIMS_SETUP_LAST_COM_DATE_KEY]).not.toBeDefined();
          });
        });

        describe('sendSetupContent()', () => {
          it('should update the last communcation date in claims.', async () => {
            let claims = await authService.userContext(initializedUser.uid).loadClaims();

            // setup not defined since sendSetupEmail should be false.

            expect(claims[FIREBASE_SERVER_AUTH_CLAIMS_SETUP_PASSWORD_KEY]).toBeDefined();
            expect(claims[FIREBASE_SERVER_AUTH_CLAIMS_SETUP_LAST_COM_DATE_KEY]).not.toBeDefined();

            await newUserService.sendSetupContent(initializedUser.uid);

            claims = await authService.userContext(initializedUser.uid).loadClaims();

            expect(claims[FIREBASE_SERVER_AUTH_CLAIMS_SETUP_PASSWORD_KEY]).toBeDefined();
            expect(claims[FIREBASE_SERVER_AUTH_CLAIMS_SETUP_LAST_COM_DATE_KEY]).toBeDefined();
          });

          describe('setup content sent', () => {
            beforeEach(async () => {
              await newUserService.sendSetupContent(initializedUser.uid);
            });

            it('should not send the content again due to throttling', async () => {
              let claims = await authService.userContext(initializedUser.uid).loadClaims();

              const lastCommunicationDate = claims[FIREBASE_SERVER_AUTH_CLAIMS_SETUP_LAST_COM_DATE_KEY];

              expect(claims[FIREBASE_SERVER_AUTH_CLAIMS_SETUP_PASSWORD_KEY]).toBeDefined();
              expect(lastCommunicationDate).toBeDefined();

              const claimsWereSent = await newUserService.sendSetupContent(initializedUser.uid, { sendSetupDetailsOnce: true });
              expect(claimsWereSent).toBe(false);

              claims = await authService.userContext(initializedUser.uid).loadClaims();

              expect(claims[FIREBASE_SERVER_AUTH_CLAIMS_SETUP_PASSWORD_KEY]).toBeDefined();
              expect(claims[FIREBASE_SERVER_AUTH_CLAIMS_SETUP_LAST_COM_DATE_KEY]).toBe(lastCommunicationDate); // unchanged
            });

            describe('time since last send', () => {
              const newClaimsDate = addDays(new Date(), -3).toISOString(); // set to 3 days ago

              beforeEach(async () => {
                const userContext = authService.userContext(initializedUser.uid);

                await userContext.updateClaims({
                  [FIREBASE_SERVER_AUTH_CLAIMS_SETUP_LAST_COM_DATE_KEY]: newClaimsDate
                });
              });

              it('should send the content again after the send throttle period has ended', async () => {
                let claims = await authService.userContext(initializedUser.uid).loadClaims();

                const lastCommunicationDate = claims[FIREBASE_SERVER_AUTH_CLAIMS_SETUP_LAST_COM_DATE_KEY];

                expect(claims[FIREBASE_SERVER_AUTH_CLAIMS_SETUP_PASSWORD_KEY]).toBeDefined();
                expect(lastCommunicationDate).toBeDefined();

                const claimsWereSent = await newUserService.sendSetupContent(initializedUser.uid, {});
                expect(claimsWereSent).toBe(true);

                claims = await authService.userContext(initializedUser.uid).loadClaims();

                expect(claims[FIREBASE_SERVER_AUTH_CLAIMS_SETUP_PASSWORD_KEY]).toBeDefined();
                expect(claims[FIREBASE_SERVER_AUTH_CLAIMS_SETUP_LAST_COM_DATE_KEY]).not.toBe(lastCommunicationDate); // updated
              });

              describe('onlySendOnce=true', () => {
                it('should not send the content again after the send throttle period has ended', async () => {
                  let claims = await authService.userContext(initializedUser.uid).loadClaims();
                  const lastCommunicationDate = claims[FIREBASE_SERVER_AUTH_CLAIMS_SETUP_LAST_COM_DATE_KEY];

                  const claimsWereSent = await newUserService.sendSetupContent(initializedUser.uid, { sendSetupDetailsOnce: true });
                  expect(claimsWereSent).toBe(false);

                  claims = await authService.userContext(initializedUser.uid).loadClaims();

                  expect(claims[FIREBASE_SERVER_AUTH_CLAIMS_SETUP_PASSWORD_KEY]).toBeDefined();
                  expect(claims[FIREBASE_SERVER_AUTH_CLAIMS_SETUP_LAST_COM_DATE_KEY]).toBe(lastCommunicationDate); // unchanged
                });
              });
            });
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
