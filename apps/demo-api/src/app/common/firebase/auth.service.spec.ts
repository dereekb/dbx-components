import { type DemoApiAuthClaims } from 'demo-firebase';
import { demoApiFunctionContextFactory, demoAuthorizedUserContext } from './../../../test/fixture';
import { type DemoApiFirebaseServerAuthUserContext } from './auth.service';

demoApiFunctionContextFactory((f) => {
  it('should', () => {
    console.log('hello');
  });
});
