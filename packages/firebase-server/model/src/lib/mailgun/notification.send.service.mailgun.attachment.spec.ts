import { describe, expect, it } from 'vitest';
import { type NotificationMessage, type NotificationMessageCalendarAttachment, type NotificationMessageCalendarAttachmentFactory } from '@dereekb/firebase';
import { mailgunCalendarFileAttachmentForNotificationMessage, notificationMessageCalendarAttachmentToMailgunFileAttachment } from './notification.send.service.mailgun.attachment';

// The contentType is the entire point of this bridge: the same bytes under Mailgun's default part type
// arrive as a paperclip rather than an invitation, so it is pinned here explicitly.
const ICS = 'BEGIN:VCALENDAR\r\nMETHOD:REQUEST\r\nEND:VCALENDAR\r\n';

const RECIPIENT = { email: 'attendee@components.dereekb.com', name: 'Attendee' };

function messageWithCalendarAttachmentFactory(calendarAttachmentFactory: NotificationMessageCalendarAttachmentFactory): NotificationMessage {
  return {
    inputContext: { recipient: { e: RECIPIENT.email } },
    content: { title: 'Invite' },
    emailContent: { title: 'Invite', calendarAttachmentFactory }
  };
}

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

describe('mailgunCalendarFileAttachmentForNotificationMessage()', () => {
  it('should render the message factory for the resolved recipient', async () => {
    // the recipient's own address must reach the factory: a REQUEST is only rendered inline by a client
    // that finds ITS OWN address in the ATTENDEE
    const message = messageWithCalendarAttachmentFactory(({ recipient }) => ({ ics: `${ICS}ATTENDEE:mailto:${recipient.email}\r\n`, method: 'REQUEST' }));

    const attachment = await mailgunCalendarFileAttachmentForNotificationMessage({ message, recipient: RECIPIENT });

    expect(attachment?.data).toBe(`${ICS}ATTENDEE:mailto:${RECIPIENT.email}\r\n`);
    expect(attachment?.contentType).toBe('text/calendar; method=REQUEST; charset=utf-8');
  });

  it('should await an async factory', async () => {
    const message = messageWithCalendarAttachmentFactory(async () => ({ ics: ICS, method: 'PUBLISH' }));

    expect((await mailgunCalendarFileAttachmentForNotificationMessage({ message, recipient: RECIPIENT }))?.contentType).toBe('text/calendar; method=PUBLISH; charset=utf-8');
  });

  it('should return undefined when the factory declines the recipient, so the recipient is batched normally', async () => {
    const message = messageWithCalendarAttachmentFactory(() => undefined);

    expect(await mailgunCalendarFileAttachmentForNotificationMessage({ message, recipient: RECIPIENT })).toBeUndefined();
  });

  it('should return undefined when the message carries no factory', async () => {
    const message: NotificationMessage = { inputContext: { recipient: { e: RECIPIENT.email } }, content: { title: 'No invite' } };

    expect(await mailgunCalendarFileAttachmentForNotificationMessage({ message, recipient: RECIPIENT })).toBeUndefined();
  });
});
