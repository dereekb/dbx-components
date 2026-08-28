import { type Maybe } from '@dereekb/util';
import { type MailgunFileAttachment } from '@dereekb/nestjs/mailgun';
import { iCalendarITipContentType } from '@dereekb/date';
import { DEFAULT_NOTIFICATION_MESSAGE_CALENDAR_ATTACHMENT_FILENAME, type NotificationMessageCalendarAttachment, type NotificationMessageCalendarAttachmentFactoryInput } from '@dereekb/firebase';

/**
 * @module notification.send.service.mailgun.attachment
 *
 * Bridges a notification message's iTIP calendar payload onto a Mailgun request as a calendar MIME part.
 *
 * The payload cannot ride a batched `to[]`: attachments live on the REQUEST, a `MailgunRecipient` has no
 * per-recipient attachment slot, and a `METHOD:REQUEST` invite is only rendered inline by a client that
 * finds its OWN address in the payload's ATTENDEE. A builder must therefore give a recipient with a payload
 * a request of its own -- either by emitting one directly, or by setting the result on that recipient's
 * `MailgunRecipientBatchSendTarget.attachments` and letting
 * `expandMailgunRecipientBatchSendTargetRequestFactory()` expand it while the rest still batch.
 */

/**
 * Converts a rendered iTIP calendar payload into the Mailgun attachment that carries it.
 *
 * The `contentType` is the whole point: a calendar part typed `text/calendar; method=REQUEST; charset=utf-8`
 * is auto-processed as an invitation by Gmail, Outlook and Apple Mail, while the same bytes under Mailgun's
 * default type render as an ordinary paperclip.
 *
 * @param calendarAttachment - The rendered payload.
 * @returns The Mailgun attachment.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function notificationMessageCalendarAttachmentToMailgunFileAttachment(calendarAttachment: NotificationMessageCalendarAttachment): MailgunFileAttachment {
  const { ics, method, filename } = calendarAttachment;

  return {
    filename: filename || DEFAULT_NOTIFICATION_MESSAGE_CALENDAR_ATTACHMENT_FILENAME,
    data: ics,
    contentType: iCalendarITipContentType(method)
  };
}

/**
 * Renders the message's calendar payload for one recipient and converts it to a Mailgun attachment.
 *
 * The single entry point a template builder needs: it reads the message's `calendarAttachmentFactory`,
 * invokes it for the recipient, and returns `undefined` when the message carries no factory or the factory
 * declines this recipient. That is the signal to batch the recipient normally rather than give it a request
 * of its own; a non-undefined return belongs on that recipient's `MailgunRecipientBatchSendTarget.attachments`.
 *
 * @param input - The message and the address the payload's ATTENDEE must name.
 * @returns The Mailgun attachment, or `undefined` when this recipient gets no calendar part.
 */
export async function mailgunCalendarFileAttachmentForNotificationMessage(input: NotificationMessageCalendarAttachmentFactoryInput): Promise<Maybe<MailgunFileAttachment>> {
  const { message } = input;
  const calendarAttachmentFactory = message.emailContent?.calendarAttachmentFactory;
  const calendarAttachment = calendarAttachmentFactory ? await calendarAttachmentFactory(input) : undefined;

  return calendarAttachment ? notificationMessageCalendarAttachmentToMailgunFileAttachment(calendarAttachment) : undefined;
}
