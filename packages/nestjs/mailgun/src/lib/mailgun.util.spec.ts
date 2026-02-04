import { convertMailgunTemplateEmailRequestToMailgunMessageData, convertMailgunRecipientsToStrings, DEFAULT_RECIPIENT_VARIABLE_PREFIX } from './mailgun';
import { MAILGUN_BATCH_SEND_RECIPIENT_SUBJECT_TEMPLATE, expandMailgunRecipientBatchSendTargetRequestFactory, type MailgunRecipientBatchSendTarget } from './mailgun.util';

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
      expect(recipientCRequest.to).toBe(recipientC);

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
      expect(recipientARequest.to).toBe(recipientA);

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
      expect(recipientBRequest.to).toBe(recipientB);

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
      expect(recipientARequest.to).toBe(recipientA);

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
      expect(recipientBRequest.to).toBe(recipientB);

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
  });
});
