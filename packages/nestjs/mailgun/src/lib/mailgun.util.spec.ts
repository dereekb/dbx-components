import { convertMailgunTemplateEmailRequestToMailgunMessageData, convertMailgunRecipientsToStrings, DEFAULT_RECIPIENT_VARIABLE_PREFIX } from './mailgun';
import { MAILGUN_BATCH_SEND_RECIPIENT_SUBJECT_TEMPLATE, expandMailgunRecipientBatchSendTargetRequestFactory, type MailgunRecipientBatchSendTarget , notificationMessageEntityKeyRecipientLookup, type NotificationMessageEntityKeyRecipientLookup } from './mailgun.util';

const senderEmail = 'sender@dereekb.com';
const replyToEmail = 'test.support@dereekb.com';
const testEmail = 'test.components@dereekb.com';
const testEmail2 = 'test2.components@dereekb.com';
const testEmail3 = 'test3.components@dereekb.com';
const templateName = 'test';

// provided in Environment Variables
// const apiKey = process.env['MAILGUN_SANDBOX_API_KEY'] as string;
// const domain = process.env['MAILGUN_SANDBOX_DOMAIN'] as string;

describe('expandMailgunRecipientBatchSendTargetRequestFactory()', () => {
  describe('instance', () => {
    describe('single recipient', () => {
      it('should build the request properly', () => {
        const baseRequest = {
          subject: 'Should Be Ignored',
          from: {
            email: senderEmail
          },
          replyTo: {
            email: replyToEmail
          },
          template: 'actiontemplate',
          templateVariables: {
            prompt: 'Reset Your Password Request - 337772',
            notkept: null,
            date: new Date()
          }
        };

        const TEST_SUBJECT = 'test subject';

        const line1 = 'A password reset was requested. Log into Dbx Components with the following temporary password to begin password reset.';
        const line2 = '337772';
        const text = 'Log Into Dbx Components';
        const url = 'https://components.dereekb.com/auth/login';
        const title = 'Reset Your Password Request - 337772';
        const object = {
          a: 'b'
        };

        const recipient: MailgunRecipientBatchSendTarget = {
          email: testEmail,
          name: 'Test',
          userVariables: {
            subject: TEST_SUBJECT,
            line1,
            line2,
            text,
            url,
            title,
            object
          }
        };

        const factory = expandMailgunRecipientBatchSendTargetRequestFactory({
          request: baseRequest,
          useSubjectFromRecipientUserVariables: true // pull subject from recipients
        });

        const requests = factory([recipient]);
        expect(requests.length).toBe(1);

        const request = requests[0];
        expect(request.subject).toBe(TEST_SUBJECT); // should get pulled from the recipient
        expect(request.batchSend).toBe(false); // batch send is disabled if there is only one recipient

        const recipientVariablePrefix = DEFAULT_RECIPIENT_VARIABLE_PREFIX;
        const result = convertMailgunTemplateEmailRequestToMailgunMessageData({
          request
          // recipientVariablePrefix   // NOTE: Does not need to be explicity set; the default is used
        });
        expect(result['recipient-variables']).toBeUndefined(); // not set when batch sending is disabled

        const { from, to, cc, bcc } = result;

        expect(from).toBe(convertMailgunRecipientsToStrings([{ email: senderEmail }])[0]);
        expect(to).toEqual(convertMailgunRecipientsToStrings([recipient]));
        expect(cc).toBeUndefined();
        expect(bcc).toBeUndefined();

        expect(result.subject).toBe(TEST_SUBJECT);

        const line1Variable = result[`v:${recipientVariablePrefix}line1`];
        expect(line1Variable).toBe(line1);

        const line2Variable = result[`v:${recipientVariablePrefix}line2`];
        expect(line2Variable).toBe(line2);

        const textVariable = result[`v:${recipientVariablePrefix}text`];
        expect(textVariable).toBe(text);

        const urlVariable = result[`v:${recipientVariablePrefix}url`];
        expect(urlVariable).toBe(url);

        const titleVariable = result[`v:${recipientVariablePrefix}title`];
        expect(titleVariable).toBe(title);

        const objectVariable = result[`v:${recipientVariablePrefix}object`];
        expect(objectVariable).toBe(JSON.stringify(object));
      });

      it('should build the request properly with an empty cc', () => {
        const baseRequest = {
          subject: 'Should Be Ignored',
          from: {
            email: senderEmail
          },
          replyTo: {
            email: replyToEmail
          },
          cc: [],
          template: 'actiontemplate',
          templateVariables: {
            prompt: 'Reset Your Password Request - 337772',
            notkept: null,
            date: new Date()
          }
        };

        const TEST_SUBJECT = 'test subject';

        const line1 = 'A password reset was requested. Log into Dbx Components with the following temporary password to begin password reset.';
        const line2 = '337772';
        const text = 'Log Into Dbx Components';
        const url = 'https://components.dereekb.com/auth/login';
        const title = 'Reset Your Password Request - 337772';
        const object = {
          a: 'b'
        };

        const recipient: MailgunRecipientBatchSendTarget = {
          email: testEmail,
          name: 'Test',
          cc: [],
          userVariables: {
            subject: TEST_SUBJECT,
            line1,
            line2,
            text,
            url,
            title,
            object
          }
        };

        const factory = expandMailgunRecipientBatchSendTargetRequestFactory({
          request: baseRequest,
          useSubjectFromRecipientUserVariables: true // pull subject from recipients
        });

        const requests = factory([recipient]);
        expect(requests.length).toBe(1);

        const request = requests[0];
        expect(request.subject).toBe(TEST_SUBJECT); // should get pulled from the recipient
        expect(request.batchSend).toBe(false); // batch send is disabled if there is only one recipient

        const recipientVariablePrefix = DEFAULT_RECIPIENT_VARIABLE_PREFIX; // NOTE: Does not need to be explicity set; the default is used
        const result = convertMailgunTemplateEmailRequestToMailgunMessageData({
          request,
          recipientVariablePrefix
        });
        expect(result['recipient-variables']).toBeUndefined(); // not set when batch sending is disabled

        const { from, to, cc, bcc } = result;

        expect(from).toBe(convertMailgunRecipientsToStrings([{ email: senderEmail }])[0]);
        expect(to).toEqual(convertMailgunRecipientsToStrings([recipient]));
        expect(cc).toBeUndefined();
        expect(bcc).toBeUndefined();

        expect(result.subject).toBe(TEST_SUBJECT);

        const line1Variable = result[`v:${recipientVariablePrefix}line1`];
        expect(line1Variable).toBe(line1);

        const line2Variable = result[`v:${recipientVariablePrefix}line2`];
        expect(line2Variable).toBe(line2);

        const textVariable = result[`v:${recipientVariablePrefix}text`];
        expect(textVariable).toBe(text);

        const urlVariable = result[`v:${recipientVariablePrefix}url`];
        expect(urlVariable).toBe(url);

        const titleVariable = result[`v:${recipientVariablePrefix}title`];
        expect(titleVariable).toBe(title);

        const objectVariable = result[`v:${recipientVariablePrefix}object`];
        expect(objectVariable).toBe(JSON.stringify(object));
      });

      it('should build the request properly with an empty bcc', () => {
        const baseRequest = {
          subject: 'Should Be Ignored',
          from: {
            email: senderEmail
          },
          replyTo: {
            email: replyToEmail
          },
          bcc: [],
          template: 'actiontemplate',
          templateVariables: {
            prompt: 'Reset Your Password Request - 337772',
            notkept: null,
            date: new Date()
          }
        };

        const TEST_SUBJECT = 'test subject';

        const line1 = 'A password reset was requested. Log into Dbx Components with the following temporary password to begin password reset.';
        const line2 = '337772';
        const text = 'Log Into Dbx Components';
        const url = 'https://components.dereekb.com/auth/login';
        const title = 'Reset Your Password Request - 337772';
        const object = {
          a: 'b'
        };

        const recipient: MailgunRecipientBatchSendTarget = {
          email: testEmail,
          name: 'Test',
          bcc: [],
          userVariables: {
            subject: TEST_SUBJECT,
            line1,
            line2,
            text,
            url,
            title,
            object
          }
        };

        const factory = expandMailgunRecipientBatchSendTargetRequestFactory({
          request: baseRequest,
          useSubjectFromRecipientUserVariables: true // pull subject from recipients
        });

        const requests = factory([recipient]);
        expect(requests.length).toBe(1);

        const request = requests[0];
        expect(request.subject).toBe(TEST_SUBJECT); // should get pulled from the recipient
        expect(request.batchSend).toBe(false); // batch send is disabled if there is only one recipient

        const recipientVariablePrefix = DEFAULT_RECIPIENT_VARIABLE_PREFIX;
        const result = convertMailgunTemplateEmailRequestToMailgunMessageData({ request, recipientVariablePrefix });
        expect(result['recipient-variables']).toBeUndefined(); // not set when batch sending is disabled

        const { from, to, cc, bcc } = result;

        expect(from).toBe(convertMailgunRecipientsToStrings([{ email: senderEmail }])[0]);
        expect(to).toEqual(convertMailgunRecipientsToStrings([recipient]));
        expect(cc).toBeUndefined();
        expect(bcc).toBeUndefined();

        expect(result.subject).toBe(TEST_SUBJECT);

        const line1Variable = result[`v:${recipientVariablePrefix}line1`];
        expect(line1Variable).toBe(line1);

        const line2Variable = result[`v:${recipientVariablePrefix}line2`];
        expect(line2Variable).toBe(line2);

        const textVariable = result[`v:${recipientVariablePrefix}text`];
        expect(textVariable).toBe(text);

        const urlVariable = result[`v:${recipientVariablePrefix}url`];
        expect(urlVariable).toBe(url);

        const titleVariable = result[`v:${recipientVariablePrefix}title`];
        expect(titleVariable).toBe(title);

        const objectVariable = result[`v:${recipientVariablePrefix}object`];
        expect(objectVariable).toBe(JSON.stringify(object));
      });
    });

    describe('addCopyOfMergedRecipientVariablesWithoutPrefixToGlobalVariables=true', () => {
      it('should build the request properly and add a copy of the recipient variables to the global variables with no prefix', () => {
        const baseRequest = {
          subject: 'Should Be Ignored',
          from: {
            email: senderEmail
          },
          replyTo: {
            email: replyToEmail
          },
          template: 'actiontemplate',
          templateVariables: {
            prompt: 'Reset Your Password Request - 337772',
            notkept: null,
            date: new Date()
          }
        };

        const TEST_SUBJECT = 'test subject';

        const line1 = 'A password reset was requested. Log into Dbx Components with the following temporary password to begin password reset.';
        const line2 = '337772';
        const text = 'Log Into Dbx Components';
        const url = 'https://components.dereekb.com/auth/login';
        const title = 'Reset Your Password Request - 337772';
        const object = {
          a: 'b'
        };

        const recipient: MailgunRecipientBatchSendTarget = {
          email: testEmail,
          name: 'Test',
          userVariables: {
            subject: TEST_SUBJECT,
            line1,
            line2,
            text,
            url,
            title,
            object
          }
        };

        const factory = expandMailgunRecipientBatchSendTargetRequestFactory({
          request: baseRequest,
          useSubjectFromRecipientUserVariables: true // pull subject from recipients
        });

        const requests = factory([recipient]);
        expect(requests.length).toBe(1);

        const request = requests[0];
        expect(request.subject).toBe(TEST_SUBJECT); // should get pulled from the recipient
        expect(request.batchSend).toBe(false); // batch send is disabled if there is only one recipient

        const recipientVariablePrefix = '';
        const result = convertMailgunTemplateEmailRequestToMailgunMessageData({ request, recipientVariablePrefix, addCopyOfMergedRecipientVariablesWithoutPrefixToGlobalVariables: true });
        expect(result['recipient-variables']).toBeUndefined(); // not set when batch sending is disabled

        const { from, to, cc, bcc } = result;

        expect(from).toBe(convertMailgunRecipientsToStrings([{ email: senderEmail }])[0]);
        expect(to).toEqual(convertMailgunRecipientsToStrings([recipient]));
        expect(cc).toBeUndefined();
        expect(bcc).toBeUndefined();

        expect(result.subject).toBe(TEST_SUBJECT);

        const line1Variable = result[`v:${recipientVariablePrefix}line1`];
        expect(line1Variable).toBe(line1);

        const line1GlobalVariable = result[`v:line1`];
        expect(line1GlobalVariable).toBe(line1);

        const line2Variable = result[`v:${recipientVariablePrefix}line2`];
        expect(line2Variable).toBe(line2);

        const line2GlobalVariable = result[`v:line2`];
        expect(line2GlobalVariable).toBe(line2);

        const textVariable = result[`v:${recipientVariablePrefix}text`];
        expect(textVariable).toBe(text);

        const textGlobalVariable = result[`v:text`];
        expect(textGlobalVariable).toBe(text);

        const urlVariable = result[`v:${recipientVariablePrefix}url`];
        expect(urlVariable).toBe(url);

        const urlGlobalVariable = result[`v:url`];
        expect(urlGlobalVariable).toBe(url);

        const titleVariable = result[`v:${recipientVariablePrefix}title`];
        expect(titleVariable).toBe(title);

        const titleGlobalVariable = result[`v:title`];
        expect(titleGlobalVariable).toBe(title);

        const objectVariable = result[`v:${recipientVariablePrefix}object`];
        expect(objectVariable).toBe(JSON.stringify(object));

        const objectGlobalVariable = result[`v:object`];
        expect(objectGlobalVariable).toBe(JSON.stringify(object));
      });
    });

    describe('no recipient prefix', () => {
      it('should build the request properly without the recipient prefix added if recipientVariablePrefix is false', () => {
        const baseRequest = {
          subject: 'Should Be Ignored',
          from: {
            email: senderEmail
          },
          replyTo: {
            email: replyToEmail
          },
          template: 'actiontemplate',
          templateVariables: {
            prompt: 'Reset Your Password Request - 337772',
            notkept: null,
            date: new Date()
          }
        };

        const TEST_SUBJECT = 'test subject';

        const line1 = 'A password reset was requested. Log into Dbx Components with the following temporary password to begin password reset.';
        const line2 = '337772';
        const text = 'Log Into Dbx Components';
        const url = 'https://components.dereekb.com/auth/login';
        const title = 'Reset Your Password Request - 337772';
        const object = {
          a: 'b'
        };

        const recipient: MailgunRecipientBatchSendTarget = {
          email: testEmail,
          name: 'Test',
          userVariables: {
            subject: TEST_SUBJECT,
            line1,
            line2,
            text,
            url,
            title,
            object
          }
        };

        const factory = expandMailgunRecipientBatchSendTargetRequestFactory({
          request: baseRequest,
          useSubjectFromRecipientUserVariables: true // pull subject from recipients
        });

        const requests = factory([recipient]);
        expect(requests.length).toBe(1);

        const request = requests[0];
        expect(request.subject).toBe(TEST_SUBJECT); // should get pulled from the recipient
        expect(request.batchSend).toBe(false); // batch send is disabled if there is only one recipient

        const recipientVariablePrefix = '';
        const result = convertMailgunTemplateEmailRequestToMailgunMessageData({ request, recipientVariablePrefix: false });
        expect(result['recipient-variables']).toBeUndefined(); // not set when batch sending is disabled

        const { from, to, cc, bcc } = result;

        expect(from).toBe(convertMailgunRecipientsToStrings([{ email: senderEmail }])[0]);
        expect(to).toEqual(convertMailgunRecipientsToStrings([recipient]));
        expect(cc).toBeUndefined();
        expect(bcc).toBeUndefined();

        expect(result.subject).toBe(TEST_SUBJECT);

        const line1Variable = result[`v:${recipientVariablePrefix}line1`];
        expect(line1Variable).toBe(line1);

        const line2Variable = result[`v:${recipientVariablePrefix}line2`];
        expect(line2Variable).toBe(line2);

        const textVariable = result[`v:${recipientVariablePrefix}text`];
        expect(textVariable).toBe(text);

        const urlVariable = result[`v:${recipientVariablePrefix}url`];
        expect(urlVariable).toBe(url);

        const titleVariable = result[`v:${recipientVariablePrefix}title`];
        expect(titleVariable).toBe(title);

        const objectVariable = result[`v:${recipientVariablePrefix}object`];
        expect(objectVariable).toBe(JSON.stringify(object));
      });

      it('should build the request properly without the recipient prefix added if recipientVariablePrefix is false in the request', () => {
        const baseRequest = {
          subject: 'Should Be Ignored',
          from: {
            email: senderEmail
          },
          replyTo: {
            email: replyToEmail
          },
          template: 'actiontemplate',
          templateVariables: {
            prompt: 'Reset Your Password Request - 337772',
            notkept: null,
            date: new Date()
          }
        };

        const TEST_SUBJECT = 'test subject';

        const line1 = 'A password reset was requested. Log into Dbx Components with the following temporary password to begin password reset.';
        const line2 = '337772';
        const text = 'Log Into Dbx Components';
        const url = 'https://components.dereekb.com/auth/login';
        const title = 'Reset Your Password Request - 337772';
        const object = {
          a: 'b'
        };

        const recipient: MailgunRecipientBatchSendTarget = {
          email: testEmail,
          name: 'Test',
          userVariables: {
            subject: TEST_SUBJECT,
            line1,
            line2,
            text,
            url,
            title,
            object
          }
        };

        const recipientVariablePrefix = ''; // effective prefix
        const factory = expandMailgunRecipientBatchSendTargetRequestFactory({
          request: baseRequest,
          useSubjectFromRecipientUserVariables: true, // pull subject from recipients
          recipientVariablesConfig: {
            recipientVariablePrefix: false
          }
        });

        const requests = factory([recipient]);
        expect(requests.length).toBe(1);

        const request = requests[0];
        expect(request.subject).toBe(TEST_SUBJECT); // should get pulled from the recipient
        expect(request.batchSend).toBe(false); // batch send is disabled if there is only one recipient
        expect(request.recipientVariablesConfig).toBeDefined();
        expect(request.recipientVariablesConfig?.recipientVariablePrefix).toBe(false);

        const result = convertMailgunTemplateEmailRequestToMailgunMessageData({ request });
        expect(result['recipient-variables']).toBeUndefined(); // not set when batch sending is disabled

        const { from, to, cc, bcc } = result;

        expect(from).toBe(convertMailgunRecipientsToStrings([{ email: senderEmail }])[0]);
        expect(to).toEqual(convertMailgunRecipientsToStrings([recipient]));
        expect(cc).toBeUndefined();
        expect(bcc).toBeUndefined();

        expect(result.subject).toBe(TEST_SUBJECT);

        const line1Variable = result[`v:${recipientVariablePrefix}line1`];
        expect(line1Variable).toBe(line1);

        const line2Variable = result[`v:${recipientVariablePrefix}line2`];
        expect(line2Variable).toBe(line2);

        const textVariable = result[`v:${recipientVariablePrefix}text`];
        expect(textVariable).toBe(text);

        const urlVariable = result[`v:${recipientVariablePrefix}url`];
        expect(urlVariable).toBe(url);

        const titleVariable = result[`v:${recipientVariablePrefix}title`];
        expect(titleVariable).toBe(title);

        const objectVariable = result[`v:${recipientVariablePrefix}object`];
        expect(objectVariable).toBe(JSON.stringify(object));
      });

      it('should build the request properly without the recipient prefix added if recipientVariablePrefix is an empty string', () => {
        const baseRequest = {
          subject: 'Should Be Ignored',
          from: {
            email: senderEmail
          },
          replyTo: {
            email: replyToEmail
          },
          template: 'actiontemplate',
          templateVariables: {
            prompt: 'Reset Your Password Request - 337772',
            notkept: null,
            date: new Date()
          }
        };

        const TEST_SUBJECT = 'test subject';

        const line1 = 'A password reset was requested. Log into Dbx Components with the following temporary password to begin password reset.';
        const line2 = '337772';
        const text = 'Log Into Dbx Components';
        const url = 'https://components.dereekb.com/auth/login';
        const title = 'Reset Your Password Request - 337772';
        const object = {
          a: 'b'
        };

        const recipient: MailgunRecipientBatchSendTarget = {
          email: testEmail,
          name: 'Test',
          userVariables: {
            subject: TEST_SUBJECT,
            line1,
            line2,
            text,
            url,
            title,
            object
          }
        };

        const factory = expandMailgunRecipientBatchSendTargetRequestFactory({
          request: baseRequest,
          useSubjectFromRecipientUserVariables: true // pull subject from recipients
        });

        const requests = factory([recipient]);
        expect(requests.length).toBe(1);

        const request = requests[0];
        expect(request.subject).toBe(TEST_SUBJECT); // should get pulled from the recipient
        expect(request.batchSend).toBe(false); // batch send is disabled if there is only one recipient

        const recipientVariablePrefix = '';
        const result = convertMailgunTemplateEmailRequestToMailgunMessageData({ request, recipientVariablePrefix });
        expect(result['recipient-variables']).toBeUndefined(); // not set when batch sending is disabled

        const { from, to, cc, bcc } = result;

        expect(from).toBe(convertMailgunRecipientsToStrings([{ email: senderEmail }])[0]);
        expect(to).toEqual(convertMailgunRecipientsToStrings([recipient]));
        expect(cc).toBeUndefined();
        expect(bcc).toBeUndefined();

        expect(result.subject).toBe(TEST_SUBJECT);

        const line1Variable = result[`v:${recipientVariablePrefix}line1`];
        expect(line1Variable).toBe(line1);

        const line2Variable = result[`v:${recipientVariablePrefix}line2`];
        expect(line2Variable).toBe(line2);

        const textVariable = result[`v:${recipientVariablePrefix}text`];
        expect(textVariable).toBe(text);

        const urlVariable = result[`v:${recipientVariablePrefix}url`];
        expect(urlVariable).toBe(url);

        const titleVariable = result[`v:${recipientVariablePrefix}title`];
        expect(titleVariable).toBe(title);

        const objectVariable = result[`v:${recipientVariablePrefix}object`];
        expect(objectVariable).toBe(JSON.stringify(object));
      });
    });

    describe('allowSingleRecipientBatchSendRequests = true', () => {
      it('should build a single batch request for one recipient with no carbon copy values', () => {
        const baseRequest = {
          subject: 'Should Be Ignored',
          from: {
            email: senderEmail
          },
          replyTo: {
            email: replyToEmail
          },
          template: 'actiontemplate',
          templateVariables: {
            prompt: 'Reset Your Password Request - 337772',
            notkept: null,
            date: new Date()
          }
        };

        const TEST_SUBJECT = 'test subject';

        const line1 = 'A password reset was requested. Log into Dbx Components with the following temporary password to begin password reset.';
        const line2 = '337772';
        const text = 'Log Into Dbx Components';
        const url = 'https://components.dereekb.com/auth/login';
        const title = 'Reset Your Password Request - 337772';
        const object = {
          a: 'b'
        };

        const recipientA: MailgunRecipientBatchSendTarget = {
          email: testEmail,
          name: 'Test',
          userVariables: {
            subject: TEST_SUBJECT,
            line1,
            line2,
            text,
            url,
            title,
            object
          }
        };

        const factory = expandMailgunRecipientBatchSendTargetRequestFactory({
          request: baseRequest,
          allowSingleRecipientBatchSendRequests: true,
          useSubjectFromRecipientUserVariables: true // pull subject from recipients
        });

        const requests = factory([recipientA]);
        expect(requests.length).toBe(1); // should have only one batch request as there is no cc/bcc

        const request = requests[0];
        expect(request.subject).toBe(MAILGUN_BATCH_SEND_RECIPIENT_SUBJECT_TEMPLATE); // should get pulled from the recipient
        expect(request.batchSend).toBe(true); // batch send is enabled

        const result = convertMailgunTemplateEmailRequestToMailgunMessageData({ request });
        const { from, to, cc, bcc } = result;

        expect(from).toBe(convertMailgunRecipientsToStrings([{ email: senderEmail }])[0]);
        expect(to).toEqual(convertMailgunRecipientsToStrings([recipientA]));
        expect(cc).toBeUndefined();
        expect(bcc).toBeUndefined();

        expect(result.subject).toBe(MAILGUN_BATCH_SEND_RECIPIENT_SUBJECT_TEMPLATE);
        expect(result['recipient-variables']).toBeDefined();

        // check the recipient variable names were copied to the template variables
        const line1Variable = result['v:recipient-line1'];
        expect(line1Variable).toBe(`%recipient.line1%`);

        const line2Variable = result['v:recipient-line2'];
        expect(line2Variable).toBe(`%recipient.line2%`);

        const textVariable = result['v:recipient-text'];
        expect(textVariable).toBe(`%recipient.text%`);

        const urlVariable = result['v:recipient-url'];
        expect(urlVariable).toBe(`%recipient.url%`);

        const titleVariable = result['v:recipient-title'];
        expect(titleVariable).toBe(`%recipient.title%`);

        const objectVariable = result['v:recipient-object'];
        expect(objectVariable).toBe(`%recipient.object%`);
      });
    });
  });

  describe('multiple recipients', () => {
    it('should build a single batch request for two recipients with no carbon copy values', () => {
      const baseRequest = {
        subject: 'Should Be Ignored',
        from: {
          email: senderEmail
        },
        replyTo: {
          email: replyToEmail
        },
        template: 'actiontemplate',
        templateVariables: {
          prompt: 'Reset Your Password Request - 337772',
          notkept: null,
          date: new Date()
        }
      };

      const TEST_SUBJECT = 'test subject';

      const line1 = 'A password reset was requested. Log into Dbx Components with the following temporary password to begin password reset.';
      const line2 = '337772';
      const text = 'Log Into Dbx Components';
      const url = 'https://components.dereekb.com/auth/login';
      const title = 'Reset Your Password Request - 337772';
      const object = {
        a: 'b'
      };

      const recipientA: MailgunRecipientBatchSendTarget = {
        email: testEmail,
        name: 'Test',
        userVariables: {
          subject: TEST_SUBJECT,
          line1,
          line2,
          text,
          url,
          title,
          object
        }
      };

      const recipientB: MailgunRecipientBatchSendTarget = {
        email: testEmail2,
        name: 'Test',
        userVariables: {
          subject: TEST_SUBJECT,
          line1,
          line2,
          text,
          url,
          title,
          object
        }
      };

      const factory = expandMailgunRecipientBatchSendTargetRequestFactory({
        request: baseRequest,
        useSubjectFromRecipientUserVariables: true // pull subject from recipients
      });

      const requests = factory([recipientA, recipientB]);
      expect(requests.length).toBe(1); // should have only one batch request as there is no cc/bcc

      const request = requests[0];
      expect(request.subject).toBe(MAILGUN_BATCH_SEND_RECIPIENT_SUBJECT_TEMPLATE); // should get pulled from the recipient
      expect(request.batchSend).toBe(true); // batch send is enabled

      const result = convertMailgunTemplateEmailRequestToMailgunMessageData({ request });
      const { from, to, cc, bcc } = result;

      expect(from).toBe(convertMailgunRecipientsToStrings([{ email: senderEmail }])[0]);
      expect(to).toEqual(convertMailgunRecipientsToStrings([recipientA, recipientB]));
      expect(cc).toBeUndefined();
      expect(bcc).toBeUndefined();

      expect(result.subject).toBe(MAILGUN_BATCH_SEND_RECIPIENT_SUBJECT_TEMPLATE);
      expect(result['recipient-variables']).toBeDefined();

      // check the recipient variable names were copied to the template variables
      const line1Variable = result['v:recipient-line1'];
      expect(line1Variable).toBe(`%recipient.line1%`);

      const line2Variable = result['v:recipient-line2'];
      expect(line2Variable).toBe(`%recipient.line2%`);

      const textVariable = result['v:recipient-text'];
      expect(textVariable).toBe(`%recipient.text%`);

      const urlVariable = result['v:recipient-url'];
      expect(urlVariable).toBe(`%recipient.url%`);

      const titleVariable = result['v:recipient-title'];
      expect(titleVariable).toBe(`%recipient.title%`);

      const objectVariable = result['v:recipient-object'];
      expect(objectVariable).toBe(`%recipient.object%`);
    });

    it('should build individual requests for recipients with carbon copy values', () => {
      const baseRequest = {
        subject: 'Should Be Ignored',
        from: {
          email: senderEmail
        },
        replyTo: {
          email: replyToEmail
        },
        template: 'actiontemplate',
        templateVariables: {
          prompt: 'Reset Your Password Request - 337772',
          notkept: null,
          date: new Date()
        }
      };

      const TEST_SUBJECT = 'test subject';

      const line1 = 'A password reset was requested. Log into Dbx Components with the following temporary password to begin password reset.';
      const line2 = '337772';
      const text = 'Log Into Dbx Components';
      const url = 'https://components.dereekb.com/auth/login';
      const title = 'Reset Your Password Request - 337772';
      const object = {
        a: 'b'
      };

      const recipientA: MailgunRecipientBatchSendTarget = {
        email: testEmail,
        name: 'Test',
        userVariables: {
          subject: TEST_SUBJECT,
          line1,
          line2,
          text,
          url,
          title,
          object
        }
      };

      const recipientB: MailgunRecipientBatchSendTarget = {
        email: testEmail2,
        name: 'Test',
        userVariables: {
          subject: TEST_SUBJECT,
          line1,
          line2,
          text,
          url,
          title,
          object
        }
      };

      const ccEmail = 'cc@dbcomponents.com';

      const recipientC: MailgunRecipientBatchSendTarget = {
        email: testEmail3,
        name: 'Test',
        userVariables: {
          subject: TEST_SUBJECT,
          line1,
          line2,
          text,
          url,
          title,
          object
        },
        cc: [
          {
            email: ccEmail
          }
        ]
      };

      const factory = expandMailgunRecipientBatchSendTargetRequestFactory({
        request: baseRequest,
        useSubjectFromRecipientUserVariables: true // pull subject from recipients
      });

      const requests = factory([recipientA, recipientB, recipientC]);
      expect(requests.length).toBe(2); // should have two sets of requests

      const [batchRequest, recipientCRequest] = requests;

      // validate the recipient C request
      expect(recipientCRequest.to).toEqual({
        ...recipientC,
        from: baseRequest.from,
        replyTo: baseRequest.replyTo,
        bcc: undefined
      });

      const recipientCRequestConversionResult = convertMailgunTemplateEmailRequestToMailgunMessageData({ request: recipientCRequest });

      expect(recipientCRequestConversionResult.from).toBe(convertMailgunRecipientsToStrings([{ email: senderEmail }])[0]);
      expect(recipientCRequestConversionResult.to).toEqual(convertMailgunRecipientsToStrings([recipientC]));
      expect(recipientCRequestConversionResult.cc).toEqual(convertMailgunRecipientsToStrings([{ email: ccEmail }]));
      expect(recipientCRequestConversionResult.bcc).toBeUndefined();
      expect(recipientCRequestConversionResult['recipient-variables']).toBeUndefined(); // no recipient variables as it should not be a batch send

      const recipientCLine1Variable = recipientCRequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}line1`];
      expect(recipientCLine1Variable).toBe(line1);

      const recipientCLine2Variable = recipientCRequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}line2`];
      expect(recipientCLine2Variable).toBe(line2);

      const recipientCTextVariable = recipientCRequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}text`];
      expect(recipientCTextVariable).toBe(text);

      const recipientCUrlVariable = recipientCRequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}url`];
      expect(recipientCUrlVariable).toBe(url);

      const recipientCTitleVariable = recipientCRequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}title`];
      expect(recipientCTitleVariable).toBe(title);

      const recipientCObjectVariable = recipientCRequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}object`];
      expect(recipientCObjectVariable).toBe(JSON.stringify(object));

      // validate the batch request
      expect(batchRequest.subject).toBe(MAILGUN_BATCH_SEND_RECIPIENT_SUBJECT_TEMPLATE); // should get pulled from the recipient
      expect(batchRequest.batchSend).toBe(true); // batch send is enabled

      const batchRequestConversionResult = convertMailgunTemplateEmailRequestToMailgunMessageData({ request: batchRequest });
      const { from, to, cc, bcc } = batchRequestConversionResult;

      expect(from).toBe(convertMailgunRecipientsToStrings([{ email: senderEmail }])[0]);
      expect(to).toEqual(convertMailgunRecipientsToStrings([recipientA, recipientB]));
      expect(cc).toBeUndefined();
      expect(bcc).toBeUndefined();

      expect(batchRequestConversionResult.subject).toBe(MAILGUN_BATCH_SEND_RECIPIENT_SUBJECT_TEMPLATE);
      expect(batchRequestConversionResult['recipient-variables']).toBeDefined();

      const recipientVariablesStrings = batchRequestConversionResult['recipient-variables'];
      const recipientVariables = JSON.parse(recipientVariablesStrings as string);
      const recipientVariablesForRecpient = recipientVariables[recipientA.email];

      expect(recipientVariablesForRecpient).toBeDefined();
      expect(recipientVariablesForRecpient.line1).toBe(line1);
      expect(recipientVariablesForRecpient.line2).toBe(line2);
      expect(recipientVariablesForRecpient.text).toBe(text);
      expect(recipientVariablesForRecpient.url).toBe(url);
      expect(recipientVariablesForRecpient.title).toBe(title);
      expect(recipientVariablesForRecpient.object).toEqual(object);

      // check the recipient variable names were copied to the template variables
      const line1Variable = batchRequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}line1`];
      expect(line1Variable).toBe(`%recipient.line1%`);

      const line2Variable = batchRequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}line2`];
      expect(line2Variable).toBe(`%recipient.line2%`);

      const textVariable = batchRequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}text`];
      expect(textVariable).toBe(`%recipient.text%`);

      const urlVariable = batchRequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}url`];
      expect(urlVariable).toBe(`%recipient.url%`);

      const titleVariable = batchRequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}title`];
      expect(titleVariable).toBe(`%recipient.title%`);

      const objectVariable = batchRequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}object`];
      expect(objectVariable).toBe(`%recipient.object%`);
    });

    it('should build individual requests if the base request has a carbon copy value set', () => {
      const ccEmail = 'cc@dbcomponents.com';

      const cc = [
        {
          email: ccEmail
        }
      ];

      const baseRequest = {
        subject: 'Should Be Ignored',
        from: {
          email: senderEmail
        },
        replyTo: {
          email: replyToEmail
        },
        template: 'actiontemplate',
        templateVariables: {
          prompt: 'Reset Your Password Request - 337772',
          notkept: null,
          date: new Date()
        },
        cc
      };

      const TEST_SUBJECT = 'test subject';

      const line1 = 'A password reset was requested. Log into Dbx Components with the following temporary password to begin password reset.';
      const line2 = '337772';
      const text = 'Log Into Dbx Components';
      const url = 'https://components.dereekb.com/auth/login';
      const title = 'Reset Your Password Request - 337772';
      const object = {
        a: 'b'
      };

      const recipientA: MailgunRecipientBatchSendTarget = {
        email: testEmail,
        name: 'Test',
        userVariables: {
          subject: TEST_SUBJECT,
          line1,
          line2,
          text,
          url,
          title,
          object
        }
      };

      const recipientB: MailgunRecipientBatchSendTarget = {
        email: testEmail2,
        name: 'Test',
        userVariables: {
          subject: TEST_SUBJECT,
          line1,
          line2,
          text,
          url,
          title,
          object
        }
      };

      const factory = expandMailgunRecipientBatchSendTargetRequestFactory({
        request: baseRequest,
        useSubjectFromRecipientUserVariables: true // pull subject from recipients
      });

      const requests = factory([recipientA, recipientB]);
      expect(requests.length).toBe(2); // should have two sets of requests

      const [recipientARequest, recipientBRequest] = requests;

      // validate the recipient A request
      expect(recipientARequest.to).toEqual({
        ...recipientA,
        from: baseRequest.from,
        replyTo: baseRequest.replyTo,
        cc,
        bcc: undefined
      });

      const recipientARequestConversionResult = convertMailgunTemplateEmailRequestToMailgunMessageData({ request: recipientARequest });

      expect(recipientARequestConversionResult.from).toBe(convertMailgunRecipientsToStrings([{ email: senderEmail }])[0]);
      expect(recipientARequestConversionResult.to).toEqual(convertMailgunRecipientsToStrings([recipientA]));
      expect(recipientARequestConversionResult.cc).toEqual(convertMailgunRecipientsToStrings(cc));
      expect(recipientARequestConversionResult.bcc).toBeUndefined();
      expect(recipientARequestConversionResult['recipient-variables']).toBeUndefined(); // no recipient variables as it should not be a batch send

      const recipientALine1Variable = recipientARequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}line1`];
      expect(recipientALine1Variable).toBe(line1);

      const recipientALine2Variable = recipientARequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}line2`];
      expect(recipientALine2Variable).toBe(line2);

      const recipientATextVariable = recipientARequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}text`];
      expect(recipientATextVariable).toBe(text);

      const recipientAUrlVariable = recipientARequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}url`];
      expect(recipientAUrlVariable).toBe(url);

      const recipientATitleVariable = recipientARequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}title`];
      expect(recipientATitleVariable).toBe(title);

      const recipientAObjectVariable = recipientARequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}object`];
      expect(recipientAObjectVariable).toBe(JSON.stringify(object));

      // validate the recipient B request
      expect(recipientBRequest.to).toEqual({
        ...recipientB,
        from: baseRequest.from,
        replyTo: baseRequest.replyTo,
        cc,
        bcc: undefined
      });

      const recipientBRequestConversionResult = convertMailgunTemplateEmailRequestToMailgunMessageData({ request: recipientBRequest });

      expect(recipientBRequestConversionResult.from).toBe(convertMailgunRecipientsToStrings([{ email: senderEmail }])[0]);
      expect(recipientBRequestConversionResult.to).toEqual(convertMailgunRecipientsToStrings([recipientB]));
      expect(recipientBRequestConversionResult.cc).toEqual(convertMailgunRecipientsToStrings(cc));
      expect(recipientBRequestConversionResult.bcc).toBeUndefined();
      expect(recipientBRequestConversionResult['recipient-variables']).toBeUndefined(); // no recipient variables as it should not be a batch send

      const recipientBLine1Variable = recipientBRequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}line1`];
      expect(recipientBLine1Variable).toBe(line1);

      const recipientBLine2Variable = recipientBRequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}line2`];
      expect(recipientBLine2Variable).toBe(line2);

      const recipientBTextVariable = recipientBRequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}text`];
      expect(recipientBTextVariable).toBe(text);

      const recipientBUrlVariable = recipientBRequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}url`];
      expect(recipientBUrlVariable).toBe(url);

      const recipientBTitleVariable = recipientBRequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}title`];
      expect(recipientBTitleVariable).toBe(title);

      const recipientBObjectVariable = recipientBRequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}object`];
      expect(recipientBObjectVariable).toBe(JSON.stringify(object));
    });

    it('should build individual requests if the base request has batch sending set to false', () => {
      const baseRequest = {
        subject: 'Should Be Ignored',
        from: {
          email: senderEmail
        },
        replyTo: {
          email: replyToEmail
        },
        template: 'actiontemplate',
        templateVariables: {
          prompt: 'Reset Your Password Request - 337772',
          notkept: null,
          date: new Date()
        },
        batchSend: false
      };

      const TEST_SUBJECT = 'test subject';

      const line1 = 'A password reset was requested. Log into Dbx Components with the following temporary password to begin password reset.';
      const line2 = '337772';
      const text = 'Log Into Dbx Components';
      const url = 'https://components.dereekb.com/auth/login';
      const title = 'Reset Your Password Request - 337772';
      const object = {
        a: 'b'
      };

      const recipientA: MailgunRecipientBatchSendTarget = {
        email: testEmail,
        name: 'Test',
        userVariables: {
          subject: TEST_SUBJECT,
          line1,
          line2,
          text,
          url,
          title,
          object
        }
      };

      const recipientB: MailgunRecipientBatchSendTarget = {
        email: testEmail2,
        name: 'Test',
        userVariables: {
          subject: TEST_SUBJECT,
          line1,
          line2,
          text,
          url,
          title,
          object
        }
      };

      const factory = expandMailgunRecipientBatchSendTargetRequestFactory({
        request: baseRequest,
        useSubjectFromRecipientUserVariables: true // pull subject from recipients
      });

      const requests = factory([recipientA, recipientB]);
      expect(requests.length).toBe(2); // should have two sets of requests

      const [recipientARequest, recipientBRequest] = requests;

      // validate the recipient A request
      expect(recipientARequest.to).toEqual({
        ...recipientA,
        from: baseRequest.from,
        replyTo: baseRequest.replyTo,
        cc: undefined,
        bcc: undefined
      });

      const recipientARequestConversionResult = convertMailgunTemplateEmailRequestToMailgunMessageData({ request: recipientARequest });

      expect(recipientARequestConversionResult.from).toBe(convertMailgunRecipientsToStrings([{ email: senderEmail }])[0]);
      expect(recipientARequestConversionResult.to).toEqual(convertMailgunRecipientsToStrings([recipientA]));
      expect(recipientARequestConversionResult.cc).toBeUndefined();
      expect(recipientARequestConversionResult.bcc).toBeUndefined();
      expect(recipientARequestConversionResult['recipient-variables']).toBeUndefined(); // no recipient variables as it should not be a batch send

      const recipientALine1Variable = recipientARequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}line1`];
      expect(recipientALine1Variable).toBe(line1);

      const recipientALine2Variable = recipientARequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}line2`];
      expect(recipientALine2Variable).toBe(line2);

      const recipientATextVariable = recipientARequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}text`];
      expect(recipientATextVariable).toBe(text);

      const recipientAUrlVariable = recipientARequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}url`];
      expect(recipientAUrlVariable).toBe(url);

      const recipientATitleVariable = recipientARequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}title`];
      expect(recipientATitleVariable).toBe(title);

      const recipientAObjectVariable = recipientARequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}object`];
      expect(recipientAObjectVariable).toBe(JSON.stringify(object));

      // validate the recipient B request
      expect(recipientBRequest.to).toEqual({
        ...recipientB,
        from: baseRequest.from,
        replyTo: baseRequest.replyTo,
        cc: undefined,
        bcc: undefined
      });

      const recipientBRequestConversionResult = convertMailgunTemplateEmailRequestToMailgunMessageData({ request: recipientBRequest });

      expect(recipientBRequestConversionResult.from).toBe(convertMailgunRecipientsToStrings([{ email: senderEmail }])[0]);
      expect(recipientBRequestConversionResult.to).toEqual(convertMailgunRecipientsToStrings([recipientB]));
      expect(recipientBRequestConversionResult.cc).toBeUndefined();
      expect(recipientBRequestConversionResult.bcc).toBeUndefined();
      expect(recipientBRequestConversionResult['recipient-variables']).toBeUndefined(); // no recipient variables as it should not be a batch send

      const recipientBLine1Variable = recipientBRequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}line1`];
      expect(recipientBLine1Variable).toBe(line1);

      const recipientBLine2Variable = recipientBRequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}line2`];
      expect(recipientBLine2Variable).toBe(line2);

      const recipientBTextVariable = recipientBRequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}text`];
      expect(recipientBTextVariable).toBe(text);

      const recipientBUrlVariable = recipientBRequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}url`];
      expect(recipientBUrlVariable).toBe(url);

      const recipientBTitleVariable = recipientBRequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}title`];
      expect(recipientBTitleVariable).toBe(title);

      const recipientBObjectVariable = recipientBRequestConversionResult[`v:${DEFAULT_RECIPIENT_VARIABLE_PREFIX}object`];
      expect(recipientBObjectVariable).toBe(JSON.stringify(object));
    });

    describe('from/replyTo batching', () => {
      const TEST_SUBJECT = 'test subject';
      const alternativeFromEmail = 'alternative-sender@dereekb.com';
      const alternativeReplyToEmail = 'alternative-reply@dereekb.com';

      it('should group recipients with different from emails into separate batches', () => {
        const baseRequest = {
          subject: 'Default Subject',
          from: {
            email: senderEmail
          },
          replyTo: {
            email: replyToEmail
          },
          template: 'actiontemplate',
          templateVariables: {}
        };

        const recipientA: MailgunRecipientBatchSendTarget = {
          email: testEmail,
          name: 'Test A',
          userVariables: { subject: TEST_SUBJECT }
        };

        const recipientB: MailgunRecipientBatchSendTarget = {
          email: testEmail2,
          name: 'Test B',
          from: { email: alternativeFromEmail }, // Different from
          userVariables: { subject: TEST_SUBJECT }
        };

        const recipientC: MailgunRecipientBatchSendTarget = {
          email: testEmail3,
          name: 'Test C',
          userVariables: { subject: TEST_SUBJECT }
        };

        const factory = expandMailgunRecipientBatchSendTargetRequestFactory({
          request: baseRequest,
          useSubjectFromRecipientUserVariables: true
        });

        const requests = factory([recipientA, recipientB, recipientC]);

        // Should create 2 batch requests: one for A+C (default from), one for B (alternative from)
        expect(requests.length).toBe(2);

        // Find the request with alternative from
        const alternativeFromRequest = requests.find((r) => r.from?.email === alternativeFromEmail);
        expect(alternativeFromRequest).toBeDefined();
        expect(alternativeFromRequest!.batchSend).toBe(true);
        expect(Array.isArray(alternativeFromRequest!.to)).toBe(true);
        expect((alternativeFromRequest!.to as MailgunRecipientBatchSendTarget[]).length).toBe(1);
        expect((alternativeFromRequest!.to as MailgunRecipientBatchSendTarget[])[0].email).toBe(testEmail2);

        // Find the request with default from
        const defaultFromRequest = requests.find((r) => r.from?.email === senderEmail);
        expect(defaultFromRequest).toBeDefined();
        expect(defaultFromRequest!.batchSend).toBe(true);
        expect(Array.isArray(defaultFromRequest!.to)).toBe(true);
        expect((defaultFromRequest!.to as MailgunRecipientBatchSendTarget[]).length).toBe(2);
      });

      it('should group recipients with different replyTo emails into separate batches', () => {
        const baseRequest = {
          subject: 'Default Subject',
          from: {
            email: senderEmail
          },
          replyTo: {
            email: replyToEmail
          },
          template: 'actiontemplate',
          templateVariables: {}
        };

        const recipientA: MailgunRecipientBatchSendTarget = {
          email: testEmail,
          name: 'Test A',
          userVariables: { subject: TEST_SUBJECT }
        };

        const recipientB: MailgunRecipientBatchSendTarget = {
          email: testEmail2,
          name: 'Test B',
          replyTo: { email: alternativeReplyToEmail }, // Different replyTo
          userVariables: { subject: TEST_SUBJECT }
        };

        const recipientC: MailgunRecipientBatchSendTarget = {
          email: testEmail3,
          name: 'Test C',
          userVariables: { subject: TEST_SUBJECT }
        };

        const factory = expandMailgunRecipientBatchSendTargetRequestFactory({
          request: baseRequest,
          useSubjectFromRecipientUserVariables: true
        });

        const requests = factory([recipientA, recipientB, recipientC]);

        // Should create 2 batch requests: one for A+C (default replyTo), one for B (alternative replyTo)
        expect(requests.length).toBe(2);

        // Find the request with alternative replyTo
        const alternativeReplyToRequest = requests.find((r) => r.replyTo?.email === alternativeReplyToEmail);
        expect(alternativeReplyToRequest).toBeDefined();
        expect(alternativeReplyToRequest!.batchSend).toBe(true);
        expect(Array.isArray(alternativeReplyToRequest!.to)).toBe(true);
        expect((alternativeReplyToRequest!.to as MailgunRecipientBatchSendTarget[]).length).toBe(1);
        expect((alternativeReplyToRequest!.to as MailgunRecipientBatchSendTarget[])[0].email).toBe(testEmail2);

        // Find the request with default replyTo
        const defaultReplyToRequest = requests.find((r) => r.replyTo?.email === replyToEmail);
        expect(defaultReplyToRequest).toBeDefined();
        expect(defaultReplyToRequest!.batchSend).toBe(true);
        expect(Array.isArray(defaultReplyToRequest!.to)).toBe(true);
        expect((defaultReplyToRequest!.to as MailgunRecipientBatchSendTarget[]).length).toBe(2);
      });

      it('should group recipients with different from/replyTo combinations correctly', () => {
        const baseRequest = {
          subject: 'Default Subject',
          from: {
            email: senderEmail
          },
          replyTo: {
            email: replyToEmail
          },
          template: 'actiontemplate',
          templateVariables: {}
        };

        const recipientA: MailgunRecipientBatchSendTarget = {
          email: testEmail,
          name: 'Test A',
          userVariables: { subject: TEST_SUBJECT }
        };

        const recipientB: MailgunRecipientBatchSendTarget = {
          email: testEmail2,
          name: 'Test B',
          from: { email: alternativeFromEmail },
          userVariables: { subject: TEST_SUBJECT }
        };

        const recipientC: MailgunRecipientBatchSendTarget = {
          email: testEmail3,
          name: 'Test C',
          from: { email: alternativeFromEmail },
          replyTo: { email: alternativeReplyToEmail },
          userVariables: { subject: TEST_SUBJECT }
        };

        const recipientD: MailgunRecipientBatchSendTarget = {
          email: 'test4@dereekb.com',
          name: 'Test D',
          userVariables: { subject: TEST_SUBJECT }
        };

        const factory = expandMailgunRecipientBatchSendTargetRequestFactory({
          request: baseRequest,
          useSubjectFromRecipientUserVariables: true
        });

        const requests = factory([recipientA, recipientB, recipientC, recipientD]);

        // Should create 3 batch requests:
        // 1. A+D: default from + default replyTo
        // 2. B: alternative from + default replyTo
        // 3. C: alternative from + alternative replyTo
        expect(requests.length).toBe(3);

        // Verify each batch has correct from/replyTo and recipients
        const defaultBatch = requests.find((r) => r.from?.email === senderEmail && r.replyTo?.email === replyToEmail);
        expect(defaultBatch).toBeDefined();
        expect((defaultBatch!.to as MailgunRecipientBatchSendTarget[]).length).toBe(2);

        const altFromBatch = requests.find((r) => r.from?.email === alternativeFromEmail && r.replyTo?.email === replyToEmail);
        expect(altFromBatch).toBeDefined();
        expect((altFromBatch!.to as MailgunRecipientBatchSendTarget[]).length).toBe(1);
        expect((altFromBatch!.to as MailgunRecipientBatchSendTarget[])[0].email).toBe(testEmail2);

        const altBothBatch = requests.find((r) => r.from?.email === alternativeFromEmail && r.replyTo?.email === alternativeReplyToEmail);
        expect(altBothBatch).toBeDefined();
        expect((altBothBatch!.to as MailgunRecipientBatchSendTarget[]).length).toBe(1);
        expect((altBothBatch!.to as MailgunRecipientBatchSendTarget[])[0].email).toBe(testEmail3);
      });

      it('should perform case-insensitive grouping by email', () => {
        const baseRequest = {
          subject: 'Default Subject',
          from: {
            email: senderEmail
          },
          replyTo: {
            email: replyToEmail
          },
          template: 'actiontemplate',
          templateVariables: {}
        };

        const recipientA: MailgunRecipientBatchSendTarget = {
          email: testEmail,
          name: 'Test A',
          from: { email: 'Test@Example.com' },
          userVariables: { subject: TEST_SUBJECT }
        };

        const recipientB: MailgunRecipientBatchSendTarget = {
          email: testEmail2,
          name: 'Test B',
          from: { email: 'test@example.com' }, // Same email, different case
          userVariables: { subject: TEST_SUBJECT }
        };

        const factory = expandMailgunRecipientBatchSendTargetRequestFactory({
          request: baseRequest,
          useSubjectFromRecipientUserVariables: true
        });

        const requests = factory([recipientA, recipientB]);

        // Should create 1 batch request since emails are the same (case-insensitive)
        expect(requests.length).toBe(1);
        expect(requests[0].batchSend).toBe(true);
        expect((requests[0].to as MailgunRecipientBatchSendTarget[]).length).toBe(2);
      });

      it('should not batch recipients with cc/bcc even if they have the same from/replyTo', () => {
        const baseRequest = {
          subject: 'Default Subject',
          from: {
            email: senderEmail
          },
          replyTo: {
            email: replyToEmail
          },
          template: 'actiontemplate',
          templateVariables: {}
        };

        const recipientA: MailgunRecipientBatchSendTarget = {
          email: testEmail,
          name: 'Test A',
          userVariables: { subject: TEST_SUBJECT }
        };

        const recipientB: MailgunRecipientBatchSendTarget = {
          email: testEmail2,
          name: 'Test B',
          cc: [{ email: 'cc@example.com' }], // Has CC
          userVariables: { subject: TEST_SUBJECT }
        };

        const recipientC: MailgunRecipientBatchSendTarget = {
          email: testEmail3,
          name: 'Test C',
          userVariables: { subject: TEST_SUBJECT }
        };

        const factory = expandMailgunRecipientBatchSendTargetRequestFactory({
          request: baseRequest,
          useSubjectFromRecipientUserVariables: true
        });

        const requests = factory([recipientA, recipientB, recipientC]);

        // Should create 2 requests:
        // 1. Batch for A+C (no cc/bcc)
        // 2. Individual for B (has cc)
        expect(requests.length).toBe(2);

        const batchRequest = requests.find((r) => r.batchSend === true);
        expect(batchRequest).toBeDefined();
        expect((batchRequest!.to as MailgunRecipientBatchSendTarget[]).length).toBe(2);

        const individualRequest = requests.find((r) => r.batchSend === false);
        expect(individualRequest).toBeDefined();
        expect((individualRequest!.to as MailgunRecipientBatchSendTarget).email).toBe(testEmail2);
      });
    });

    describe('with NotificationMessageEntityKeyRecipientLookup', () => {
      const key1 = 'PRIMARY_SENDER';
      const key2 = 'SYSTEM_SENDER';
      const ccKey = 'CC_RECIPIENT';

      const recipient1 = { name: 'Primary Sender', email: 'primary-sender@example.com' };
      const recipient2 = { name: 'System Sender', email: 'system-sender@example.com' };
      const ccRecipient = { name: 'CC Recipient', email: 'cc-recipient@example.com' };

      const recipientsMap = new Map<string, typeof recipient1>();
      recipientsMap.set(key1, recipient1);
      recipientsMap.set(key2, recipient2);
      recipientsMap.set(ccKey, ccRecipient);

      const notificationMessageEntityKeyRecipientLookup: NotificationMessageEntityKeyRecipientLookup = {
        recipientsMap,
        getRecipientOrDefaultForKey: (key: string) => recipientsMap.get(key) as any, // mocking for test simplicity
        getRecipientsForKeys: (keys: any) => {
          const k = Array.isArray(keys) ? keys : [keys];
          return k.map((key) => recipientsMap.get(key)).filter((x) => x) as any;
        }
      };

      it('should resolve fromKey and replyToKey', () => {
        const baseRequest = {
          subject: 'Subject',
          template: 'template',
          templateVariables: {}
        };

        const recipient: MailgunRecipientBatchSendTarget = {
          email: testEmail,
          name: 'Test',
          fromKey: key1,
          replyToKey: key2
        };

        const factory = expandMailgunRecipientBatchSendTargetRequestFactory({
          request: baseRequest,
          useSubjectFromRecipientUserVariables: false,
          notificationMessageEntityKeyRecipientLookup
        });

        const requests = factory([recipient]);
        const request = requests[0];

        expect(request.from).toEqual(recipient1);
        expect(request.replyTo).toEqual(recipient2);
      });

      it('should prioritize explicit from/replyTo over keys', () => {
        const baseRequest = {
          subject: 'Subject',
          template: 'template',
          templateVariables: {}
        };

        const explicitFrom = { email: 'explicit-from@example.com' };
        const explicitReplyTo = { email: 'explicit-reply-to@example.com' };

        const recipient: MailgunRecipientBatchSendTarget = {
          email: testEmail,
          name: 'Test',
          from: explicitFrom,
          fromKey: key1,
          replyTo: explicitReplyTo,
          replyToKey: key2
        };

        const factory = expandMailgunRecipientBatchSendTargetRequestFactory({
          request: baseRequest,
          useSubjectFromRecipientUserVariables: false,
          notificationMessageEntityKeyRecipientLookup
        });

        const requests = factory([recipient]);
        const request = requests[0];

        expect(request.from).toEqual(explicitFrom);
        expect(request.replyTo).toEqual(explicitReplyTo);
      });

      it('should resolve ccKey and merge with existing cc', () => {
        const baseRequest = {
          subject: 'Subject',
          template: 'template',
          templateVariables: {}
        };

        const explicitCc = { email: 'explicit-cc@example.com' };

        const recipient: MailgunRecipientBatchSendTarget = {
          email: testEmail,
          name: 'Test',
          cc: [explicitCc],
          ccKeys: ccKey
        };

        const factory = expandMailgunRecipientBatchSendTargetRequestFactory({
          request: baseRequest,
          useSubjectFromRecipientUserVariables: false,
          notificationMessageEntityKeyRecipientLookup
        });

        const requests = factory([recipient]);
        const request = requests[0];

        expect(request.cc).toContainEqual(explicitCc);
        expect(request.cc).toContainEqual(ccRecipient);
      });

      it('should override cc with ccKey when overrideCarbonCopyVariablesWithCarbonCopyKeyRecipients is true', () => {
        const baseRequest = {
          subject: 'Subject',
          template: 'template',
          templateVariables: {}
        };

        const explicitCc = { email: 'explicit-cc@example.com' };

        const recipient: MailgunRecipientBatchSendTarget = {
          email: testEmail,
          name: 'Test',
          cc: [explicitCc],
          ccKeys: ccKey
        };

        const factory = expandMailgunRecipientBatchSendTargetRequestFactory({
          request: baseRequest,
          useSubjectFromRecipientUserVariables: false,
          notificationMessageEntityKeyRecipientLookup,
          overrideCarbonCopyVariablesWithCarbonCopyKeyRecipients: true
        });

        const requests = factory([recipient]);
        const request = requests[0];

        expect(request.cc).not.toContainEqual(explicitCc);
        expect(request.cc).toContainEqual(ccRecipient);
        const cc = request.cc as any[];
        expect(cc?.length).toBe(1);
      });

      it('should resolve bccKeys and merge with existing bcc', () => {
        const baseRequest = {
          subject: 'Subject',
          template: 'template',
          templateVariables: {}
        };

        const explicitBcc = { email: 'explicit-bcc@example.com' };

        const recipient: MailgunRecipientBatchSendTarget = {
          email: testEmail,
          name: 'Test',
          bcc: [explicitBcc],
          bccKeys: ccKey // Using ccKey as a mock key for simplicity
        };

        const factory = expandMailgunRecipientBatchSendTargetRequestFactory({
          request: baseRequest,
          useSubjectFromRecipientUserVariables: false,
          notificationMessageEntityKeyRecipientLookup
        });

        const requests = factory([recipient]);
        const request = requests[0];

        expect(request.bcc).toContainEqual(explicitBcc);
        expect(request.bcc).toContainEqual(ccRecipient); // Should resolve to same recipient as key is same
      });

      it('should handle array of keys for ccKeys', () => {
        const baseRequest = {
          subject: 'Subject',
          template: 'template',
          templateVariables: {}
        };

        const recipient: MailgunRecipientBatchSendTarget = {
          email: testEmail,
          name: 'Test',
          ccKeys: [key1, key2]
        };

        const factory = expandMailgunRecipientBatchSendTargetRequestFactory({
          request: baseRequest,
          useSubjectFromRecipientUserVariables: false,
          notificationMessageEntityKeyRecipientLookup
        });

        const requests = factory([recipient]);
        const request = requests[0];

        expect(request.cc).toContainEqual(recipient1);
        expect(request.cc).toContainEqual(recipient2);
      });

      it('should merge base request cc/bcc with resolved keys', () => {
        const baseRequestCc = { email: 'base-cc@example.com' };
        const baseRequest = {
          subject: 'Subject',
          template: 'template',
          templateVariables: {},
          cc: [baseRequestCc]
        };

        const recipient: MailgunRecipientBatchSendTarget = {
          email: testEmail,
          name: 'Test',
          ccKeys: ccKey
        };

        const factory = expandMailgunRecipientBatchSendTargetRequestFactory({
          request: baseRequest,
          useSubjectFromRecipientUserVariables: false,
          notificationMessageEntityKeyRecipientLookup
        });

        const requests = factory([recipient]);
        const request = requests[0];

        expect(request.cc).toContainEqual(baseRequestCc);
        expect(request.cc).toContainEqual(ccRecipient);
      });
    });
  });
});

describe('NotificationMessageEntityKeyRecipientLookup', () => {
  const key1 = 'PRIMARY_SENDER';
  const key2 = 'SYSTEM_SENDER';
  const unknownKey = 'user-unknown';

  const recipient1 = { name: 'Primary Sender', email: 'primary-sender@example.com' };
  const recipient2 = { name: 'System Sender', email: 'system-sender@example.com' };
  const defaultRecipient = { name: 'Default', email: 'default@example.com' };

  let recipientsMap: Map<string, typeof recipient1>;
  let lookup: NotificationMessageEntityKeyRecipientLookup;

  beforeEach(() => {
    recipientsMap = new Map();
    recipientsMap.set(key1, recipient1);
    recipientsMap.set(key2, recipient2);

    lookup = notificationMessageEntityKeyRecipientLookup({ recipientsMap });
  });

  describe('getRecipientOrDefaultForKey()', () => {
    it('should return the recipient if the key exists in the map', () => {
      const result = lookup.getRecipientOrDefaultForKey(key1, defaultRecipient);
      expect(result).toBe(recipient1);
    });

    it('should return the default recipient if the key does not exist', () => {
      const result = lookup.getRecipientOrDefaultForKey(unknownKey, defaultRecipient);
      expect(result).toBe(defaultRecipient);
    });

    it('should return the default recipient if the key is null/undefined', () => {
      const result = lookup.getRecipientOrDefaultForKey(undefined, defaultRecipient);
      expect(result).toBe(defaultRecipient);
    });

    it('should return undefined if the default recipient is not provided and key is not found', () => {
      const result = lookup.getRecipientOrDefaultForKey(unknownKey);
      expect(result).toBeUndefined();
    });
  });

  describe('getRecipientsForKeys()', () => {
    it('should return recipients for existing keys', () => {
      const result = lookup.getRecipientsForKeys([key1, key2]);
      expect(result).toEqual([recipient1, recipient2]);
    });

    it('should ignore keys that do not exist', () => {
      const result = lookup.getRecipientsForKeys([key1, unknownKey]);
      expect(result).toEqual([recipient1]);
    });

    it('should return undefined if input is null/undefined', () => {
      const result = lookup.getRecipientsForKeys(undefined);
      expect(result).toBeUndefined();
    });

    it('should return undefined if no keys match', () => {
      const result = lookup.getRecipientsForKeys([unknownKey]);
      expect(result).toBeUndefined(); // Returns undefined if array is empty after filtering
    });

    it('should handle single value input', () => {
      const result = lookup.getRecipientsForKeys(key1);
      expect(result).toEqual([recipient1]);
    });
  });
});
