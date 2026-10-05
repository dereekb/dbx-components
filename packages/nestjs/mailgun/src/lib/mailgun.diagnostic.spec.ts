import { type MailgunDomainEvent } from './mailgun.type';
import { type MailgunApi } from './mailgun.api';
import { MailgunSuppressionList, bareMailgunMessageId, hasAnyMailgunRecipientSuppression, mailgunDomainEventAge, mailgunDomainEventDate, mailgunDomainEventFailureReason, mailgunEventForRecipientNear, mailgunRemoveSuppressionForRecipient } from './mailgun.diagnostic';

describe('bareMailgunMessageId()', () => {
  it('should strip the surrounding angle brackets a send response returns', () => {
    expect(bareMailgunMessageId('<20260101120000.1.abc@mail.example.com>')).toBe('20260101120000.1.abc@mail.example.com');
  });

  it('should leave an already bare message id unchanged', () => {
    expect(bareMailgunMessageId('20260101120000.1.abc@mail.example.com')).toBe('20260101120000.1.abc@mail.example.com');
  });

  it('should not strip angle brackets from the middle of the id', () => {
    expect(bareMailgunMessageId('a<b>c')).toBe('a<b>c');
  });
});

describe('hasAnyMailgunRecipientSuppression()', () => {
  it('should be false when the address is on no list', () => {
    expect(hasAnyMailgunRecipientSuppression({})).toBe(false);
  });

  it('should be true when the address has a bounce record', () => {
    expect(hasAnyMailgunRecipientSuppression({ bounce: { address: 'a@b.com', code: 550, error: 'no mailbox', created_at: new Date() } })).toBe(true);
  });

  it('should be true when the address has only an unsubscribe record', () => {
    expect(hasAnyMailgunRecipientSuppression({ unsubscribe: { address: 'a@b.com', created_at: new Date() } })).toBe(true);
  });
});

function makeTestEvent(config: Partial<MailgunDomainEvent>): MailgunDomainEvent {
  return {
    event: 'failed',
    timestamp: 1767225600, // 2026-01-01T00:00:00Z
    recipient: 'user@example.com',
    ...config
  } as MailgunDomainEvent;
}

