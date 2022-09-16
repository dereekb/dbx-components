import Mailgun from 'mailgun.js';

export type MailgunClient = ReturnType<Mailgun['client']>;
export type MailgunMessagesClient = ReturnType<Mailgun['client']>['messages'];
