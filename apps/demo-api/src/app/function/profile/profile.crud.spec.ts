import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { onCallUpdateModelParams } from '@dereekb/firebase';
import { profileIdentity, type ResetProfilePasswordParams } from 'demo-firebase';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoProfileContext } from '../../../test/fixture';
import { demoCallModel } from '../model/crud.functions';

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('profile.crud', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    describe('Profile', () => {
      demoAuthorizedUserAdminContext({ f, addContactInfo: true }, (u) => {
        demoProfileContext({ f, u }, (_p) => {
          describe('resetPassword', () => {
            it('should begin a password reset and then complete it with the generated code', async () => {
              const userContext = f.authService.userContext(u.uid);

              expect(await userContext.loadResetPasswordClaims()).toBeUndefined();

              const beginParams: ResetProfilePasswordParams = { requestReset: true };
              await u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(profileIdentity, beginParams, 'resetPassword'));

              const contextAfterBegin = f.authService.userContext(u.uid);
              const recordAfterBegin = await contextAfterBegin.loadRecord();
              expect(recordAfterBegin.passwordHash).toBeDefined();

              const resetClaims = await contextAfterBegin.loadResetPasswordClaims();
              expect(resetClaims).toBeDefined();
              expect(resetClaims?.resetPassword).toBeDefined();

              const generatedCode = resetClaims!.resetPassword;
              const passwordHashAfterBegin = recordAfterBegin.passwordHash;

              const newPassword = 'newSecurePassword123!';
              const completeParams: ResetProfilePasswordParams = {
                resetPassword: generatedCode,
                newPassword
              };
              await u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(profileIdentity, completeParams, 'resetPassword'));

              const contextAfterComplete = f.authService.userContext(u.uid);
              const recordAfterComplete = await contextAfterComplete.loadRecord();
              expect(recordAfterComplete.passwordHash).toBeDefined();
              expect(recordAfterComplete.passwordHash).not.toBe(passwordHashAfterBegin);
              expect(await contextAfterComplete.loadResetPasswordClaims()).toBeUndefined();
            });
          });
        });
      });
    });
  });
});
