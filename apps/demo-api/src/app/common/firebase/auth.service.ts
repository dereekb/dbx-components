import { DEMO_AUTH_CLAIMS_SERVICE } from 'demo-firebase';
import { type CallableContextWithAuthData, AbstractFirebaseServerAuthContext, AbstractFirebaseServerAuthService, AbstractFirebaseServerAuthUserContext, type FirebaseServerAuthNewUserSetupDetails, type FirebaseServerAuthPasswordResetDetails, type FirebaseServerNewUserService, type FirebaseServerUserPasswordResetService } from '@dereekb/firebase-server';
import { type AuthClaims, type AuthClaimsUpdate, type AuthRoleSet } from '@dereekb/util';
import { type MailgunService } from '@dereekb/nestjs/mailgun';
import type * as admin from 'firebase-admin';
import { AbstractMailgunContentFirebaseServerNewUserService, AbstractMailgunContentFirebaseServerUserPasswordResetService, type NewUserMailgunContentRequest, type ResetPasswordMailgunContentRequest } from '@dereekb/firebase-server/mailgun';

export class DemoApiFirebaseServerAuthUserContext extends AbstractFirebaseServerAuthUserContext<DemoApiAuthService> {}

export class DemoApiFirebaseServerAuthContext extends AbstractFirebaseServerAuthContext<DemoApiFirebaseServerAuthContext, DemoApiFirebaseServerAuthUserContext, DemoApiAuthService> {}

export class DemoApiFirebaseServerNewUserService extends AbstractMailgunContentFirebaseServerNewUserService<DemoApiFirebaseServerAuthUserContext> {
  protected async buildNewUserMailgunContentRequest(_user: FirebaseServerAuthNewUserSetupDetails<DemoApiFirebaseServerAuthUserContext>): Promise<NewUserMailgunContentRequest> {
    const request: NewUserMailgunContentRequest = {
      subject: 'Invite to dbx-components Demo',
      template: 'invite'
    };
    return request;
  }
}

export class DemoApiFirebaseServerUserPasswordResetService extends AbstractMailgunContentFirebaseServerUserPasswordResetService<DemoApiFirebaseServerAuthUserContext> {
  protected async buildPasswordResetMailgunContentRequest(details: FirebaseServerAuthPasswordResetDetails<DemoApiFirebaseServerAuthUserContext>): Promise<ResetPasswordMailgunContentRequest> {
    const { resetPassword } = details.claims;
    const request: ResetPasswordMailgunContentRequest = {
      subject: 'Password Reset - dbx-components Demo',
      template: 'password-reset',
      templateVariables: {
        resetCode: resetPassword
      }
    };
    return request;
  }
}

export class DemoApiAuthService extends AbstractFirebaseServerAuthService<DemoApiFirebaseServerAuthUserContext, DemoApiFirebaseServerAuthContext> {
  constructor(
    auth: admin.auth.Auth,
    readonly mailgunService: MailgunService
  ) {
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

  override passwordReset(): FirebaseServerUserPasswordResetService {
    return new DemoApiFirebaseServerUserPasswordResetService(this, this.mailgunService);
  }
}
