import { MailgunService, MailgunTemplateEmailRequest } from '@dereekb/nestjs/mailgun';
import { AbstractFirebaseServerNewUserService, FirebaseServerAuthNewUserSetupDetails, FirebaseServerAuthService, FirebaseServerAuthUserContext } from '@dereekb/firebase-server';

/**
 * MailgunTemplateEmailRequest for AbstractMailgunContentFirebaseServerNewUserService.
 *
 * Omits the "to" input since it gets configured by the input.
 */
export type NewUserMailgunContentRequest = Omit<MailgunTemplateEmailRequest, 'to'>;

/**
 * Abstract FirebaseServerNewUserService implementation that sends an email to a template on Mailgun.
 */
export abstract class AbstractMailgunContentFirebaseServerNewUserService<U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext> extends AbstractFirebaseServerNewUserService<U> {
  constructor(authService: FirebaseServerAuthService<U>, readonly mailgunService: MailgunService) {
    super(authService);
  }

  protected async sendSetupContentToUser(user: FirebaseServerAuthNewUserSetupDetails<U>): Promise<void> {
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
      }
    });
  }

  protected abstract buildNewUserMailgunContentRequest(user: FirebaseServerAuthNewUserSetupDetails<U>): Promise<NewUserMailgunContentRequest>;
}
