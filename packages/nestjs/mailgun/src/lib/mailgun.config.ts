import { type EmailParticipantString, type WebsiteUrl } from '@dereekb/util';
import { type MailgunSenderDomainString } from './mailgun';
import { type MailgunOptions } from './mailgun.type';

export abstract class MailgunServiceConfig {
  // Mailgun Config
  readonly mailgun!: MailgunOptions;

  /**
   * Base URL to the client.
   */
  readonly clientUrl!: WebsiteUrl;

  /**
   * Main domain to send emails from.
   */
  readonly domain!: MailgunSenderDomainString;

  /**
   * Mailgun sender string.
   */
  readonly sender!: EmailParticipantString;

  /**
   * Additional messages config
   */
  readonly messages!: {
    /**
     * Whether or not to send test emails to Mailgun. Defaults to false.
     *
     * NOTE: Mailgun charges for any sent testmode emails to non-sandbox domains.
     */
    readonly sendTestEmails?: boolean;
    /**
     * Global recipient variable prefix to use in emails. Adds each recipient variable to the template variables list with the given prefix.
     *
     * If false, the recipient variables are not added to the variables list.
     */
    readonly recipientVariablePrefix?: string | false;
  };

  static assertValidConfig(config: MailgunServiceConfig) {
    if (!config.mailgun.username) {
      throw new Error('No mailgun username specified.');
    } else if (!config.mailgun.key) {
      throw new Error('No mailgun key specified.');
    } else if (!config.domain) {
      throw new Error('No mailgun domain specified.');
    } else if (!config.clientUrl) {
      throw new Error('No client url specified.');
    } else if (!config.sender) {
      throw new Error('No mailgun sender specified.');
    } else if (!config.messages) {
      throw new Error('No mailgun messages config specified.');
    }
  }
}
