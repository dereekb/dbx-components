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
  /**
   * Whether the signed-in user organizes the event. Deleting an event the user organizes that has attendees
   * sends them cancellations.
   */
  readonly isOrganizer?: Maybe<boolean>;
  readonly isCancelled?: Maybe<boolean>;
  readonly isOnlineMeeting?: Maybe<boolean>;
  readonly showAs?: Maybe<MicrosoftGraphEventShowAs>;
}

/**
 * How an event shows on the calendar (`free`, `busy`, …).
 */
export type MicrosoftGraphEventShowAs = 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere' | 'unknown';

/**
 * A drive item's `parentReference`: where the item lives.
 */
export interface MicrosoftGraphDriveItemParentReference {
  readonly driveId?: Maybe<string>;
  readonly id?: Maybe<string>;
  readonly path?: Maybe<string>;
}

/**
 * A file's content hashes. On OneDrive for Business and SharePoint only `quickXorHash` is guaranteed.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/resources/hashes
 */
export interface MicrosoftGraphDriveItemHashes {
  readonly quickXorHash?: Maybe<string>;
  readonly sha1Hash?: Maybe<string>;
  readonly crc32Hash?: Maybe<string>;
}

/**
 * The subset of a Graph `driveItem` this package reads.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/resources/driveitem
 */
export interface MicrosoftGraphDriveItem {
  readonly id: string;
  readonly name?: Maybe<string>;
  readonly size?: Maybe<number>;
  readonly webUrl?: Maybe<string>;
  readonly createdDateTime?: Maybe<ISO8601DateString>;
  readonly lastModifiedDateTime?: Maybe<ISO8601DateString>;
  /**
   * Changes when the item's metadata or content changes.
   */
  readonly eTag?: Maybe<string>;
  /**
   * Changes only when the item's content changes. OneDrive for Business and SharePoint folders have none.
   */
  readonly cTag?: Maybe<string>;
  readonly file?: Maybe<{ readonly mimeType?: Maybe<string>; readonly hashes?: Maybe<MicrosoftGraphDriveItemHashes> }>;
  readonly folder?: Maybe<{ readonly childCount?: Maybe<number> }>;
  /**
   * Set on a package, such as a OneNote notebook: it is listed like a file but has no downloadable content.
   */
  readonly package?: Maybe<{ readonly type?: Maybe<string> }>;
  /**
   * Set on a shortcut to an item in another drive.
   */
  readonly remoteItem?: Maybe<{ readonly id?: Maybe<string>; readonly parentReference?: Maybe<MicrosoftGraphDriveItemParentReference> }>;
  /**
   * Set when the service flagged the file as malware; downloading it fails with `malwareDetected`.
   */
  readonly malware?: Maybe<{ readonly description?: Maybe<string> }>;
  /**
   * Set on a deleted item, e.g. in a delta response.
   */
  readonly deleted?: Maybe<{ readonly state?: Maybe<string> }>;
  /**
   * The times the client that uploaded the file reported.
   */
  readonly fileSystemInfo?: Maybe<{ readonly createdDateTime?: Maybe<ISO8601DateString>; readonly lastModifiedDateTime?: Maybe<ISO8601DateString> }>;
  readonly parentReference?: Maybe<MicrosoftGraphDriveItemParentReference>;
}

/**
 * The subset of a Graph `drive` (a OneDrive, or a SharePoint document library) this package reads.
 */
export interface MicrosoftGraphDrive {
  readonly id: string;
  readonly name?: Maybe<string>;
  readonly driveType?: Maybe<string>;
  readonly webUrl?: Maybe<string>;
}

/**
 * The subset of a Graph `site` this package reads.
 */
export interface MicrosoftGraphSite {
  readonly id: string;
  readonly name?: Maybe<string>;
  readonly displayName?: Maybe<string>;
  readonly webUrl?: Maybe<string>;
}
