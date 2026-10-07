import { describe, it, expect } from 'vitest';
import { TwilioOptOutType, twilioIncomingMessageOptOutType, twilioOptOutTypeFromString } from './webhook.twilio.optout';

describe('twilioOptOutTypeFromString()', () => {
  it('should read each opt-out type case-insensitively', () => {
    expect(twilioOptOutTypeFromString('STOP')).toBe(TwilioOptOutType.STOP);
    expect(twilioOptOutTypeFromString('start')).toBe(TwilioOptOutType.START);
    expect(twilioOptOutTypeFromString(' Help ')).toBe(TwilioOptOutType.HELP);
  });

  it('should return undefined for other values', () => {
    expect(twilioOptOutTypeFromString('UNSUBSCRIBE')).toBeUndefined();
    expect(twilioOptOutTypeFromString('')).toBeUndefined();
    expect(twilioOptOutTypeFromString(undefined)).toBeUndefined();
  });
});

describe('twilioIncomingMessageOptOutType()', () => {
  it('should prefer the OptOutType parameter', () => {
    expect(twilioIncomingMessageOptOutType({ OptOutType: TwilioOptOutType.STOP, Body: 'arrêt' })).toBe(TwilioOptOutType.STOP);
    expect(twilioIncomingMessageOptOutType({ OptOutType: TwilioOptOutType.START, Body: 'STOP' })).toBe(TwilioOptOutType.START);
  });

  it('should match the default keywords when there is no OptOutType', () => {
    expect(twilioIncomingMessageOptOutType({ Body: 'stop' })).toBe(TwilioOptOutType.STOP);
    expect(twilioIncomingMessageOptOutType({ Body: ' Unsubscribe ' })).toBe(TwilioOptOutType.STOP);
    expect(twilioIncomingMessageOptOutType({ Body: 'STOPALL' })).toBe(TwilioOptOutType.STOP);
    expect(twilioIncomingMessageOptOutType({ Body: 'unstop' })).toBe(TwilioOptOutType.START);
    expect(twilioIncomingMessageOptOutType({ Body: 'Yes' })).toBe(TwilioOptOutType.START);
    expect(twilioIncomingMessageOptOutType({ Body: 'info' })).toBe(TwilioOptOutType.HELP);
  });

  it('should only match the whole body', () => {
    expect(twilioIncomingMessageOptOutType({ Body: 'Stop please' })).toBeUndefined();
    expect(twilioIncomingMessageOptOutType({ Body: 'hello' })).toBeUndefined();
    expect(twilioIncomingMessageOptOutType({ Body: '' })).toBeUndefined();
  });

  it('should not match the default keywords when optOutTypeOnly is set', () => {
    expect(twilioIncomingMessageOptOutType({ Body: 'STOP' }, { optOutTypeOnly: true })).toBeUndefined();
    expect(twilioIncomingMessageOptOutType({ OptOutType: TwilioOptOutType.STOP, Body: 'arrêt' }, { optOutTypeOnly: true })).toBe(TwilioOptOutType.STOP);
  });
});
