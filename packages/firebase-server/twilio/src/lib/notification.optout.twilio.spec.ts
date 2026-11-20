import { describe, it, expect, vi, afterEach } from 'vitest';
import { Logger } from '@nestjs/common';
import { NotificationUserTextOptOutType } from '@dereekb/firebase';
import { type ApplyNotificationUserTextOptOutParams, type ApplyNotificationUserTextOptOutResult } from '@dereekb/firebase-server/model';
import { type TwilioIncomingMessagePayload, TwilioOptOutType } from '@dereekb/nestjs/twilio';
import { type TwilioTextKeywordHandler, twilioNotificationTextOptOutHandler } from './notification.optout.twilio';

const PHONE = '+15555550100';

function makePayload(overrides: Partial<TwilioIncomingMessagePayload> = {}): TwilioIncomingMessagePayload {
  return { MessageSid: 'SM123', AccountSid: 'AC123', From: PHONE, To: '+15555550456', Body: '', NumMedia: 0, mediaUrls: [], raw: {}, ...overrides };
}

function makeHandler(optOutTypeOnly?: boolean, onTextKeyword?: TwilioTextKeywordHandler) {
  const applyNotificationUserTextOptOut = vi.fn(async (params: ApplyNotificationUserTextOptOutParams): Promise<ApplyNotificationUserTextOptOutResult> => ({ ...params, notificationUserIds: ['u'] }));
  const handler = twilioNotificationTextOptOutHandler({ notificationServerActions: { applyNotificationUserTextOptOut }, optOutTypeOnly, onTextKeyword });
  return { handler, applyNotificationUserTextOptOut };
}

