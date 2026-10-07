import { describe, it, expect } from 'vitest';
import { type TwilioApi } from './twilio.api';
import { type TwilioPhoneNumber } from './twilio.type';
import { isTwilioDiagnosticPermissionError, twilioAccountState, twilioDiagnosticMessage, twilioErrorCode, twilioLookupPhoneNumberForDiagnosis, twilioMessageForSid, twilioRecentMessagesForRecipient } from './twilio.diagnostic';

const TEST_NUMBER = '+15555550100' as TwilioPhoneNumber;
const TEST_SID = 'SM00000000000000000000000000000001';

function twilioRestError(status: number, code?: number): Error {
  return Object.assign(new Error(`status ${status}`), { status, code });
}

function rejecting(error: Error) {
  return async () => {
    throw error;
  };
}

function twilioApi(client: Record<string, unknown>): TwilioApi {
  return { client } as unknown as TwilioApi;
}

describe('twilioDiagnosticMessage()', () => {
  it('should normalize the null values Twilio returns', () => {
    const message = twilioDiagnosticMessage({ sid: TEST_SID, status: 'delivered', to: TEST_NUMBER, errorCode: null, errorMessage: null, dateSent: null, dateCreated: null, dateUpdated: null });
    expect(message).toEqual({ sid: TEST_SID, status: 'delivered', to: TEST_NUMBER, errorCode: undefined, errorMessage: undefined, dateSent: undefined, dateCreated: undefined, dateUpdated: undefined });
  });
});

describe('twilioErrorCode()', () => {
  it('should read the code of a Twilio error', () => {
    expect(twilioErrorCode(twilioRestError(400, 21610))).toBe(21610);
    expect(twilioErrorCode(new Error('plain'))).toBeUndefined();
    expect(twilioErrorCode(undefined)).toBeUndefined();
  });
});

describe('twilioRecentMessagesForRecipient()', () => {
  it('should read the messages sent to the number', async () => {
    const queries: unknown[] = [];
    const api = twilioApi({
      messages: {
        list: async (query: unknown) => {
          queries.push(query);
          return [{ sid: TEST_SID, status: 'delivered', to: TEST_NUMBER }];
        }
      }
    });

    const result = await twilioRecentMessagesForRecipient(api, TEST_NUMBER, { limit: 5 });

    expect(result.unknown).toBeUndefined();
    expect(result.messages.map((x) => x.sid)).toEqual([TEST_SID]);
    expect(queries).toEqual([{ to: TEST_NUMBER, limit: 5 }]);
  });

  it('should report unreadable messages as unknown', async () => {
    const api = twilioApi({ messages: { list: rejecting(twilioRestError(500)) } });
    expect(await twilioRecentMessagesForRecipient(api, TEST_NUMBER)).toEqual({ messages: [], unknown: true, error: { message: 'status 500', status: 500, code: undefined } });
  });
});

describe('twilioMessageForSid()', () => {
  function apiWithFetch(fetch: () => Promise<unknown>): TwilioApi {
    return twilioApi({ messages: () => ({ fetch }) });
  }

  it('should read the message', async () => {
    const result = await twilioMessageForSid(
      apiWithFetch(async () => ({ sid: TEST_SID, status: 'sent', to: TEST_NUMBER })),
      TEST_SID
    );

    expect(result.message?.status).toBe('sent');
  });

  it('should report a message that does not exist as missing, not unknown', async () => {
    expect(await twilioMessageForSid(apiWithFetch(rejecting(twilioRestError(404))), TEST_SID)).toEqual({});
  });

  it('should report an unreadable message as unknown', async () => {
    expect(await twilioMessageForSid(apiWithFetch(rejecting(twilioRestError(503))), TEST_SID)).toEqual({ unknown: true, error: { message: 'status 503', status: 503, code: undefined } });
  });
});

describe('twilioAccountState()', () => {
  it('should read the account status', async () => {
    const api = twilioApi({ api: { v2010: { account: { fetch: async () => ({ status: 'active' }) } } } });
    expect(await twilioAccountState(api)).toEqual({ status: 'active' });
  });

  it('should report an unreadable account as unknown, with why', async () => {
    const api = twilioApi({ api: { v2010: { account: { fetch: rejecting(twilioRestError(403, 20003)) } } } });
    const state = await twilioAccountState(api);

    expect(state).toEqual({ unknown: true, error: { message: 'status 403', status: 403, code: 20003 } });
    expect(isTwilioDiagnosticPermissionError(state.error)).toBe(true);
  });
});

describe('twilioLookupPhoneNumberForDiagnosis()', () => {
  function apiWithLookup(fetch: (params: unknown) => Promise<unknown>): TwilioApi {
    return twilioApi({ lookups: { v2: { phoneNumbers: () => ({ fetch }) } } });
  }

  it('should read the line type when requested', async () => {
    const fetchParams: unknown[] = [];
    const api = apiWithLookup(async (params) => {
      fetchParams.push(params);
      return { valid: true, lineTypeIntelligence: { type: 'landline', carrier_name: 'Example Telco' } };
    });

    expect(await twilioLookupPhoneNumberForDiagnosis(api, TEST_NUMBER, true)).toEqual({ valid: true, lineType: 'landline', carrierName: 'Example Telco' });
    expect(fetchParams).toEqual([{ fields: 'line_type_intelligence' }]);
  });

  it('should report a failed lookup as unknown rather than invalid', async () => {
    expect((await twilioLookupPhoneNumberForDiagnosis(apiWithLookup(rejecting(twilioRestError(500))), TEST_NUMBER)).unknown).toBe(true);
  });
});
