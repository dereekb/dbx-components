import { convertMailgunTemplateEmailRequestToMailgunMessageData, type MailgunTemplateEmailRequest, MAILGUN_REPLY_TO_EMAIL_HEADER_DATA_VARIABLE_KEY, convertMailgunRecipientsToStrings } from './mailgun';
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

        const result = convertMailgunTemplateEmailRequestToMailgunMessageData({ request });
        expect(result['recipient-variables']).toBeUndefined(); // not set when batch sending is disabled

        const { from, to, cc, bcc } = result;

        expect(from).toBe(convertMailgunRecipientsToStrings([{ email: senderEmail }])[0]);
        expect(to).toEqual(convertMailgunRecipientsToStrings([recipient]));
        expect(cc).toBeUndefined();
        expect(bcc).toBeUndefined();

        expect(result.subject).toBe(TEST_SUBJECT);

        const line1Variable = result['v:line1'];
        expect(line1Variable).toBe(line1);

        const line2Variable = result['v:line2'];
        expect(line2Variable).toBe(line2);

        const textVariable = result['v:text'];
        expect(textVariable).toBe(text);

        const urlVariable = result['v:url'];
        expect(urlVariable).toBe(url);

        const titleVariable = result['v:title'];
        expect(titleVariable).toBe(title);

        const objectVariable = result['v:object'];
        expect(objectVariable).toBe(JSON.stringify(object));
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

      const recipientCLine1Variable = recipientCRequestConversionResult['v:line1'];
      expect(recipientCLine1Variable).toBe(line1);

      const recipientCLine2Variable = recipientCRequestConversionResult['v:line2'];
      expect(recipientCLine2Variable).toBe(line2);

      const recipientCTextVariable = recipientCRequestConversionResult['v:text'];
      expect(recipientCTextVariable).toBe(text);

      const recipientCUrlVariable = recipientCRequestConversionResult['v:url'];
      expect(recipientCUrlVariable).toBe(url);

      const recipientCTitleVariable = recipientCRequestConversionResult['v:title'];
      expect(recipientCTitleVariable).toBe(title);

      const recipientCObjectVariable = recipientCRequestConversionResult['v:object'];
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

      // check the recipient variable names were copied to the template variables
      const line1Variable = batchRequestConversionResult['v:recipient-line1'];
      expect(line1Variable).toBe(`%recipient.line1%`);

      const line2Variable = batchRequestConversionResult['v:recipient-line2'];
      expect(line2Variable).toBe(`%recipient.line2%`);

      const textVariable = batchRequestConversionResult['v:recipient-text'];
      expect(textVariable).toBe(`%recipient.text%`);

      const urlVariable = batchRequestConversionResult['v:recipient-url'];
      expect(urlVariable).toBe(`%recipient.url%`);

      const titleVariable = batchRequestConversionResult['v:recipient-title'];
      expect(titleVariable).toBe(`%recipient.title%`);

      const objectVariable = batchRequestConversionResult['v:recipient-object'];
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

      const recipientALine1Variable = recipientARequestConversionResult['v:line1'];
      expect(recipientALine1Variable).toBe(line1);

      const recipientALine2Variable = recipientARequestConversionResult['v:line2'];
      expect(recipientALine2Variable).toBe(line2);

      const recipientATextVariable = recipientARequestConversionResult['v:text'];
      expect(recipientATextVariable).toBe(text);

      const recipientAUrlVariable = recipientARequestConversionResult['v:url'];
      expect(recipientAUrlVariable).toBe(url);

      const recipientATitleVariable = recipientARequestConversionResult['v:title'];
      expect(recipientATitleVariable).toBe(title);

      const recipientAObjectVariable = recipientARequestConversionResult['v:object'];
      expect(recipientAObjectVariable).toBe(JSON.stringify(object));

      // validate the recipient B request
      expect(recipientBRequest.to).toBe(recipientB);

      const recipientBRequestConversionResult = convertMailgunTemplateEmailRequestToMailgunMessageData({ request: recipientBRequest });

      expect(recipientBRequestConversionResult.from).toBe(convertMailgunRecipientsToStrings([{ email: senderEmail }])[0]);
      expect(recipientBRequestConversionResult.to).toEqual(convertMailgunRecipientsToStrings([recipientB]));
      expect(recipientBRequestConversionResult.cc).toEqual(convertMailgunRecipientsToStrings(cc));
      expect(recipientBRequestConversionResult.bcc).toBeUndefined();
      expect(recipientBRequestConversionResult['recipient-variables']).toBeUndefined(); // no recipient variables as it should not be a batch send

      const recipientBLine1Variable = recipientBRequestConversionResult['v:line1'];
      expect(recipientBLine1Variable).toBe(line1);

      const recipientBLine2Variable = recipientBRequestConversionResult['v:line2'];
      expect(recipientBLine2Variable).toBe(line2);

      const recipientBTextVariable = recipientBRequestConversionResult['v:text'];
      expect(recipientBTextVariable).toBe(text);

      const recipientBUrlVariable = recipientBRequestConversionResult['v:url'];
      expect(recipientBUrlVariable).toBe(url);

      const recipientBTitleVariable = recipientBRequestConversionResult['v:title'];
      expect(recipientBTitleVariable).toBe(title);

      const recipientBObjectVariable = recipientBRequestConversionResult['v:object'];
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

      const recipientALine1Variable = recipientARequestConversionResult['v:line1'];
      expect(recipientALine1Variable).toBe(line1);

      const recipientALine2Variable = recipientARequestConversionResult['v:line2'];
      expect(recipientALine2Variable).toBe(line2);

      const recipientATextVariable = recipientARequestConversionResult['v:text'];
      expect(recipientATextVariable).toBe(text);

      const recipientAUrlVariable = recipientARequestConversionResult['v:url'];
      expect(recipientAUrlVariable).toBe(url);

      const recipientATitleVariable = recipientARequestConversionResult['v:title'];
      expect(recipientATitleVariable).toBe(title);

      const recipientAObjectVariable = recipientARequestConversionResult['v:object'];
      expect(recipientAObjectVariable).toBe(JSON.stringify(object));

      // validate the recipient B request
      expect(recipientBRequest.to).toBe(recipientB);

      const recipientBRequestConversionResult = convertMailgunTemplateEmailRequestToMailgunMessageData({ request: recipientBRequest });

      expect(recipientBRequestConversionResult.from).toBe(convertMailgunRecipientsToStrings([{ email: senderEmail }])[0]);
      expect(recipientBRequestConversionResult.to).toEqual(convertMailgunRecipientsToStrings([recipientB]));
      expect(recipientBRequestConversionResult.cc).toBeUndefined();
      expect(recipientBRequestConversionResult.bcc).toBeUndefined();
      expect(recipientBRequestConversionResult['recipient-variables']).toBeUndefined(); // no recipient variables as it should not be a batch send

      const recipientBLine1Variable = recipientBRequestConversionResult['v:line1'];
      expect(recipientBLine1Variable).toBe(line1);

      const recipientBLine2Variable = recipientBRequestConversionResult['v:line2'];
      expect(recipientBLine2Variable).toBe(line2);

      const recipientBTextVariable = recipientBRequestConversionResult['v:text'];
      expect(recipientBTextVariable).toBe(text);

      const recipientBUrlVariable = recipientBRequestConversionResult['v:url'];
      expect(recipientBUrlVariable).toBe(url);

      const recipientBTitleVariable = recipientBRequestConversionResult['v:title'];
      expect(recipientBTitleVariable).toBe(title);

      const recipientBObjectVariable = recipientBRequestConversionResult['v:object'];
      expect(recipientBObjectVariable).toBe(JSON.stringify(object));
    });
  });
});