describe('twilioNotificationTextOptOutHandler()', () => {
  it('should apply a STOP from the OptOutType parameter', async () => {
    const { handler, applyNotificationUserTextOptOut } = makeHandler();
    const result = await handler(makePayload({ Body: 'arrêt', OptOutType: TwilioOptOutType.STOP }));

    expect(applyNotificationUserTextOptOut).toHaveBeenCalledWith({ phoneNumber: PHONE, type: NotificationUserTextOptOutType.STOP });
    expect(result.optOutType).toBe(TwilioOptOutType.STOP);
    expect(result.applied?.notificationUserIds).toEqual(['u']);
  });

  it('should apply a START matched from the body', async () => {
    const { handler, applyNotificationUserTextOptOut } = makeHandler();
    await handler(makePayload({ Body: 'start' }));

    expect(applyNotificationUserTextOptOut).toHaveBeenCalledWith({ phoneNumber: PHONE, type: NotificationUserTextOptOutType.START });
  });

  it('should do nothing for HELP', async () => {
    const { handler, applyNotificationUserTextOptOut } = makeHandler();
    const result = await handler(makePayload({ Body: 'HELP' }));

    expect(applyNotificationUserTextOptOut).not.toHaveBeenCalled();
    expect(result.optOutType).toBe(TwilioOptOutType.HELP);
    expect(result.applied).toBeUndefined();
  });

  it('should do nothing for a message that is not a keyword', async () => {
    const { handler, applyNotificationUserTextOptOut } = makeHandler();
    const result = await handler(makePayload({ Body: 'Stop please' }));

    expect(applyNotificationUserTextOptOut).not.toHaveBeenCalled();
    expect(result.optOutType).toBeUndefined();
  });

  it('should only trust OptOutType when optOutTypeOnly is set', async () => {
    const { handler, applyNotificationUserTextOptOut } = makeHandler(true);
    await handler(makePayload({ Body: 'STOP' }));

    expect(applyNotificationUserTextOptOut).not.toHaveBeenCalled();
  });

  it('should ignore a sender that is not an E.164 phone number', async () => {
    const { handler, applyNotificationUserTextOptOut } = makeHandler();
    await handler(makePayload({ From: 'whatsapp:+15555550100', Body: 'STOP' }));

    expect(applyNotificationUserTextOptOut).not.toHaveBeenCalled();
  });

  it('should propagate errors', async () => {
    const applyNotificationUserTextOptOut = vi.fn(async (): Promise<ApplyNotificationUserTextOptOutResult> => {
      throw new Error('failed');
    });

    const handler = twilioNotificationTextOptOutHandler({ notificationServerActions: { applyNotificationUserTextOptOut } });
    await expect(handler(makePayload({ Body: 'STOP' }))).rejects.toThrow('failed');
  });

  describe('onTextKeyword', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should be called with the applied STOP after it is applied', async () => {
      const onTextKeyword = vi.fn<TwilioTextKeywordHandler>();
      const { handler, applyNotificationUserTextOptOut } = makeHandler(undefined, onTextKeyword);
      const payload = makePayload({ Body: 'STOP' });
      const result = await handler(payload);

      expect(onTextKeyword).toHaveBeenCalledTimes(1);
      expect(onTextKeyword).toHaveBeenCalledWith({ type: TwilioOptOutType.STOP, payload, applied: result.applied });
      expect(result.applied).toBeDefined();
      expect(onTextKeyword.mock.invocationCallOrder[0]).toBeGreaterThan(applyNotificationUserTextOptOut.mock.invocationCallOrder[0]);
    });

    it('should be called with the applied START', async () => {
      const onTextKeyword = vi.fn<TwilioTextKeywordHandler>();
      const { handler } = makeHandler(undefined, onTextKeyword);
      const result = await handler(makePayload({ Body: 'START' }));

      expect(onTextKeyword).toHaveBeenCalledTimes(1);
      expect(onTextKeyword.mock.calls[0][0].type).toBe(TwilioOptOutType.START);
      expect(onTextKeyword.mock.calls[0][0].applied).toBe(result.applied);
      expect(result.applied?.type).toBe(NotificationUserTextOptOutType.START);
    });

    it('should be called for HELP without an applied opt-out', async () => {
      const onTextKeyword = vi.fn<TwilioTextKeywordHandler>();
      const { handler, applyNotificationUserTextOptOut } = makeHandler(undefined, onTextKeyword);
      await handler(makePayload({ Body: 'HELP' }));

      expect(applyNotificationUserTextOptOut).not.toHaveBeenCalled();
      expect(onTextKeyword).toHaveBeenCalledTimes(1);
      expect(onTextKeyword.mock.calls[0][0].type).toBe(TwilioOptOutType.HELP);
      expect(onTextKeyword.mock.calls[0][0].applied).toBeUndefined();
    });

    it('should not be called for a message that is not a keyword', async () => {
      const onTextKeyword = vi.fn<TwilioTextKeywordHandler>();
      const { handler } = makeHandler(undefined, onTextKeyword);
      await handler(makePayload({ Body: 'Stop please' }));

      expect(onTextKeyword).not.toHaveBeenCalled();
    });

    it('should not be called for a body-only keyword when optOutTypeOnly is set', async () => {
      const onTextKeyword = vi.fn<TwilioTextKeywordHandler>();
      const { handler } = makeHandler(true, onTextKeyword);
      await handler(makePayload({ Body: 'STOP' }));

      expect(onTextKeyword).not.toHaveBeenCalled();
    });

    it('should be called without an applied opt-out for a STOP from a sender that is not an E.164 phone number', async () => {
      const onTextKeyword = vi.fn<TwilioTextKeywordHandler>();
      const { handler, applyNotificationUserTextOptOut } = makeHandler(undefined, onTextKeyword);
      await handler(makePayload({ From: 'whatsapp:+15555550100', Body: 'STOP' }));

      expect(applyNotificationUserTextOptOut).not.toHaveBeenCalled();
      expect(onTextKeyword).toHaveBeenCalledTimes(1);
      expect(onTextKeyword.mock.calls[0][0].applied).toBeUndefined();
    });

    it('should contain and log an async error without the phone number', async () => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const { handler } = makeHandler(undefined, async () => {
        throw new Error('analytics failed');
      });

      const result = await handler(makePayload({ Body: 'STOP' }));

      expect(result.optOutType).toBe(TwilioOptOutType.STOP);
      expect(result.applied?.notificationUserIds).toEqual(['u']);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(warn.mock.calls[0].map((x) => (x instanceof Error ? x.message : x)))).not.toContain(PHONE);
    });

    it('should contain and log a synchronously thrown error', async () => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const { handler } = makeHandler(undefined, () => {
        throw new Error('analytics failed');
      });

      const result = await handler(makePayload({ Body: 'HELP' }));

      expect(result.optOutType).toBe(TwilioOptOutType.HELP);
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('should not be called when applying the opt-out throws', async () => {
      const onTextKeyword = vi.fn<TwilioTextKeywordHandler>();
      const applyNotificationUserTextOptOut = vi.fn(async (): Promise<ApplyNotificationUserTextOptOutResult> => {
        throw new Error('failed');
      });

      const handler = twilioNotificationTextOptOutHandler({ notificationServerActions: { applyNotificationUserTextOptOut }, onTextKeyword });

      await expect(handler(makePayload({ Body: 'STOP' }))).rejects.toThrow('failed');
      expect(onTextKeyword).not.toHaveBeenCalled();
    });
  });
});
