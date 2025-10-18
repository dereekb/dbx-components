import { convertMailgunTemplateEmailRequestToMailgunMessageData, type MailgunTemplateEmailRequest, MAILGUN_REPLY_TO_EMAIL_HEADER_DATA_VARIABLE_KEY } from './mailgun';

const replyToEmail = 'test.support@dereekb.com';
const testEmail = 'test.components@dereekb.com';
const testEmail2 = 'test2.components@dereekb.com';
const templateName = 'test';

// provided in Environment Variables
// const apiKey = process.env['MAILGUN_SANDBOX_API_KEY'] as string;
// const domain = process.env['MAILGUN_SANDBOX_DOMAIN'] as string;

describe('convertMailgunTemplateEmailRequestToMailgunMessageData()', () => {
  describe('single recipient', () => {
    describe('templateVariables', () => {
      it('should encode the template variables properly.', () => {
        const request = {
          subject: 'Reset Your Dbx Components Password Requeset',
          replyTo: {
            email: replyToEmail
          },
          to: {
            email: testEmail,
            name: 'Test'
          },
          template: 'actiontemplate',
          templateVariables: {
            prompt: 'Reset Your Password Request - 337772',
            line1: 'A password reset was requested. Log into Dbx Components with the following temporary password to begin password reset.',
            line2: '337772',
            text: 'Log Into Dbx Components',
            url: 'https://components.dereekb.com/auth/login',
            title: 'Reset Your Password Request - 337772',
            object: {
              a: 'b'
            },
            notkept: null,
            date: new Date()
          }
        };

        const result = convertMailgunTemplateEmailRequestToMailgunMessageData({ request });

        expect(result['v:prompt']).toBe(request.templateVariables.prompt);
        expect(result['v:line1']).toBe(request.templateVariables.line1);
        expect(result['v:line2']).toBe(request.templateVariables.line2);
        expect(result['v:text']).toBe(request.templateVariables.text);
        expect(result['v:url']).toBe(request.templateVariables.url);
        expect(result['v:object']).toBe(JSON.stringify(request.templateVariables.object));
        expect(result['v:notkept']).not.toBeDefined();

        // date is saved as an ISOString
        expect(result['v:date']).toBe(request.templateVariables.date.toISOString());

        // check replyto is also set
        expect(result[MAILGUN_REPLY_TO_EMAIL_HEADER_DATA_VARIABLE_KEY]).toBe(replyToEmail);
      });
    });
  });

  describe('multiple recipients', () => {
    const overrideValue = 'o';
    const mergedValue = 'm';

    const request: MailgunTemplateEmailRequest = {
      to: [
        {
          email: testEmail,
          name: 'Test',
          userVariables: {
            value: 'a'
          }
        },
        {
          email: testEmail2,
          name: 'Test',
          userVariables: {
            value: 'b'
          }
        }
      ],
      replyTo: {
        email: replyToEmail
      },
      subject: 'test',
      template: templateName,
      templateVariables: {
        test: true,
        a: 1,
        b: 2,
        c: ['d', 'e']
      },
      messageData: {
        'recipient-variables': JSON.stringify({
          [testEmail]: {
            value: overrideValue
          },
          [testEmail2]: {
            another: mergedValue
          }
        })
      }
    };

    it('should merge recipient variables defined in the messageData.', async () => {
      const result = convertMailgunTemplateEmailRequestToMailgunMessageData({
        request,
        defaultSender: 'test.sender@dereekb.com'
      });

      expect(result['recipient-variables']).toBeDefined();

      const recipientVariables = JSON.parse(result['recipient-variables'] ?? '0');

      expect(recipientVariables[testEmail]).toBeDefined();
      expect(recipientVariables[testEmail].value).toBe(overrideValue);

      expect(recipientVariables[testEmail2].value).toBe('b');
      expect(recipientVariables[testEmail2].another).toBe(mergedValue);
    });

    it('should add the recipient variables to the data.', () => {
      const recipientVariablePrefix = 'testprefix-';

      const result = convertMailgunTemplateEmailRequestToMailgunMessageData({
        request,
        defaultSender: 'test.sender@dereekb.com',
        recipientVariablePrefix
      });

      expect(result[`v:${recipientVariablePrefix}value`]).toBe(`%recipient.value%`);
    });

    it('should add the replyTo email to the data.', () => {
      const result = convertMailgunTemplateEmailRequestToMailgunMessageData({
        request,
        defaultSender: 'test.sender@dereekb.com'
      });

      expect(result[MAILGUN_REPLY_TO_EMAIL_HEADER_DATA_VARIABLE_KEY]).toBe(replyToEmail);
    });
  });
});
