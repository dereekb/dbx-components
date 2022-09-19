import { MailgunService, MailgunTemplateEmailRequest } from '@dereekb/nestjs/mailgun';
import { AbstractFirebaseServerNewUserService, FirebaseServerAuthContext, FirebaseServerAuthNewUserSetupDetails, FirebaseServerAuthService, FirebaseServerAuthUserContext } from '@dereekb/firebase-server';

/**
 * MailgunTemplateEmailRequest for AbstractMailgunContentFirebaseServerNewUserService.
 *
 * Omits the "to" input since it gets configured by the input.
 */
export type NewUserMailgunContentRequest = Omit<MailgunTemplateEmailRequest, 'to'>;

/**
 * Abstract FirebaseServerNewUserService implementation that sends an email to a template on Mailgun.
 */
export abstract class AbstractMailgunContentFirebaseServerNewUserService<U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext, C extends FirebaseServerAuthContext = FirebaseServerAuthContext, D extends unknown = unknown> extends AbstractFirebaseServerNewUserService<U, C, D> {
  constructor(authService: FirebaseServerAuthService<U, C>, readonly mailgunService: MailgunService) {
    super(authService);
  }

  protected async sendSetupContentToUser(user: FirebaseServerAuthNewUserSetupDetails<U, D>): Promise<void> {
    const userRecord = await user.userContext.loadRecord();
    const { setupPassword } = user.claims;
    const { uid, displayName, email } = userRecord;

    if (!email) {
      throw new Error(`Email is not present/available for the user record "${userRecord.uid}"`);
    }

    const baseRequest = await this.buildNewUserMailgunContentRequest(user);
    await this.mailgunService.sendTemplateEmail({
      ...baseRequest,
      to: {
        email,
        userVariables: {
          uid,
          displayName,
          setupPassword
        }
      },
      sendTestEmails: user.sendDetailsInTestEnvironment || undefined
    });
  }

  protected abstract buildNewUserMailgunContentRequest(user: FirebaseServerAuthNewUserSetupDetails<U, D>): Promise<NewUserMailgunContentRequest>;
}
