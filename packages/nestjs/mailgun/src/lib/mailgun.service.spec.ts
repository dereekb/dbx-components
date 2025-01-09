import { ServerEnvironmentService } from '@dereekb/nestjs';
import { MailgunFileAttachment } from './mailgun';
import { MailgunApi } from './mailgun.api';
import { MailgunServiceConfig } from './mailgun.config';
import { MailgunService } from './mailgun.service';

const testEmail = 'test.components@dereekb.com';
const testEmail2 = 'test2.components@dereekb.com';
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
      clientUrl: domain,
      sender: `Mailgun Sandbox <postmaster@${domain}>`,
      messages: {}
    };
    mailgunApi = new MailgunApi(mailgunConfig);
    mailgunService = new MailgunService(mailgunApi, { isTestingEnv: true, isProduction: false, isStaging: false, developerToolsEnabled: false } as ServerEnvironmentService);
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

    describe('attachments', () => {
      it('should send an attachment', async () => {
        const textFileAttachment: MailgunFileAttachment = {
          filename: 'test.txt',
          data: 'helloworld'
        };

        const result = await mailgunService.sendTemplateEmail({
          to: {
            email: testEmail,
            userVariables: {
              value: 'a'
            }
          },
          subject: 'test',
          template: templateName,
          testEmail: true,
          templateVariables: {
            test: true,
            a: 1,
            b: 2,
            c: ['d', 'e']
          },
          attachments: textFileAttachment
        });

        expect(result.status).toBe(200);
      });
    });

    describe('multiple recipients', () => {
      it('should send a test email to multiple recipients.', async () => {
        const result = await mailgunService.sendTemplateEmail({
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
});