describe('mailgunDomainEventDate()', () => {
  it('should convert the unix-seconds timestamp to a Date', () => {
    expect(mailgunDomainEventDate(makeTestEvent({ timestamp: 1767225600 })).toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('mailgunDomainEventAge()', () => {
  it('should measure the event age relative to the input time', () => {
    const event = makeTestEvent({ timestamp: 1767225600 });
    const now = new Date('2026-01-01T00:01:00.000Z');

    expect(mailgunDomainEventAge(event, now)).toBe(60 * 1000);
  });
});

describe('mailgunDomainEventFailureReason()', () => {
  it('should prefer the delivery-status description', () => {
    const event = makeTestEvent({
      reason: 'generic',
      'delivery-status': { description: 'mailbox full', message: 'smtp said no' }
    } as Partial<MailgunDomainEvent>);

    expect(mailgunDomainEventFailureReason(event)).toBe('mailbox full');
  });

  it('should fall back to the delivery-status message when there is no description', () => {
    const event = makeTestEvent({
      reason: 'generic',
      'delivery-status': { description: '', message: 'smtp said no' }
    } as Partial<MailgunDomainEvent>);

    expect(mailgunDomainEventFailureReason(event)).toBe('smtp said no');
  });

  it('should fall back to the reason when the delivery status carries nothing', () => {
    const event = makeTestEvent({ reason: 'suppress-bounce' });
    expect(mailgunDomainEventFailureReason(event)).toBe('suppress-bounce');
  });

  it('should return undefined when the event carries no explanation', () => {
    const event = makeTestEvent({ reason: '' });
    expect(mailgunDomainEventFailureReason(event)).toBeUndefined();
  });
});

// MARK: Writes
const TEST_DOMAIN = 'mail.example.com';
const TEST_ADDRESS = 'user@example.com';

describe('mailgunRemoveSuppressionForRecipient()', () => {
  function apiWithDestroy(destroy: (domain: string, list: string, address: string) => Promise<unknown>): MailgunApi {
    return { domain: TEST_DOMAIN, suppressions: { destroy } } as unknown as MailgunApi;
  }

  it('should remove the address from the requested list on the configured domain', async () => {
    const calls: string[][] = [];
    const api = apiWithDestroy((domain, list, address) => {
      calls.push([domain, list, address]);
      return Promise.resolve({ message: 'Unsubscribe event has been removed', value: '', address });
    });

    const result = await mailgunRemoveSuppressionForRecipient(api, TEST_ADDRESS, MailgunSuppressionList.UNSUBSCRIBES);

    expect(result).toEqual({ list: MailgunSuppressionList.UNSUBSCRIBES, cleared: true });
    expect(calls).toEqual([[TEST_DOMAIN, 'unsubscribes', TEST_ADDRESS]]);
  });

  it('should treat an address that is not on the list as cleared', async () => {
    const api = apiWithDestroy(() => Promise.reject(Object.assign(new Error('Address not found in unsubscribers table'), { status: 404 })));
    const result = await mailgunRemoveSuppressionForRecipient(api, TEST_ADDRESS, MailgunSuppressionList.BOUNCES);

    expect(result.cleared).toBe(true);
    expect(result.notFound).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should report any other failure as not cleared, with the error', async () => {
    const api = apiWithDestroy(() => Promise.reject(Object.assign(new Error('Forbidden'), { status: 401 })));
    const result = await mailgunRemoveSuppressionForRecipient(api, TEST_ADDRESS, MailgunSuppressionList.COMPLAINTS);

    expect(result.cleared).toBe(false);
    expect(result.notFound).toBeUndefined();
    expect(result.error).toContain('Forbidden');
  });
});

describe('mailgunEventForRecipientNear()', () => {
  const at = new Date('2026-01-01T00:00:00.000Z');
  const atSeconds = at.getTime() / 1000;

  function apiWithEvents(items: MailgunDomainEvent[], queries: Record<string, unknown>[] = []): MailgunApi {
    return {
      domain: TEST_DOMAIN,
      events: {
        get: (_domain: string, query: Record<string, unknown>) => {
          queries.push(query);
          return Promise.resolve({ items });
        }
      }
    } as unknown as MailgunApi;
  }

  it('should query a bounded range around the time for the event name and recipient', async () => {
    const queries: Record<string, unknown>[] = [];
    await mailgunEventForRecipientNear(apiWithEvents([], queries), TEST_ADDRESS, { event: 'unsubscribed', at, windowMinutes: 10 });

    expect(queries).toHaveLength(1);
    expect(queries[0]['recipient']).toBe(TEST_ADDRESS);
    expect(queries[0]['event']).toBe('unsubscribed');
    // both ends are sent, so the range is read in order without relying on the `ascending` flag
    expect(new Date(queries[0]['begin'] as string).getTime()).toBe(at.getTime() - 10 * 60 * 1000);
    expect(new Date(queries[0]['end'] as string).getTime()).toBe(at.getTime() + 10 * 60 * 1000);
    expect(queries[0]['ascending']).toBeUndefined();
  });

  it('should return the event closest to the time', async () => {
    const earlier = makeTestEvent({ event: 'unsubscribed', id: 'earlier', timestamp: atSeconds - 1200 });
    const closest = makeTestEvent({ event: 'unsubscribed', id: 'closest', timestamp: atSeconds + 2 });
    const later = makeTestEvent({ event: 'unsubscribed', id: 'later', timestamp: atSeconds + 600 });

    const result = await mailgunEventForRecipientNear(apiWithEvents([earlier, closest, later]), TEST_ADDRESS, { event: 'unsubscribed', at });

    expect(result?.id).toBe('closest');
  });

  it('should return undefined when no event is found', async () => {
    const result = await mailgunEventForRecipientNear(apiWithEvents([]), TEST_ADDRESS, { event: 'complained', at });
    expect(result).toBeUndefined();
  });
});
