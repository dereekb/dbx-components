import type Mailgun from 'mailgun.js';
import { type MailgunClientOptions } from 'node_modules/mailgun.js/Types/Types/MailgunClient/MailgunClientOptions';

export type MailgunOptions = MailgunClientOptions;
export type MailgunClient = ReturnType<Mailgun['client']>;
export type MailgunMessagesClient = ReturnType<Mailgun['client']>['messages'];
