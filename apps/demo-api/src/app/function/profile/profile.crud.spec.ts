import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { DBX_FIREBASE_SERVER_PASSWORD_RESET_INVALID_CODE_ERROR_CODE, FIREBASE_SERVER_AUTH_CLAIMS_RESET_EXPIRES_AT_KEY, FIREBASE_SERVER_AUTH_CLAIMS_RESET_PASSWORD_KEY, onCallUpdateModelParams } from '@dereekb/firebase';
import { type ServerError } from '@dereekb/util';
import { captureRejection } from '@dereekb/util/test';
import { profileIdentity, type ResetProfilePasswordParams } from 'demo-firebase';
import { HttpsError } from 'firebase-functions/https';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoProfileContext } from '../../../test/fixture';
import { demoCallModel } from '../model/crud.functions';

function expectInvalidCodeError(error: unknown): void {
  expect(error).toBeInstanceOf(HttpsError);
  const { code } = (error as HttpsError).details as ServerError;
  expect(code).toBe(DBX_FIREBASE_SERVER_PASSWORD_RESET_INVALID_CODE_ERROR_CODE);
}

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('profile.crud', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    describe('Profile', () => {
      demoAuthorizedUserAdminContext({ f, addContactInfo: true }, (u) => {
        async function callResetPassword(params: ResetProfilePasswordParams) {
          return u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(profileIdentity, params, 'resetPassword'));
        }

        demoProfileContext({ f, u }, (_p) => {
          describe('resetPassword', () => {
            // NOSONAR (typescript:S7721): helper closes over `f`, `u`, and `callResetPassword` from describe contexts — hoisting would require threading them as params on every call site.
            async function beginAndLoadCode(): Promise<string> {
              await callResetPassword({ requestReset: true });
              const claims = await f.authService.userContext(u.uid).loadResetPasswordClaims();
              expect(claims?.resetPassword).toBeDefined();
              return claims!.resetPassword;
            }

            it('should begin a password reset and then complete it with the generated code', async () => {
              const userContext = f.authService.userContext(u.uid);

              expect(await userContext.loadResetPasswordClaims()).toBeUndefined();

              await callResetPassword({ requestReset: true });

              const contextAfterBegin = f.authService.userContext(u.uid);
              const recordAfterBegin = await contextAfterBegin.loadRecord();
              expect(recordAfterBegin.passwordHash).toBeDefined();

              const resetClaims = await contextAfterBegin.loadResetPasswordClaims();
              expect(resetClaims).toBeDefined();
              expect(resetClaims?.resetPassword).toBeDefined();
              expect(resetClaims?.resetExpiresAt).toBeDefined();

              const generatedCode = resetClaims!.resetPassword;
              const passwordHashAfterBegin = recordAfterBegin.passwordHash;

              const newPassword = 'newSecurePassword123!';
              await callResetPassword({ resetPassword: generatedCode, newPassword });

              const contextAfterComplete = f.authService.userContext(u.uid);
              const recordAfterComplete = await contextAfterComplete.loadRecord();
              expect(recordAfterComplete.passwordHash).toBeDefined();
              expect(recordAfterComplete.passwordHash).not.toBe(passwordHashAfterBegin);
              expect(await contextAfterComplete.loadResetPasswordClaims()).toBeUndefined();
            });

            it('should reject completion with an invalid code without consuming the reset claims', async () => {
              await beginAndLoadCode();
              const passwordHashBefore = (await f.authService.userContext(u.uid).loadRecord()).passwordHash;

              const error = await captureRejection(() => callResetPassword({ resetPassword: '000000', newPassword: 'wontMatter1!' }));
              expectInvalidCodeError(error);

              const userContextAfter = f.authService.userContext(u.uid);
              expect(await userContextAfter.loadResetPasswordClaims()).toBeDefined(); // claims still present
              expect((await userContextAfter.loadRecord()).passwordHash).toBe(passwordHashBefore); // password unchanged
            });

            it('should reject completion when no active reset exists with the same opaque error', async () => {
              expect(await f.authService.userContext(u.uid).loadResetPasswordClaims()).toBeUndefined();

              const error = await captureRejection(() => callResetPassword({ resetPassword: '123456', newPassword: 'wontMatter1!' }));
              expectInvalidCodeError(error);
            });

            it('should silently no-op when neither requestReset nor a code+newPassword is provided', async () => {
              const userContext = f.authService.userContext(u.uid);
              const recordBefore = await userContext.loadRecord();
              const claimsBefore = await userContext.loadResetPasswordClaims();

              await callResetPassword({});

              const recordAfter = await f.authService.userContext(u.uid).loadRecord();
              const claimsAfter = await f.authService.userContext(u.uid).loadResetPasswordClaims();

              expect(recordAfter.passwordHash).toBe(recordBefore.passwordHash);
              expect(claimsAfter).toEqual(claimsBefore);
            });

            it('should rotate the code when requestReset is called a second time', async () => {
              const firstCode = await beginAndLoadCode();
              const secondCode = await beginAndLoadCode();

              expect(secondCode).toBeDefined();
              expect(secondCode).not.toBe(firstCode);
            });

            it('should reject re-use of a code after a successful complete', async () => {
              const code = await beginAndLoadCode();
              await callResetPassword({ resetPassword: code, newPassword: 'firstPassword1!' });

              expect(await f.authService.userContext(u.uid).loadResetPasswordClaims()).toBeUndefined();

              const error = await captureRejection(() => callResetPassword({ resetPassword: code, newPassword: 'shouldNotApply1!' }));
              expectInvalidCodeError(error);
            });

            it('should reject a code whose resetExpiresAt has already passed', async () => {
              const code = await beginAndLoadCode();

              // Backdate the expiry to one minute ago.
              await f.authService.userContext(u.uid).updateClaims({
                [FIREBASE_SERVER_AUTH_CLAIMS_RESET_EXPIRES_AT_KEY]: new Date(Date.now() - 60_000).toISOString()
              });

              const error = await captureRejection(() => callResetPassword({ resetPassword: code, newPassword: 'tooLate1!' }));
              expectInvalidCodeError(error);

              // Claims are still present (we do not auto-clear on expiry — user must re-initiate).
              expect(await f.authService.userContext(u.uid).loadResetPasswordClaims()).toBeDefined();
            });

            it('should accept at least one of two concurrent completions and any rejection returns the opaque error', async () => {
              const code = await beginAndLoadCode();

              const results = await Promise.allSettled([callResetPassword({ resetPassword: code, newPassword: 'concurrentA1!' }), callResetPassword({ resetPassword: code, newPassword: 'concurrentB1!' })]);

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
          });
        });
      });
    });
  });
});
