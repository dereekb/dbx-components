import { describe, expect, it } from 'vitest';
import { type NotificationMessageCalendarAttachment } from '@dereekb/firebase';
import { notificationMessageCalendarAttachmentToMailgunFileAttachment } from './notification.send.service.mailgun';

// The contentType is the entire point of this bridge: the same bytes under Mailgun's default part type
// arrive as a paperclip rather than an invitation, so it is pinned here explicitly.
const ICS = 'BEGIN:VCALENDAR\r\nMETHOD:REQUEST\r\nEND:VCALENDAR\r\n';

describe('notificationMessageCalendarAttachmentToMailgunFileAttachment()', () => {
  it('should type the part with the payload method, so a client processes it as an invitation', () => {
    const attachment: NotificationMessageCalendarAttachment = { ics: ICS, method: 'REQUEST', filename: 'invite.ics' };

    expect(notificationMessageCalendarAttachmentToMailgunFileAttachment(attachment)).toEqual({
      filename: 'invite.ics',
      data: ICS,
      contentType: 'text/calendar; method=REQUEST; charset=utf-8'
    });
  });

  it('should carry a CANCEL method through to the part type', () => {
    expect(notificationMessageCalendarAttachmentToMailgunFileAttachment({ ics: ICS, method: 'CANCEL', filename: 'cancel.ics' }).contentType).toBe('text/calendar; method=CANCEL; charset=utf-8');
  });

  it('should default the filename when the payload carries none', () => {
    expect(notificationMessageCalendarAttachmentToMailgunFileAttachment({ ics: ICS, method: 'REQUEST' }).filename).toBe('invite.ics');
  });
});
