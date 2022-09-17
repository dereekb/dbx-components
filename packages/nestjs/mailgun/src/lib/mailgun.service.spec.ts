import { MailgunApi } from './mailgun.api';
import { MailgunServiceConfig } from './mailgun.config';
import { MailgunService } from './mailgun.service';

const testEmail = 'test.components@dereekb.com';
const templateName = 'test';

// provided in Environment Variables
const apiKey = process.env['MAILGUN_SANDBOX_API_KEY'] as string;
const domain = process.env['MAILGUN_SANDBOX_DOMAIN'] as string;

describe('MailgunService', () => {
  let mailgunConfig: MailgunServiceConfig;
  let mailgunApi: MailgunApi;
  let mailgunService: MailgunService;

  beforeEach(() => {
    mailgunConfig = {
      mailgun: {
        username: 'api',
        key: apiKey
      },
      domain,
      sender: `Mailgun Sandbox <postmaster@${domain}>`
    };
    mailgunApi = new MailgunApi(mailgunConfig);
    mailgunService = new MailgunService(mailgunApi);
  });

  describe('sendTemplateEmail()', () => {
    it('should send a test email.', async () => {
      const result = await mailgunService.sendTemplateEmail({
        to: {
          email: testEmail
        },
        subject: 'test',
        template: templateName,
        testEmail: true,
        templateVariables: {
          test: true,
          a: 1,
          b: 2,
          c: ['d', 'e']
        }
      });

      expect(result.status).toBe(200);
    });
  });
});
