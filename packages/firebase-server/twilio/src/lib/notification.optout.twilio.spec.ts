import { describe, it, expect, vi } from 'vitest';
import { NotificationUserTextOptOutType } from '@dereekb/firebase';
import { type ApplyNotificationUserTextOptOutParams, type ApplyNotificationUserTextOptOutResult } from '@dereekb/firebase-server/model';
import { type TwilioIncomingMessagePayload, TwilioOptOutType } from '@dereekb/nestjs/twilio';
import { twilioNotificationTextOptOutHandler } from './notification.optout.twilio';

const PHONE = '+15555550100';

function makePayload(overrides: Partial<TwilioIncomingMessagePayload> = {}): TwilioIncomingMessagePayload {
  return { MessageSid: 'SM123', AccountSid: 'AC123', From: PHONE, To: '+15555550456', Body: '', NumMedia: 0, mediaUrls: [], raw: {}, ...overrides };
}

function makeHandler(optOutTypeOnly?: boolean) {
  const applyNotificationUserTextOptOut = vi.fn(async (params: ApplyNotificationUserTextOptOutParams): Promise<ApplyNotificationUserTextOptOutResult> => ({ ...params, notificationUserIds: ['u'] }));
  const handler = twilioNotificationTextOptOutHandler({ notificationServerActions: { applyNotificationUserTextOptOut }, optOutTypeOnly });
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
});
