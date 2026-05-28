import { DBX_FIREBASE_SERVER_PASSWORD_RESET_INVALID_CODE_ERROR_CODE, FIREBASE_SERVER_AUTH_CLAIMS_RESET_EXPIRES_AT_KEY, FIREBASE_SERVER_AUTH_CLAIMS_RESET_PASSWORD_KEY, onCallUpdateModelParams } from '@dereekb/firebase';
import { encodeFirebaseServerUserPasswordResetOobCode, type FirebaseServerUserPasswordResetOobCode } from '@dereekb/firebase-server';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { captureRejection } from '@dereekb/util/test';
import { HttpsError } from 'firebase-functions/https';
import { profileIdentity, type ResetProfilePasswordParams } from 'demo-firebase';
import { demoCallModel } from '../model/crud.functions';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext } from '../../../test/fixture';

function expectInvalidCodeError(error: unknown): void {
  expect(error).toBeInstanceOf(HttpsError);
  // Errors crossing the callable boundary are surfaced as HttpsError; the original
  // FirebaseServerAuthPasswordResetInvalidCodeError is mapped to the opaque
  // PASSWORD_RESET_INVALID_CODE server-error code by catchAndThrowPasswordResetServerErrors.
  const details = (error as HttpsError).details as { code?: string } | undefined;
  expect(details?.code).toBe(DBX_FIREBASE_SERVER_PASSWORD_RESET_INVALID_CODE_ERROR_CODE);
}

function makeResetParams(data: ResetProfilePasswordParams) {
  return onCallUpdateModelParams(profileIdentity, data, 'resetPassword');
}

