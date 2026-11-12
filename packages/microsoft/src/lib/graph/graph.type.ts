import { type ISO8601DateString, type Maybe } from '@dereekb/util';

/**
 * A page of a Graph collection.
 */
export interface MicrosoftGraphPage<T> {
  readonly value: T[];
  /**
   * The absolute URL of the next page, when there is one.
   */
  readonly '@odata.nextLink'?: Maybe<string>;
}

export interface MicrosoftGraphEmailAddress {
  readonly name?: Maybe<string>;
  readonly address?: Maybe<string>;
}

export interface MicrosoftGraphRecipient {
  readonly emailAddress?: Maybe<MicrosoftGraphEmailAddress>;
}

export interface MicrosoftGraphItemBody {
  readonly contentType: 'text' | 'html';
  readonly content: string;
}

/**
 * The subset of a Graph `message` this package reads.
 */
export interface MicrosoftGraphMessage {
  readonly id: string;
  /**
   * Changes whenever the message changes. A dump skips a message whose `changeKey` it already holds.
   */
  readonly changeKey?: Maybe<string>;
  readonly subject?: Maybe<string>;
  readonly bodyPreview?: Maybe<string>;
  readonly body?: Maybe<MicrosoftGraphItemBody>;
  readonly from?: Maybe<MicrosoftGraphRecipient>;
  readonly toRecipients?: Maybe<MicrosoftGraphRecipient[]>;
  readonly ccRecipients?: Maybe<MicrosoftGraphRecipient[]>;
  readonly receivedDateTime?: Maybe<ISO8601DateString>;
  readonly isRead?: Maybe<boolean>;
  readonly hasAttachments?: Maybe<boolean>;
  readonly webLink?: Maybe<string>;
  readonly conversationId?: Maybe<string>;
  readonly sentDateTime?: Maybe<ISO8601DateString>;
  readonly parentFolderId?: Maybe<string>;
  /**
   * Whether the message is an unsent draft. Only a draft's recipients, subject and body can be changed.
   */
  readonly isDraft?: Maybe<boolean>;
}

/**
 * The subset of a Graph message `attachment` this package reads. A `#microsoft.graph.fileAttachment` holds
 * file bytes; an item or reference attachment does not.
 */
export interface MicrosoftGraphAttachment {
  readonly id: string;
  readonly '@odata.type'?: Maybe<string>;
  readonly name?: Maybe<string>;
  readonly contentType?: Maybe<string>;
  readonly size?: Maybe<number>;
  readonly isInline?: Maybe<boolean>;
}

export interface MicrosoftGraphDateTimeTimeZone {
  readonly dateTime: string;
  readonly timeZone: string;
}

/**
 * The subset of a Graph `event` this package reads.
 */
export interface MicrosoftGraphEvent {
  readonly id: string;
  readonly subject?: Maybe<string>;
  readonly start?: Maybe<MicrosoftGraphDateTimeTimeZone>;
  readonly end?: Maybe<MicrosoftGraphDateTimeTimeZone>;
  readonly isAllDay?: Maybe<boolean>;
  readonly location?: Maybe<{ readonly displayName?: Maybe<string> }>;
  readonly organizer?: Maybe<MicrosoftGraphRecipient>;
  readonly attendees?: Maybe<MicrosoftGraphRecipient[]>;
  readonly webLink?: Maybe<string>;
}

/**
 * The subset of a Graph `driveItem` this package reads.
 */
export interface MicrosoftGraphDriveItem {
  readonly id: string;
  readonly name?: Maybe<string>;
  readonly size?: Maybe<number>;
  readonly webUrl?: Maybe<string>;
  readonly createdDateTime?: Maybe<ISO8601DateString>;
  readonly lastModifiedDateTime?: Maybe<ISO8601DateString>;
  readonly file?: Maybe<{ readonly mimeType?: Maybe<string> }>;
  readonly folder?: Maybe<{ readonly childCount?: Maybe<number> }>;
  readonly parentReference?: Maybe<{ readonly driveId?: Maybe<string>; readonly path?: Maybe<string> }>;
}
