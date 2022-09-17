import Mailgun from 'mailgun.js';
import Options from 'mailgun.js/interfaces/Options';

export type MailgunOptions = Options;
export type MailgunClient = ReturnType<Mailgun['client']>;
export type MailgunMessagesClient = ReturnType<Mailgun['client']>['messages'];
