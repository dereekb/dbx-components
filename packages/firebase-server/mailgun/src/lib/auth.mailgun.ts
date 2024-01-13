import { type MailgunRecipient, type MailgunService, type MailgunTemplateEmailRequest } from '@dereekb/nestjs/mailgun';
import { AbstractFirebaseServerNewUserService, type FirebaseServerAuthContext, type FirebaseServerAuthNewUserSetupDetails, type FirebaseServerAuthService, type FirebaseServerAuthUserContext } from '@dereekb/firebase-server';

/**
 * MailgunTemplateEmailRequest for AbstractMailgunContentFirebaseServerNewUserService.
 *
 * Omits the "to" input since it gets configured by the input.
 */
export interface NewUserMailgunContentRequest extends Omit<MailgunTemplateEmailRequest, 'to'> {
  to?: Partial<Omit<MailgunRecipient, 'email'>>;
}

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
    const baseRequestTo = baseRequest.to;

    await this.mailgunService.sendTemplateEmail({
      ...baseRequest,
      to: {
        name: baseRequestTo?.name,
        email,
        userVariables: {
          setupPassword,
          ...baseRequestTo?.userVariables,
          displayName,
          uid
        }
      },
      sendTestEmails: baseRequest.sendTestEmails || user.sendDetailsInTestEnvironment || undefined
    });
  }

  protected abstract buildNewUserMailgunContentRequest(user: FirebaseServerAuthNewUserSetupDetails<U, D>): Promise<NewUserMailgunContentRequest>;
}
