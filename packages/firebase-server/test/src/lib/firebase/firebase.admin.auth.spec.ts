import { type FirebaseAdminTestContext, firebaseAdminTestContextFactory, type FirebaseAdminTestContextFixture } from './firebase.admin';
import { initFirebaseServerAdminTestEnvironment } from './firebase.admin.test.server';
import { authorizedUserContext, authorizedUserContextFactory, AuthorizedUserTestContextFixture, AuthorizedUserTestContextInstance } from './firebase.admin.auth';
import { type EmailAddress, randomNumberFactory } from '@dereekb/util';

export class ExampleFixture extends AuthorizedUserTestContextFixture<FirebaseAdminTestContext, FirebaseAdminTestContextFixture> {}

export class ExampleInstance extends AuthorizedUserTestContextInstance {}

describe('authorizedUserContextFactory()', () => {
  initFirebaseServerAdminTestEnvironment();

  firebaseAdminTestContextFactory((f) => {
    describe('config', () => {
      describe('makeUserDetails()', () => {
        const email = 'test@test.com';
        const expectedTestClaimValue = true;

        authorizedUserContext(
          {
            f,
            makeUserDetails: () => {
              return {
                details: {
                  email
                },
                claims: {
                  test: expectedTestClaimValue
                }
              };
            }
          },
          (u) => {
            it('should have set the test email.', async () => {
              const record = await u.instance.loadUserRecord();
              expect(record.email).toBe(email);
            });

            it('should have added the custom claims.', async () => {
              const record = await u.instance.loadUserRecord();
              expect(record.customClaims).toBeDefined();
              expect(record.customClaims!['test']).toBe(expectedTestClaimValue);

              const token = await u.instance.loadDecodedIdToken();
              expect(token['test']).toBe(expectedTestClaimValue);
            });
          }
        );
      });

      describe('makeFixture()', () => {
        authorizedUserContext(
          {
            f,
            makeFixture: (parent) => new ExampleFixture(parent)
          },
          (u) => {
            it('should have created the test fixture.', async () => {
              expect(u instanceof ExampleFixture).toBe(true);
            });
          }
        );
      });

      describe('makeInstance()', () => {
        authorizedUserContext(
          {
            f,
            makeInstance: (uid, instance) => new ExampleInstance(uid, instance)
          },
          (u) => {
            it('should have created the test instance.', async () => {
              expect(u.instance instanceof ExampleInstance).toBe(true);
            });
          }
        );
      });
    });

    describe('factory', () => {
      const expectedTestClaimValue = true;

      const factory = authorizedUserContextFactory({
        makeUserDetails: () => {
          return {
            claims: {
              test: expectedTestClaimValue
            }
          };
        }
      });

      describe('no arguments', () => {
        factory({ f }, (u1) => {
          it('should have added the custom claims.', async () => {
            const record = await u1.instance.loadUserRecord();
            expect(record.customClaims).toBeDefined();
            expect(record.customClaims!['test']).toBe(expectedTestClaimValue);

            const token = await u1.instance.loadDecodedIdToken();
            expect(token['test']).toBe(expectedTestClaimValue);
          });

          describe('nested factory call', () => {
            factory({ f }, (u2) => {
              it('should have created a second account.', async () => {
                const uRecord = await u1.instance.loadUserRecord();
                const u2Record = await u2.instance.loadUserRecord();

                expect(u2.uid).not.toBe(u1.uid);
                expect(u2Record.uid).not.toBe(uRecord.uid);
              });

              describe('second nested factory call', () => {
                factory({ f }, (u3) => {
                  it('should have created a third account.', async () => {
                    const uRecord = await u1.instance.loadUserRecord();
                    const u2Record = await u2.instance.loadUserRecord();
                    const u3Record = await u3.instance.loadUserRecord();

                    expect(u3.uid).not.toBe(u2.uid);
                    expect(u3Record.uid).not.toBe(u2Record.uid);
                  });
                });
              });
            });
          });
        });
      });

      describe('addContactInfo=true', () => {
        factory({ f }, (u1) => {
          factory({ f, addContactInfo: true }, (u2) => {
            it('should have added the contact info to the record', async () => {
              const uRecord = await u1.instance.loadUserRecord();
              const u2Record = await u2.instance.loadUserRecord();

              expect(uRecord.email).not.toBeDefined(); // not added since not requested for u1
              expect(u2Record.email).toBeDefined();
            });
          });
        });
      });

      describe('template', () => {
        let randomNumber = 0;
        let expectedEmail: EmailAddress;

        beforeEach(() => {
          randomNumber = randomNumberFactory(10000000000, 'floor')();
        });

        describe('as getter', () => {
          factory(
            {
              f,
              template: () => {
                return {
                  claims: {
                    test: true,
                    randomNumber
                  }
                };
              }
            },
            (u) => {
              it('should have added the claims to the record', async () => {
                const uRecord = await u.instance.loadUserRecord();
                const { customClaims = {} } = uRecord;

                expect(customClaims['test']).toBe(true);
                expect(customClaims['randomNumber']).toBe(randomNumber);
              });
            }
          );
        });
      });

      describe('user', () => {
        let randomNumber = 0;
        let expectedEmail: EmailAddress;

        beforeEach(() => {
          randomNumber = randomNumberFactory(10000000000, 'floor')();
          expectedEmail = `test+${randomNumber}@components.dereekb.com`;
        });

        describe('as getter', () => {
          factory(
            {
              f,
              user: () => {
                return {
                  email: expectedEmail,
                  emailVerified: true
                };
              }
            },
            (u) => {
              it('should have added the email to the record', async () => {
                const uRecord = await u.instance.loadUserRecord();
                expect(uRecord.email).toBe(expectedEmail);
              });
            }
          );
        });
      });
    });
  });
});
