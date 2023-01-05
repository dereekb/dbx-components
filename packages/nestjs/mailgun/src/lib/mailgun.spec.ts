import { convertMailgunTemplateEmailRequestToMailgunMessageData } from './mailgun';

const testEmail = 'test.components@dereekb.com';
const testEmail2 = 'test2.components@dereekb.com';
const templateName = 'test';

// provided in Environment Variables
// TODO: Don't commit these values!
const apiKey = 'key-d7e36a9ead3fdb61983587832bd75b42'; // process.env['MAILGUN_SANDBOX_API_KEY'] as string;
const domain = 'sandboxac03c39a759d4cf1b3511eb72715b996.mailgun.org' ?? (process.env['MAILGUN_SANDBOX_DOMAIN'] as string);

describe('convertMailgunTemplateEmailRequestToMailgunMessageData()', () => {
  describe('single recipient', () => {
    describe('templateVariables', () => {
      it('should encode the template variables properly.', () => {
        const request = {
          subject: 'Reset Your Dbx Components Password Requeset',
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
      });
    });
  });

  describe('multiple recipients', () => {
    const overrideValue = 'o';
    const mergedValue = 'm';

    const request = {
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
  });
});
