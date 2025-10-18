import { type DemoApiAuthClaims } from 'demo-firebase';
import { demoApiFunctionContextFactory, demoAuthorizedUserContext } from './../../../test/fixture';
import { type DemoApiFirebaseServerAuthUserContext } from './auth.service';

demoApiFunctionContextFactory((f) => {
  demoAuthorizedUserContext({ f }, (u) => {
    describe('DemoApiFirebaseServerAuthUserContext', () => {
      let userContext: DemoApiFirebaseServerAuthUserContext;

      beforeEach(async () => {
        const context = f.instance.apiNestContext;
        userContext = context.authService.userContext(u.uid);
      });

      describe('loadClaims', () => {
        it('should load the claims', async () => {
          const claims = await userContext.loadClaims<DemoApiAuthClaims>();
          expect(claims).toBeDefined();
        });
      });
    });
  });
});