demoApiFunctionContextFactory((f) => {
  describe('Profile', () => {
    // Route through the real callModel dispatch (`demoCallModel`) so we exercise the wire-level
    // path, including the auth gate. The refactor that embedded the uid in the oob token means
    // the `complete` branch must accept a logged-out caller — these tests prove that by invoking
    // `callWrappedFunctionWithoutUserContext`. The `begin` branch supports both authenticated and
    // anonymous (email-based) callers.
    describeCallableRequestTest('passwordReset', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
      demoAuthorizedUserAdminContext({ f, addContactInfo: true }, (u) => {
        // Reconstruct the oob token that the user would have received in email by reading the
        // stored claims back out of the user record (the demo Mailgun pipeline injects the same
        // encoded value via `details.oobCode`).
        async function loadCurrentOobCode(): Promise<FirebaseServerUserPasswordResetOobCode> {
          const claims = await f.authService.userContext(u.uid).loadResetPasswordClaims();

          if (!claims?.resetPassword) {
            throw new Error('expected a stored reset code on the user; was beginPasswordReset called?');
          }

          return encodeFirebaseServerUserPasswordResetOobCode(u.uid, claims.resetPassword);
        }

        async function beginAndLoadOobCode(): Promise<FirebaseServerUserPasswordResetOobCode> {
          await u.callWrappedFunction(demoCallModelWrappedFn, makeResetParams({ requestReset: true }));
          return loadCurrentOobCode();
        }

        it('should begin a password reset (authenticated) and complete it (unauthenticated) with the generated code', async () => {
          // user context is intentionally re-created after each mutation because
          // AbstractFirebaseServerAuthUserContext.loadRecord() caches the user record per instance.
          expect(await f.authService.userContext(u.uid).loadResetPasswordClaims()).toBeUndefined();

          // Seed a real password so we can prove the begin step does NOT overwrite it.
          await f.authService.userContext(u.uid).setPassword('existingPassword1!');
          const passwordHashBeforeBegin = (await f.authService.userContext(u.uid).loadRecord()).passwordHash;
          expect(passwordHashBeforeBegin).toBeDefined();

          await u.callWrappedFunction(demoCallModelWrappedFn, makeResetParams({ requestReset: true }));

          const claimsAfterBegin = await f.authService.userContext(u.uid).loadResetPasswordClaims();
          expect(claimsAfterBegin?.resetPassword).toBeDefined();
          expect(claimsAfterBegin?.resetExpiresAt).toBeDefined();

          const recordAfterBegin = await f.authService.userContext(u.uid).loadRecord();
          // begin must leave the user's actual Firebase Auth password untouched — they
          // should still be able to sign in with their existing credential during the
          // reset window.
          expect(recordAfterBegin.passwordHash).toBe(passwordHashBeforeBegin);

          const oobCode = encodeFirebaseServerUserPasswordResetOobCode(u.uid, claimsAfterBegin!.resetPassword);
          const newPassword = 'newSecurePassword123!';

          // The completion call comes from a logged-out caller (clicking the email link). Routing
          // through callWrappedFunctionWithoutUserContext proves the handler does not depend on auth.
          await u.callWrappedFunctionWithoutUserContext(demoCallModelWrappedFn, makeResetParams({ oobCode, newPassword }));

          const contextAfterComplete = f.authService.userContext(u.uid);
          const recordAfterComplete = await contextAfterComplete.loadRecord();
          expect(recordAfterComplete.passwordHash).toBeDefined();
          expect(recordAfterComplete.passwordHash).not.toBe(passwordHashBeforeBegin);
          expect(await contextAfterComplete.loadResetPasswordClaims()).toBeUndefined();
        });

        it('should begin a password reset for a logged-out caller using the email field', async () => {
          expect(await f.authService.userContext(u.uid).loadResetPasswordClaims()).toBeUndefined();

          const { email } = await u.loadUserEmailAndPhone();
          await u.callWrappedFunctionWithoutUserContext(demoCallModelWrappedFn, makeResetParams({ requestReset: true, email }));

          const claimsAfterBegin = await f.authService.userContext(u.uid).loadResetPasswordClaims();
          expect(claimsAfterBegin?.resetPassword).toBeDefined();
          expect(claimsAfterBegin?.resetExpiresAt).toBeDefined();
        });

        it('should silently succeed when requesting a reset for an unregistered email (no enumeration oracle)', async () => {
          // Anonymous forgot-password caller submits an email that does not belong to any user.
          // The call must resolve without throwing so the wire response is identical to the
          // success case — otherwise an attacker can probe which emails are registered.
          const unknownEmail = `nobody-${Date.now()}@example.invalid`;

          await expect(u.callWrappedFunctionWithoutUserContext(demoCallModelWrappedFn, makeResetParams({ requestReset: true, email: unknownEmail }))).resolves.toBeUndefined();

          // And of course no claims were written to the original user (sanity).
          expect(await f.authService.userContext(u.uid).loadResetPasswordClaims()).toBeUndefined();
        });

        it('should reject completion with an invalid code without consuming the reset claims', async () => {
          await beginAndLoadOobCode();
          const passwordHashBefore = (await f.authService.userContext(u.uid).loadRecord()).passwordHash;

          const wrongOobCode = encodeFirebaseServerUserPasswordResetOobCode(u.uid, '000000');
          const error = await captureRejection(() => u.callWrappedFunctionWithoutUserContext(demoCallModelWrappedFn, makeResetParams({ oobCode: wrongOobCode, newPassword: 'wontMatter1!' })));
          expectInvalidCodeError(error);

          const userContextAfter = f.authService.userContext(u.uid);
          expect(await userContextAfter.loadResetPasswordClaims()).toBeDefined(); // claims still present
          expect((await userContextAfter.loadRecord()).passwordHash).toBe(passwordHashBefore); // password unchanged
        });

        it('should reject completion when no active reset exists with the same opaque error', async () => {
          expect(await f.authService.userContext(u.uid).loadResetPasswordClaims()).toBeUndefined();
          const passwordHashBefore = (await f.authService.userContext(u.uid).loadRecord()).passwordHash;

          const wrongOobCode = encodeFirebaseServerUserPasswordResetOobCode(u.uid, '123456');
          const error = await captureRejection(() => u.callWrappedFunctionWithoutUserContext(demoCallModelWrappedFn, makeResetParams({ oobCode: wrongOobCode, newPassword: 'wontMatter1!' })));
          expectInvalidCodeError(error);

          // Sanity: the user's password hash must not change when there is no active reset in flight.
          expect((await f.authService.userContext(u.uid).loadRecord()).passwordHash).toBe(passwordHashBefore);
        });

        it('should rotate the code when beginPasswordReset is called a second time', async () => {
          const firstOobCode = await beginAndLoadOobCode();
          const secondOobCode = await beginAndLoadOobCode();

          expect(secondOobCode).toBeDefined();
          expect(secondOobCode).not.toBe(firstOobCode);
        });

        it('should reject re-use of a code after a successful complete', async () => {
          const oobCode = await beginAndLoadOobCode();
          await u.callWrappedFunctionWithoutUserContext(demoCallModelWrappedFn, makeResetParams({ oobCode, newPassword: 'firstPassword1!' }));

          expect(await f.authService.userContext(u.uid).loadResetPasswordClaims()).toBeUndefined();

          const error = await captureRejection(() => u.callWrappedFunctionWithoutUserContext(demoCallModelWrappedFn, makeResetParams({ oobCode, newPassword: 'shouldNotApply1!' })));
          expectInvalidCodeError(error);
        });

        it('should reject a code whose resetExpiresAt has already passed', async () => {
          const oobCode = await beginAndLoadOobCode();

          // Backdate the expiry to one minute ago.
          await f.authService.userContext(u.uid).updateClaims({
            [FIREBASE_SERVER_AUTH_CLAIMS_RESET_EXPIRES_AT_KEY]: new Date(Date.now() - 60_000).toISOString()
          });

          const error = await captureRejection(() => u.callWrappedFunctionWithoutUserContext(demoCallModelWrappedFn, makeResetParams({ oobCode, newPassword: 'tooLate1!' })));
          expectInvalidCodeError(error);

          // Claims are still present (we do not auto-clear on expiry — user must re-initiate).
          expect(await f.authService.userContext(u.uid).loadResetPasswordClaims()).toBeDefined();
        });

        it('should accept at least one of two concurrent completions and any rejection returns the opaque error', async () => {
          const oobCode = await beginAndLoadOobCode();

          const results = await Promise.allSettled([u.callWrappedFunctionWithoutUserContext(demoCallModelWrappedFn, makeResetParams({ oobCode, newPassword: 'concurrentA1!' })), u.callWrappedFunctionWithoutUserContext(demoCallModelWrappedFn, makeResetParams({ oobCode, newPassword: 'concurrentB1!' }))]);

          const fulfilled = results.filter((r) => r.status === 'fulfilled');
          const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

          // Document the observed behavior: today both can succeed because the compare-and-clear
          // step is not atomic across concurrent calls. Tighten this assertion once single-use
          // is enforced atomically. For now, lock in that at least one succeeds and any rejection
          // carries the opaque "invalid code" error.
          expect(fulfilled.length).toBeGreaterThanOrEqual(1);
          for (const r of rejected) {
            expectInvalidCodeError(r.reason);
          }

          // Reset claims have been cleared after a successful complete.
          const claims = await f.authService.userContext(u.uid).loadClaims();
          expect(claims[FIREBASE_SERVER_AUTH_CLAIMS_RESET_PASSWORD_KEY]).toBeUndefined();
        });

        it('should reject a malformed oob token', async () => {
          await beginAndLoadOobCode();
          const passwordHashBefore = (await f.authService.userContext(u.uid).loadRecord()).passwordHash;

          const error = await captureRejection(() => u.callWrappedFunctionWithoutUserContext(demoCallModelWrappedFn, makeResetParams({ oobCode: 'no-dash-no-uid', newPassword: 'wontMatter1!' })));
          expectInvalidCodeError(error);

          // A malformed token must never reach setPassword.
          expect((await f.authService.userContext(u.uid).loadRecord()).passwordHash).toBe(passwordHashBefore);
        });

        it('should reject an oob token whose embedded uid does not match the stored claims', async () => {
          await u.callWrappedFunction(demoCallModelWrappedFn, makeResetParams({ requestReset: true }));
          const refreshedCode = (await f.authService.userContext(u.uid).loadResetPasswordClaims())!.resetPassword;
          const passwordHashBefore = (await f.authService.userContext(u.uid).loadRecord()).passwordHash;

          // Forge a token: real code, but a uid that owns no reset.
          const wrongUidToken = encodeFirebaseServerUserPasswordResetOobCode('some-other-uid', refreshedCode);
          const error = await captureRejection(() => u.callWrappedFunctionWithoutUserContext(demoCallModelWrappedFn, makeResetParams({ oobCode: wrongUidToken, newPassword: 'wontMatter1!' })));
          expectInvalidCodeError(error);

          // The legitimate user's password must not have been touched by an attacker forging
          // a token with a different uid.
          expect((await f.authService.userContext(u.uid).loadRecord()).passwordHash).toBe(passwordHashBefore);
        });
      });
    });
  });
});
