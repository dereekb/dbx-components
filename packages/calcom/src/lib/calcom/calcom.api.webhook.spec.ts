import { describe, it, expect } from 'vitest';
import { timeDurationToMilliseconds, MS_IN_MINUTE, MS_IN_HOUR, MS_IN_DAY, type Milliseconds } from '@dereekb/util';
import { ALL_CALCOM_WEBHOOK_TIME_UNITS, CALCOM_WEBHOOK_TIME_UNIT_TIME_UNIT_MAP, calcomWebhookTimeOffsetFromWebhook, calcomWebhookTimeOffsetToTimeDuration, type CalcomWebhook, type CalcomWebhookTimeUnit } from './calcom.api.webhook';

/**
 * The milliseconds each CalcomWebhookTimeUnit is expected to convert to.
 */
const EXPECTED_MS_FOR_TIME_UNIT: Readonly<Record<CalcomWebhookTimeUnit, Milliseconds>> = {
  MINUTE: MS_IN_MINUTE,
  HOUR: MS_IN_HOUR,
  DAY: MS_IN_DAY
};

describe('CALCOM_WEBHOOK_TIME_UNIT_TIME_UNIT_MAP', () => {
  it('should map every CalcomWebhookTimeUnit to a util TimeUnit', () => {
    expect(Object.keys(CALCOM_WEBHOOK_TIME_UNIT_TIME_UNIT_MAP).sort()).toEqual([...ALL_CALCOM_WEBHOOK_TIME_UNITS].sort());
  });

  it('should map the uppercase Cal.com units to their lowercase util equivalents', () => {
    expect(CALCOM_WEBHOOK_TIME_UNIT_TIME_UNIT_MAP).toEqual({ MINUTE: 'min', HOUR: 'h', DAY: 'd' });
  });
});

describe('calcomWebhookTimeOffsetToTimeDuration()', () => {
  it('should convert an offset to a TimeDuration', () => {
    expect(calcomWebhookTimeOffsetToTimeDuration({ time: 5, timeUnit: 'MINUTE' })).toEqual({ amount: 5, unit: 'min' });
  });

  it('should produce a duration each unit converts to milliseconds correctly', () => {
    ALL_CALCOM_WEBHOOK_TIME_UNITS.forEach((timeUnit) => {
      const duration = calcomWebhookTimeOffsetToTimeDuration({ time: 3, timeUnit });
      expect(timeDurationToMilliseconds(duration)).toBe(3 * EXPECTED_MS_FOR_TIME_UNIT[timeUnit]);
    });
  });
});

describe('calcomWebhookTimeOffsetFromWebhook()', () => {
  it('should read the offset when both halves are present', () => {
    expect(calcomWebhookTimeOffsetFromWebhook({ time: 2, timeUnit: 'HOUR' })).toEqual({ time: 2, timeUnit: 'HOUR' });
  });

  it('should return undefined when the webhook has no offset', () => {
    expect(calcomWebhookTimeOffsetFromWebhook({ time: null, timeUnit: null })).toBeUndefined();
  });

  it('should return undefined when only one half is present', () => {
    expect(calcomWebhookTimeOffsetFromWebhook({ time: 5, timeUnit: null })).toBeUndefined();
    expect(calcomWebhookTimeOffsetFromWebhook({ time: null, timeUnit: 'MINUTE' })).toBeUndefined();
  });

  it('should read the offset off a full webhook', () => {
    const webhook = { time: 10, timeUnit: 'DAY' } as CalcomWebhook;
    expect(calcomWebhookTimeOffsetFromWebhook(webhook)).toEqual({ time: 10, timeUnit: 'DAY' });
  });
});
