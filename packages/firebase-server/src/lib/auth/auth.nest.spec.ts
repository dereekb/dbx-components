import { Injectable, Module } from '@nestjs/common';
import { firebaseAdminFunctionNestContextFactory } from '../../test/firebase/firebase.admin.nest.function';
import { initFirebaseServerAdminTestEnvironment } from '../../test/firebase/firebase.admin.test.server';
import { AbstractFirebaseServerAuthContext, AbstractFirebaseServerAuthService, AbstractFirebaseServerAuthUserContext } from './auth.service';
import { AuthClaims, authRoleClaimsService, AuthRoleSet, AUTH_ADMIN_ROLE } from '@dereekb/util';
import { CallableContextWithAuthData } from '../function/context';

export class TestFirebaseServerAuthUserContext extends AbstractFirebaseServerAuthUserContext<TestAuthService> { }
export class TestFirebaseServerAuthContext extends AbstractFirebaseServerAuthContext<TestFirebaseServerAuthContext, TestFirebaseServerAuthUserContext, TestAuthService>  { }
export class TestAuthService extends AbstractFirebaseServerAuthService<TestFirebaseServerAuthUserContext, TestFirebaseServerAuthContext> {

  static readonly ROLES_FACTORY = authRoleClaimsService({
    'a': { role: [AUTH_ADMIN_ROLE] }
  });

  protected _context(context: CallableContextWithAuthData): TestFirebaseServerAuthContext {
    return new TestFirebaseServerAuthContext(this, context);
  }

  userContext(uid: string): TestFirebaseServerAuthUserContext {
    return new TestFirebaseServerAuthUserContext(this, uid);
  }

  readRoles(claims: AuthClaims): AuthRoleSet {
    return TestAuthService.ROLES_FACTORY.toRoles(claims);
  }

  claimsForRoles(roles: AuthRoleSet): AuthClaims {
    return TestAuthService.ROLES_FACTORY.toClaims(roles);
  }

}


@Injectable()
export class TestInjectable { }

@Module({
  providers: [{
    provide: TestInjectable,
    useFactory: () => new TestInjectable()
  }]
})
export class TestAppModule { }

/**
 * Test context factory that will automatically instantiate TestAppModule for each test, and make it available.
 */
export const firebaseAdminFunctionNestContext = firebaseAdminFunctionNestContextFactory({ nestModules: TestAppModule });

describe('firebase server auth', () => {

  initFirebaseServerAdminTestEnvironment();

  firebaseAdminFunctionNestContext((f) => {

  });

});
