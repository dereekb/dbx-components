import { describe, expect, it } from 'vitest';
import { type ICalendarSerializeConfig, iCalendarITipContentType, unfoldIcsString } from '@dereekb/date';
import { type CalendarEventItem, type CalendarRecurringEventItem } from './calendar';
import { type CalendarEventItemToInviteConfig, calendarEventItemToInviteIcsString, calendarToIcsString } from './calendar.ics';

/**
 * The iTIP invite path. What these pin, beyond "it renders":
 *
 * - the UID is BYTE-IDENTICAL to the one the feed publishes for the same event, which is the single
 *   property that stops a recipient who is both subscribed and invited from holding the event twice;
 * - CANCEL both says CANCELLED and outranks the REQUEST that preceded it, because a cancellation a client
 *   silently ignores is worse than never having sent the invite.
 */
const NOW = new Date('2026-03-01T00:00:00.000Z');
const CALENDAR_ID = 'pr_abc123';
const DOMAIN = 'example.com';
const ORGANIZER = { address: 'calendar-invites@example.com', name: 'Example Calendar' };
const ATTENDEE = { address: 'worker@example.com', name: 'A Worker' };

function eventItem(overrides?: Partial<CalendarEventItem>): CalendarEventItem {
  return { id: 'e1', sa: new Date('2026-03-10T15:00:00.000Z'), dur: 60, n: 'A Shift', cat: NOW, uat: NOW, ...overrides };
}

function inviteLines(overrides?: Partial<CalendarEventItemToInviteConfig & ICalendarSerializeConfig>): readonly string[] {
  return unfoldIcsString(
    calendarEventItemToInviteIcsString({
      item: eventItem(),
      calendarId: CALENDAR_ID,
      domain: DOMAIN,
      organizer: ORGANIZER,
      attendees: ATTENDEE,
      now: NOW,
      ...overrides
    })
  );
}

describe('calendarEventItemToInviteIcsString()', () => {
  it('should emit a METHOD:REQUEST payload with a pre-accepted attendee and an organizer', () => {
    const lines = inviteLines();

    expect(lines).toContain('METHOD:REQUEST');
    expect(lines).toContain('ORGANIZER;CN=Example Calendar:mailto:calendar-invites@example.com');
    expect(lines.find((x) => x.startsWith('ATTENDEE'))).toBe('ATTENDEE;CN=A Worker;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:worker@example.com');
    expect(lines.filter((x) => x === 'BEGIN:VEVENT')).toHaveLength(1);
  });

  it('should emit the SAME UID the published feed emits for the same event', () => {
    const item = eventItem();
    const feedUid = unfoldIcsString(calendarToIcsString({ t: 'demo', n: 'Feed', tz: 'UTC', e: [item], r: [], cat: NOW, uat: NOW }, { calendarId: CALENDAR_ID, domain: DOMAIN, now: NOW })).find((x) => x.startsWith('UID:'));

    expect(feedUid).toBeDefined();
    expect(inviteLines({ item })).toContain(feedUid as string);
  });

  it('should carry the stored revision counter as SEQUENCE', () => {
    expect(inviteLines({ item: eventItem({ q: 3 }) })).toContain('SEQUENCE:3');
  });

  it('should mark a CANCEL as CANCELLED and outrank the REQUEST it withdraws', () => {
    const lines = inviteLines({ item: eventItem({ q: 3 }), method: 'CANCEL' });

    expect(lines).toContain('METHOD:CANCEL');
    expect(lines).toContain('STATUS:CANCELLED');
    // a CANCEL sharing the last REQUEST's sequence is silently ignored by clients
    expect(lines).toContain('SEQUENCE:4');
  });

  it('should honour an explicit sequence over the stored one', () => {
    expect(inviteLines({ item: eventItem({ q: 3 }), method: 'CANCEL', sequence: 9 })).toContain('SEQUENCE:9');
  });

  it('should emit a recurring event as a single rule-bearing VEVENT', () => {
    const item: CalendarRecurringEventItem = { ...eventItem(), rr: 'RRULE:FREQ=WEEKLY;BYDAY=MO' };
    const lines = inviteLines({ item });

    expect(lines.filter((x) => x === 'BEGIN:VEVENT')).toHaveLength(1);
    expect(lines).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO');
  });

  it('should throw when given neither a uidFactory nor a domain', () => {
    expect(() => calendarEventItemToInviteIcsString({ item: eventItem(), calendarId: CALENDAR_ID, organizer: ORGANIZER, attendees: ATTENDEE, now: NOW })).toThrow();
  });
});

describe('iCalendarITipContentType()', () => {
  it('should carry the method, which is what makes a client treat the part as an invitation', () => {
    expect(iCalendarITipContentType('REQUEST')).toBe('text/calendar; method=REQUEST; charset=utf-8');
    expect(iCalendarITipContentType('CANCEL')).toBe('text/calendar; method=CANCEL; charset=utf-8');
  });
});
