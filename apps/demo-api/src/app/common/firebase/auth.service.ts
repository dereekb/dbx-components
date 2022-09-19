import { DEMO_AUTH_CLAIMS_SERVICE } from '@dereekb/demo-firebase';
import { CallableContextWithAuthData, AbstractFirebaseServerAuthContext, AbstractFirebaseServerAuthService, AbstractFirebaseServerAuthUserContext, FirebaseServerAuthNewUserSetupDetails, FirebaseServerNewUserService } from '@dereekb/firebase-server';
import { AuthClaims, AuthClaimsUpdate, AuthRoleSet } from '@dereekb/util';
import { MailgunService } from '@dereekb/nestjs/mailgun';
import * as admin from 'firebase-admin';
import { AbstractMailgunContentFirebaseServerNewUserService, NewUserMailgunContentRequest } from '@dereekb/firebase-server/mailgun';

export class DemoApiFirebaseServerAuthUserContext extends AbstractFirebaseServerAuthUserContext<DemoApiAuthService> {}

export class DemoApiFirebaseServerAuthContext extends AbstractFirebaseServerAuthContext<DemoApiFirebaseServerAuthContext, DemoApiFirebaseServerAuthUserContext, DemoApiAuthService> {}

export class DemoApiFirebaseServerNewUserService extends AbstractMailgunContentFirebaseServerNewUserService<DemoApiFirebaseServerAuthUserContext> {
  protected async buildNewUserMailgunContentRequest(user: FirebaseServerAuthNewUserSetupDetails<DemoApiFirebaseServerAuthUserContext>): Promise<NewUserMailgunContentRequest> {
    const request: NewUserMailgunContentRequest = {
      subject: 'Invite to dbx-components Demo',
      template: 'invite'
    };
    return request;
  }
}

export class DemoApiAuthService extends AbstractFirebaseServerAuthService<DemoApiFirebaseServerAuthUserContext, DemoApiFirebaseServerAuthContext> {
  constructor(auth: admin.auth.Auth, readonly mailgunService: MailgunService) {
    super(auth);
  }

  protected _context(context: CallableContextWithAuthData): DemoApiFirebaseServerAuthContext {
    return new DemoApiFirebaseServerAuthContext(this, context);
  }

  userContext(uid: string): DemoApiFirebaseServerAuthUserContext {
    return new DemoApiFirebaseServerAuthUserContext(this, uid);
  }

  readRoles(claims: AuthClaims): AuthRoleSet {
    return DEMO_AUTH_CLAIMS_SERVICE.toRoles(claims);
  }

  claimsForRoles(roles: AuthRoleSet): AuthClaimsUpdate {
    return DEMO_AUTH_CLAIMS_SERVICE.toClaims(roles);
  }

  override newUser(): FirebaseServerNewUserService {
    return new DemoApiFirebaseServerNewUserService(this, this.mailgunService);
  }
}
