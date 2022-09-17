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
