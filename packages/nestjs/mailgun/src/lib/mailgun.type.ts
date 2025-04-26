import Mailgun from 'mailgun.js';
import { MailgunClientOptions } from 'mailgun.js/Types/MailgunClient/MailgunClientOptions';

export type MailgunOptions = MailgunClientOptions;
export type MailgunClient = ReturnType<Mailgun['client']>;
export type MailgunMessagesClient = ReturnType<Mailgun['client']>['messages'];
