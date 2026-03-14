import { type MailgunRecipient, type MailgunService, type MailgunTemplateEmailRequest } from '@dereekb/nestjs/mailgun';
import { AbstractFirebaseServerNewUserService, type FirebaseServerAuthContext, type FirebaseServerAuthNewUserSetupDetails, type FirebaseServerAuthService, type FirebaseServerAuthUserContext } from '@dereekb/firebase-server';

/**
 * Partial {@link MailgunTemplateEmailRequest} for {@link AbstractMailgunContentFirebaseServerNewUserService}.
 *
 * The `to` field is omitted because the new user's email and details are automatically
 * configured from the Firebase Auth user record during `sendSetupContentToUser`.
 */
export interface NewUserMailgunContentRequest extends Omit<MailgunTemplateEmailRequest, 'to'> {
  to?: Partial<Omit<MailgunRecipient, 'email'>>;
}

/**
 * Abstract {@link FirebaseServerNewUserService} implementation that sends a welcome/setup email
 * to newly created users via Mailgun templates.
 *
 * Subclasses implement `buildNewUserMailgunContentRequest` to define the template, subject,
 * and any custom variables. The user's email, display name, UID, and setup password are
 * automatically injected as Mailgun user variables.
 *
 * @example
 * ```ts
 * class WelcomeEmailService extends AbstractMailgunContentFirebaseServerNewUserService {
 *   protected async buildNewUserMailgunContentRequest(user) {
 *     return {
 *       template: 'welcome',
 *       subject: 'Welcome!',
 *       from: 'noreply@example.com'
 *     };
 *   }
 * }
 * ```
 */
export abstract class AbstractMailgunContentFirebaseServerNewUserService<U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext, C extends FirebaseServerAuthContext = FirebaseServerAuthContext, D = unknown> extends AbstractFirebaseServerNewUserService<U, C, D> {
  constructor(
    authService: FirebaseServerAuthService<U, C>,
    readonly mailgunService: MailgunService
  ) {
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
      batchSend: false, // do not use batch sending by default, as we should only be sending to one user
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
