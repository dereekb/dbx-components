import { convertMailgunTemplateEmailRequestToMailgunMessageData, flattenMailgunRecipientVariableLineBreaks, type MailgunTemplateEmailRequest, MAILGUN_REPLY_TO_EMAIL_HEADER_DATA_VARIABLE_KEY } from './mailgun';

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
          subject: 'Reset Your Dbx Components Password Request',
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

    describe('line breaks', () => {
      const lineBreakRequest: MailgunTemplateEmailRequest = {
        to: [
          {
            email: testEmail,
            userVariables: {
              line1: '\nYou have been invited to join the\r\nTest School Group.',
              subject: 'Invited to\nJoin',
              count: 2
            }
          },
          {
            email: testEmail2,
            userVariables: {
              line1: 'No line breaks here.'
            }
          }
        ],
        subject: '%recipient.subject%',
        template: templateName
      };

      it('should flatten line breaks in the batch recipient variables.', () => {
        // Mailgun substitutes %recipient.<key>% into the X-Mailgun-Variables header unescaped, so a raw line break ends the header block early
        const result = convertMailgunTemplateEmailRequestToMailgunMessageData({ request: lineBreakRequest, defaultSender: 'test.sender@dereekb.com' });
        const recipientVariables = JSON.parse(result['recipient-variables'] ?? '0');

        expect(recipientVariables[testEmail].line1).toBe('You have been invited to join the Test School Group.');
        expect(recipientVariables[testEmail].subject).toBe('Invited to Join');
        expect(recipientVariables[testEmail].count).toBe(2);
        expect(recipientVariables[testEmail2].line1).toBe('No line breaks here.');
      });

      it('should flatten line breaks returned by finalizeRecipientVariables.', () => {
        const result = convertMailgunTemplateEmailRequestToMailgunMessageData({
          request: {
            ...lineBreakRequest,
            finalizeRecipientVariables: (recipientVariables) => ({ ...recipientVariables, [testEmail2]: { ...recipientVariables[testEmail2], line2: 'Added\nlate.' } })
          },
          defaultSender: 'test.sender@dereekb.com'
        });

        const recipientVariables = JSON.parse(result['recipient-variables'] ?? '0');
        expect(recipientVariables[testEmail2].line2).toBe('Added late.');
      });

      it('should keep html line break tags in the batch recipient variables.', () => {
        const line1html = 'Hi Test,<br><br>You have 2 requirements left:<br>- One<br>- Two';
        const result = convertMailgunTemplateEmailRequestToMailgunMessageData({ request: { ...lineBreakRequest, to: [{ email: testEmail, userVariables: { line1html } }] }, defaultSender: 'test.sender@dereekb.com' });
        const recipientVariables = JSON.parse(result['recipient-variables'] ?? '0');

        expect(recipientVariables[testEmail].line1html).toBe(line1html);
      });

      it('should keep line breaks in the template variables of a batch send.', () => {
        // template variables are sent as v: values, which Mailgun encodes itself rather than substituting per recipient
        const result = convertMailgunTemplateEmailRequestToMailgunMessageData({ request: { ...lineBreakRequest, templateVariables: { footer: 'Line one.\nLine two.' } }, defaultSender: 'test.sender@dereekb.com' });
        expect(result['v:footer']).toBe('Line one.\nLine two.');
      });

      it('should keep line breaks when the recipient variables are merged into the global variables.', () => {
        // Mailgun encodes the v: variables it receives directly, so only the batch send path needs flattening
        const result = convertMailgunTemplateEmailRequestToMailgunMessageData({ request: { ...lineBreakRequest, batchSend: false }, defaultSender: 'test.sender@dereekb.com' });
        expect(result['v:recipient-subject']).toBe('Invited to\nJoin');
      });
    });
  });
});

describe('flattenMailgunRecipientVariableLineBreaks()', () => {
  it('should replace each run of whitespace containing a line break with a single space.', () => {
    expect(flattenMailgunRecipientVariableLineBreaks({ a: 'one\n\n  two\r\nthree\rfour' })).toEqual({ a: 'one two three four' });
  });

  it('should trim line breaks from the start and end of a string.', () => {
    expect(flattenMailgunRecipientVariableLineBreaks({ a: '\n  text \n' })).toEqual({ a: 'text' });
  });

  it('should not change strings without a line break.', () => {
    expect(flattenMailgunRecipientVariableLineBreaks({ a: ' padded ', b: '' })).toEqual({ a: ' padded ', b: '' });
  });

  it('should not change non-string values.', () => {
    const object = { nested: 'a\nb' };
    expect(flattenMailgunRecipientVariableLineBreaks({ a: 1, b: true, c: object, d: null })).toEqual({ a: 1, b: true, c: object, d: null });
  });
});
