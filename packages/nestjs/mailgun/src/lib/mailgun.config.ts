import { EmailParticipantString } from '@dereekb/util';
import { MailgunSenderDomainString } from './mailgun';
import { MailgunOptions } from './mailgun.type';

export abstract class MailgunServiceConfig {
  // Mailgun Config
  mailgun!: MailgunOptions;

  /**
   * Main domain to send emails from.
   */
  domain!: MailgunSenderDomainString;

  /**
   * Mailgun sender string.
   */
  sender!: EmailParticipantString;

  /**
   * Additional messages config
   */
  messages!: {
    /**
     * Whether or not to send test emails to Mailgun. Defaults to false.
     *
     * NOTE: Mailgun charges for any sent testmode emails to non-sandbox domains.
     */
    sendTestEmails?: boolean;
    /**
     * Global recipient variable prefix to use in emails. Adds each recipient variable to the template variables list with the given prefix.
     *
     * If false, the recipient variables are not added to the variables list.
     */
    recipientVariablePrefix?: string | false;
  };

  static assertValidConfig(config: MailgunServiceConfig) {
    if (!config.mailgun.username) {
      throw new Error('No mailgun username specified.');
    } else if (!config.mailgun.key) {
      throw new Error('No mailgun key specified.');
    } else if (!config.domain) {
      throw new Error('No mailgun domain specified.');
    } else if (!config.sender) {
      throw new Error('No mailgun sender specified.');
    } else if (!config.messages) {
      throw new Error('No mailgun messages config specified.');
    }
  }
}
