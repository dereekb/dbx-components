import { type MailgunDomainEvent } from './mailgun.type';
import { bareMailgunMessageId, hasAnyMailgunRecipientSuppression, mailgunDomainEventAge, mailgunDomainEventDate, mailgunDomainEventFailureReason } from './mailgun.diagnostic';

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
