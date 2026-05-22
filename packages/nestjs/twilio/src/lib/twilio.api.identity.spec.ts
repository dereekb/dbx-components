import { describe, it, expect, beforeAll } from 'vitest';
import { TwilioApi } from './twilio.api';
import { TwilioServiceConfig } from './twilio.config';
import { type TwilioPhoneNumber } from './twilio.type';

// Treat the placeholder values shipped in the committed `.env` as "no credentials".
function real(value: string | undefined): string | undefined {
  return value && value !== 'placeholder' ? value : undefined;
}

const accountSid = real(process.env['TWILIO_ACCOUNT_SID']);
const authToken = real(process.env['TWILIO_AUTH_TOKEN']);
const apiKeySid = real(process.env['TWILIO_API_KEY_SID']);
const apiKeySecret = real(process.env['TWILIO_API_KEY_SECRET']);
const phoneNumber = real(process.env['TWILIO_PHONE_NUMBER']);
const messagingServiceSid = real(process.env['TWILIO_MESSAGING_SERVICE_SID']);

const SETUP_HINT = 'Set real values for the required vars (or run with `TWILIO_SANDBOX=true` for unit work). See packages/nestjs/twilio/SETUP.md.';

/**
 * Identity check against the live Twilio API.
 *
 * This deliberately does NOT skip when credentials are missing — silent skipping would
 * hide setup issues. Running this suite without real Twilio credentials is expected to
 * fail in `beforeAll` with a setup-error pointing at SETUP.md. The accompanying unit
 * tests in this package continue to pass independently.
 */
describe('TwilioApi identity check (live API)', () => {
  let twilioApi: TwilioApi;

  beforeAll(() => {
    if (!accountSid) {
      throw new Error(`TWILIO_ACCOUNT_SID is missing or still set to "placeholder". ${SETUP_HINT}`);
    } else if (!accountSid.startsWith('AC')) {
      throw new Error(`TWILIO_ACCOUNT_SID does not look like a real Twilio Account SID (must start with "AC"). ${SETUP_HINT}`);
    }

    if (!authToken && !(apiKeySid && apiKeySecret)) {
      throw new Error(`TWILIO_AUTH_TOKEN (or TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET) is missing or "placeholder". ${SETUP_HINT}`);
    }

    if (!phoneNumber && !messagingServiceSid) {
      throw new Error(`TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID must be set to a real value. ${SETUP_HINT}`);
    }

    const config: TwilioServiceConfig = {
      twilio: {
        accountSid,
        authToken,
        apiKeySid,
        apiKeySecret
      },
      messages: {
        defaultFrom: phoneNumber as TwilioPhoneNumber | undefined,
        messagingServiceSid,
        sandbox: false
      }
    };

    TwilioServiceConfig.assertValidConfig(config);
    twilioApi = new TwilioApi(config);
  });

  it('fetches the configured account and the SID matches', async () => {
    const account = await twilioApi.client.api.v2010.accounts(accountSid as string).fetch();
    expect(account.sid).toBe(accountSid);
    expect(account.status).toBeDefined();
  }, 15000);
});
