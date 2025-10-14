import { APP_CODE_PREFIX_CAPS_AUTH_CLAIMS_SERVICE } from 'FIREBASE_COMPONENTS_NAME';
import { CallableContextWithAuthData, AbstractFirebaseServerAuthContext, AbstractFirebaseServerAuthService, AbstractFirebaseServerAuthUserContext, FirebaseServerAuthNewUserSetupDetails, FirebaseServerNewUserService } from '@dereekb/firebase-server';
import { AuthClaims, AuthClaimsUpdate, AuthRoleSet } from '@dereekb/util';
import { MailgunService } from '@dereekb/nestjs/mailgun';
import * as admin from 'firebase-admin';
import { AbstractMailgunContentFirebaseServerNewUserService, NewUserMailgunContentRequest } from '@dereekb/firebase-server/mailgun';

export class APP_CODE_PREFIXApiFirebaseServerAuthUserContext extends AbstractFirebaseServerAuthUserContext<APP_CODE_PREFIXApiAuthService> {

}

export class APP_CODE_PREFIXApiFirebaseServerAuthContext extends AbstractFirebaseServerAuthContext<APP_CODE_PREFIXApiFirebaseServerAuthContext, APP_CODE_PREFIXApiFirebaseServerAuthUserContext, APP_CODE_PREFIXApiAuthService>  {

}

export class APP_CODE_PREFIXApiFirebaseServerNewUserService extends AbstractMailgunContentFirebaseServerNewUserService<APP_CODE_PREFIXApiFirebaseServerAuthUserContext> {
  protected async buildNewUserMailgunContentRequest(user: FirebaseServerAuthNewUserSetupDetails<APP_CODE_PREFIXApiFirebaseServerAuthUserContext>): Promise<NewUserMailgunContentRequest> {
    const request: NewUserMailgunContentRequest = {
      subject: 'Invite to APP_CODE_PREFIX_LOWER',    // TODO: Update this subject!
      template: 'invite'  // TODO: Configure this template in mailgun!
    };
    return request;
  }
}

export class APP_CODE_PREFIXApiAuthService extends AbstractFirebaseServerAuthService<APP_CODE_PREFIXApiFirebaseServerAuthUserContext, APP_CODE_PREFIXApiFirebaseServerAuthContext> {
  
  constructor(auth: admin.auth.Auth, readonly mailgunService: MailgunService) {
    super(auth);
  }

  protected _context(context: CallableContextWithAuthData): APP_CODE_PREFIXApiFirebaseServerAuthContext {
    return new APP_CODE_PREFIXApiFirebaseServerAuthContext(this, context);
  }

  userContext(uid: string): APP_CODE_PREFIXApiFirebaseServerAuthUserContext {
    return new APP_CODE_PREFIXApiFirebaseServerAuthUserContext(this, uid);
  }

  readRoles(claims: AuthClaims): AuthRoleSet {
    return APP_CODE_PREFIX_CAPS_AUTH_CLAIMS_SERVICE.toRoles(claims);
  }

  claimsForRoles(roles: AuthRoleSet): AuthClaimsUpdate {
    return APP_CODE_PREFIX_CAPS_AUTH_CLAIMS_SERVICE.toClaims(roles);
  }

  override newUser(): FirebaseServerNewUserService {
    return new APP_CODE_PREFIXApiFirebaseServerNewUserService(this, this.mailgunService);
  }

}
