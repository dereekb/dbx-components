/**
 * @module notification.redirect
 *
 * The {@link NotificationRedirectEntry} model: the record behind a notification short link.
 *
 * A notification can carry a short link (e.g. `https://app.example.com/s/j-a8Kd02Lm`) in place of a long deep link. The
 * last path segment is the entry's id, which is a short random code behind an app-defined prefix. Opening the link loads
 * the entry and sends the person to its target model.
 *
 * The entry lives in its own collection rather than on the {@link Notification}, because notifications are deleted once
 * they are sent and cleaned up, while the link in a text or email has to keep working until it expires.
 *
 * The prefix still means something after the entry is gone: once an entry expires and is deleted, an app can read the
 * prefix from the link and send the person to a fallback page for that kind of link (e.g. `j` → the jobs list).
 */
import { type Maybe, type WebsiteUrl } from '@dereekb/util';
import { type GrantedReadRole } from '@dereekb/model';
import { addDays, isAfter } from 'date-fns';
import { AbstractFirestoreDocument, type CollectionReference, type FirebaseAuthOwnershipKey, type FirestoreCollection, type FirestoreContext, type FirestoreModelKey, firestoreDate, firestoreModelIdentity, optionalFirestoreString, snapshotConverterFunctions } from '../../common';

// MARK: Identity
/**
 * Identity for {@link NotificationRedirectEntry} documents. Collection name: `'notificationRedirectEntry'`, short code: `'nre'`.
 */
export const notificationRedirectEntryIdentity = firestoreModelIdentity('notificationRedirectEntry', 'nre');

// MARK: Id
/**
 * App-defined prefix of a {@link NotificationRedirectEntryId}. Names the kind of link, such as `j` for job links.
 *
 * Lowercase letters and digits only, so it can never contain the {@link NOTIFICATION_REDIRECT_ENTRY_ID_PREFIX_SEPARATOR}.
 *
 * @semanticType
 * @semanticTopic identifier
 * @semanticTopic string
 * @semanticTopic dereekb-firebase:notification
 */
export type NotificationRedirectEntryPrefix = string;

/**
 * Random part of a {@link NotificationRedirectEntryId}. Letters and digits only.
 *
 * @semanticType
 * @semanticTopic identifier
 * @semanticTopic string
 * @semanticTopic dereekb-firebase:notification
 */
export type NotificationRedirectEntryCode = string;

/**
 * Id of a {@link NotificationRedirectEntry}, and the last path segment of its short link: `<prefix>-<code>`.
 *
 * @semanticType
 * @semanticTopic identifier
 * @semanticTopic string
 * @semanticTopic dereekb-firebase:notification
 */
export type NotificationRedirectEntryId = string;

/**
 * Separator between the prefix and the code of a {@link NotificationRedirectEntryId}.
 */
export const NOTIFICATION_REDIRECT_ENTRY_ID_PREFIX_SEPARATOR = '-';

/**
 * Prefix used when none is given. Stands for "generic".
 */
export const DEFAULT_NOTIFICATION_REDIRECT_ENTRY_PREFIX: NotificationRedirectEntryPrefix = 'g';

/**
 * Default length of a {@link NotificationRedirectEntryCode}.
 *
 * Eight letters and digits give 62^8 (about 2 × 10^14) codes per prefix, so a random code is very unlikely to collide
 * or be guessed.
 */
export const DEFAULT_NOTIFICATION_REDIRECT_ENTRY_CODE_LENGTH = 8;

/**
 * Number of days an entry is kept when no expiration is given.
 */
export const DEFAULT_NOTIFICATION_REDIRECT_ENTRY_EXPIRATION_DAYS = 60;

/**
 * Pattern a {@link NotificationRedirectEntryPrefix} must match.
 */
export const NOTIFICATION_REDIRECT_ENTRY_PREFIX_REGEX = /^[a-z0-9]+$/;

/**
 * Pattern a {@link NotificationRedirectEntryId} must match.
 */
export const NOTIFICATION_REDIRECT_ENTRY_ID_REGEX = /^[a-z0-9]+-[a-zA-Z0-9]+$/;

const NOTIFICATION_REDIRECT_ENTRY_CODE_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Bytes at or above this value are discarded so that every code character is equally likely.
 */
const NOTIFICATION_REDIRECT_ENTRY_CODE_BYTE_LIMIT = 256 - (256 % NOTIFICATION_REDIRECT_ENTRY_CODE_CHARACTERS.length);

/**
 * Returns true if the input is a valid {@link NotificationRedirectEntryPrefix}.
 *
 * @param prefix - The prefix to check.
 * @returns True if the prefix is only lowercase letters and digits.
 */
export function isNotificationRedirectEntryPrefix(prefix: string): prefix is NotificationRedirectEntryPrefix {
  return NOTIFICATION_REDIRECT_ENTRY_PREFIX_REGEX.test(prefix);
}

/**
 * Returns true if the input is shaped like a {@link NotificationRedirectEntryId}.
 *
 * @param id - The value to check, such as the key read from a short link.
 * @returns True if the value is `<prefix>-<code>`.
 */
export function isNotificationRedirectEntryId(id: string): id is NotificationRedirectEntryId {
  return NOTIFICATION_REDIRECT_ENTRY_ID_REGEX.test(id);
}

/**
 * Creates a random {@link NotificationRedirectEntryCode} using the platform's cryptographic random source.
 *
 * @param length - Number of characters. Defaults to {@link DEFAULT_NOTIFICATION_REDIRECT_ENTRY_CODE_LENGTH}.
 * @returns A random code of letters and digits.
 */
export function makeNotificationRedirectEntryCode(length: number = DEFAULT_NOTIFICATION_REDIRECT_ENTRY_CODE_LENGTH): NotificationRedirectEntryCode {
  let code = '';

  while (code.length < length) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(length * 2));

    for (const byte of bytes) {
      if (byte < NOTIFICATION_REDIRECT_ENTRY_CODE_BYTE_LIMIT && code.length < length) {
        code += NOTIFICATION_REDIRECT_ENTRY_CODE_CHARACTERS[byte % NOTIFICATION_REDIRECT_ENTRY_CODE_CHARACTERS.length];
      }
    }
  }

  return code;
}

/**
 * Input for {@link notificationRedirectEntryId}.
 */
export interface NotificationRedirectEntryIdInput {
  /**
   * Prefix of the id. Defaults to {@link DEFAULT_NOTIFICATION_REDIRECT_ENTRY_PREFIX}.
   */
  readonly prefix?: Maybe<NotificationRedirectEntryPrefix>;
  /**
   * Code of the id. Defaults to a new random code from {@link makeNotificationRedirectEntryCode}.
   */
  readonly code?: Maybe<NotificationRedirectEntryCode>;
}

/**
 * Builds a {@link NotificationRedirectEntryId} from a prefix and a code.
 *
 * @param input - The prefix and code. Both are optional.
 * @returns The id, `<prefix>-<code>`.
 * @throws {Error} When the prefix is not lowercase letters and digits.
 *
 * @example
 * ```ts
 * notificationRedirectEntryId({ prefix: 'j', code: 'a8Kd02Lm' }); // 'j-a8Kd02Lm'
 * notificationRedirectEntryId({ prefix: 'j' }); // 'j-' followed by a random code
 * ```
 */
export function notificationRedirectEntryId(input?: Maybe<NotificationRedirectEntryIdInput>): NotificationRedirectEntryId {
  const prefix = input?.prefix ?? DEFAULT_NOTIFICATION_REDIRECT_ENTRY_PREFIX;

  if (!isNotificationRedirectEntryPrefix(prefix)) {
    throw new Error(`notificationRedirectEntryId(): invalid prefix "${prefix}". A prefix may only contain lowercase letters and digits.`);
  }

  const code = input?.code ?? makeNotificationRedirectEntryCode();
  return `${prefix}${NOTIFICATION_REDIRECT_ENTRY_ID_PREFIX_SEPARATOR}${code}`;
}

/**
 * Reads the prefix from a {@link NotificationRedirectEntryId}.
 *
 * Works on the id alone, so it still answers after the entry has been deleted.
 *
 * @param id - The id, such as the key read from a short link.
 * @returns The prefix, or undefined if the input is not a valid id.
 *
 * @example
 * ```ts
 * notificationRedirectEntryIdPrefix('j-a8Kd02Lm'); // 'j'
 * notificationRedirectEntryIdPrefix('not a key'); // undefined
 * ```
 */
export function notificationRedirectEntryIdPrefix(id: Maybe<string>): Maybe<NotificationRedirectEntryPrefix> {
  return id != null && isNotificationRedirectEntryId(id) ? id.substring(0, id.indexOf(NOTIFICATION_REDIRECT_ENTRY_ID_PREFIX_SEPARATOR)) : undefined;
}

/**
 * Input for {@link notificationRedirectEntryShortLinkUrl}.
 */
export interface NotificationRedirectEntryShortLinkUrlInput {
  /**
   * Url that short links are opened at, without the id. For example `https://app.example.com/s`.
   *
   * A trailing slash is allowed.
   */
  readonly baseUrl: WebsiteUrl;
  /**
   * Id of the entry.
   */
  readonly id: NotificationRedirectEntryId;
}

/**
 * Builds the short link url for a {@link NotificationRedirectEntry}.
 *
 * @param input - The base url and entry id.
 * @returns The short link, `<baseUrl>/<id>`.
 *
 * @example
 * ```ts
 * notificationRedirectEntryShortLinkUrl({ baseUrl: 'https://app.example.com/s', id: 'j-a8Kd02Lm' }); // 'https://app.example.com/s/j-a8Kd02Lm'
 * ```
 */
export function notificationRedirectEntryShortLinkUrl(input: NotificationRedirectEntryShortLinkUrlInput): WebsiteUrl {
  const { baseUrl, id } = input;
  const base = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
  return `${base}/${id}`;
}

// MARK: NotificationRedirectEntry
/**
 * The record behind a notification short link. The document id is the {@link NotificationRedirectEntryId} in the link.
 *
 * Created by the server, either alongside a notification (see `CreateNotificationTemplate.l`) or per recipient by a
 * notification's message factory. Clients only read it, and only when they own it (see {@link o}).
 *
 * Deleted by `cleanupSentNotifications` once {@link xat} has passed.
 *
 * @dbxModel
 * @dbxModelGroup Notification
 * @dbxModelRead owner
 * @dbxModelArchetype root-entity
 */
export interface NotificationRedirectEntry {
  /**
   * Creation date of this entry.
   *
   * @dbxModelVariable createdAt
   */
  cat: Date;
  /**
   * When this entry expires. An expired entry no longer redirects to its target, even before it is deleted.
   *
   * @dbxModelVariable expiresAt
   */
  xat: Date;
  /**
   * Ownership key of the only person who may open this entry (e.g. `'pr/<uid>'`).
   *
   * With no owner, any signed-in person with the link may open it. The target page still applies its own permissions.
   *
   * @dbxModelVariable ownerKey
   */
  o?: Maybe<FirebaseAuthOwnershipKey>;
  /**
   * Model key of the model the link opens. With no target, the link opens its prefix's fallback page.
   *
   * @dbxModelVariable targetModelKey
   */
  m?: Maybe<FirestoreModelKey>;
}

/**
 * NotificationRedirectEntry roles.
 */
export type NotificationRedirectEntryRoles = GrantedReadRole;

export class NotificationRedirectEntryDocument extends AbstractFirestoreDocument<NotificationRedirectEntry, NotificationRedirectEntryDocument, typeof notificationRedirectEntryIdentity> {
  get modelIdentity() {
    return notificationRedirectEntryIdentity;
  }
}

/**
 * Firestore snapshot converter for {@link NotificationRedirectEntry} documents.
 */
export const notificationRedirectEntryConverter = snapshotConverterFunctions<NotificationRedirectEntry>({
  fields: {
    cat: firestoreDate(),
    xat: firestoreDate(),
    o: optionalFirestoreString(),
    m: optionalFirestoreString()
  }
});

/**
 * Creates a Firestore collection reference for {@link NotificationRedirectEntry} documents.
 *
 * @param context - Firestore context to create the collection reference from.
 * @returns A typed collection reference for NotificationRedirectEntry documents.
 */
export function notificationRedirectEntryCollectionReference(context: FirestoreContext): CollectionReference<NotificationRedirectEntry> {
  return context.collection(notificationRedirectEntryIdentity.collectionName);
}

/**
 * Typed Firestore collection for {@link NotificationRedirectEntry} documents.
 */
export type NotificationRedirectEntryFirestoreCollection = FirestoreCollection<NotificationRedirectEntry, NotificationRedirectEntryDocument>;

/**
 * Creates a typed {@link NotificationRedirectEntryFirestoreCollection} bound to the given Firestore context.
 *
 * @param firestoreContext - Firestore context to bind the collection to.
 * @returns A typed Firestore collection for NotificationRedirectEntry documents.
 */
export function notificationRedirectEntryFirestoreCollection(firestoreContext: FirestoreContext): NotificationRedirectEntryFirestoreCollection {
  return firestoreContext.firestoreCollection({
    modelIdentity: notificationRedirectEntryIdentity,
    converter: notificationRedirectEntryConverter,
    collection: notificationRedirectEntryCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new NotificationRedirectEntryDocument(accessor, documentAccessor),
    firestoreContext
  });
}

// MARK: Utility
/**
 * Returns true if the entry has expired.
 *
 * @param entry - The entry, or just its expiration date.
 * @param now - The current time. Defaults to now.
 * @returns True if {@link NotificationRedirectEntry.xat} is not after `now`.
 */
export function isNotificationRedirectEntryExpired(entry: Pick<NotificationRedirectEntry, 'xat'>, now: Date = new Date()): boolean {
  return !isAfter(entry.xat, now);
}

/**
 * Template for a new {@link NotificationRedirectEntry}.
 */
export interface CreateNotificationRedirectEntryTemplate {
  /**
   * Prefix of the new entry's id. Defaults to {@link DEFAULT_NOTIFICATION_REDIRECT_ENTRY_PREFIX}.
   */
  readonly prefix?: Maybe<NotificationRedirectEntryPrefix>;
  /**
   * Model key of the model the link opens.
   *
   * When created alongside a notification, defaults to the notification item's target model (`NotificationItem.m`).
   */
  readonly m?: Maybe<FirestoreModelKey>;
  /**
   * Ownership key of the only person who may open the link. See {@link NotificationRedirectEntry.o}.
   */
  readonly o?: Maybe<FirebaseAuthOwnershipKey>;
  /**
   * When the entry expires. Takes priority over {@link expiresInDays}.
   */
  readonly xat?: Maybe<Date>;
  /**
   * Number of days until the entry expires. Defaults to {@link DEFAULT_NOTIFICATION_REDIRECT_ENTRY_EXPIRATION_DAYS}.
   */
  readonly expiresInDays?: Maybe<number>;
}

/**
 * Input for {@link createNotificationRedirectEntryData}.
 */
export interface CreateNotificationRedirectEntryDataInput {
  /**
   * The template.
   */
  readonly template: CreateNotificationRedirectEntryTemplate;
  /**
   * Target model to use when the template has none.
   */
  readonly defaultTargetModel?: Maybe<FirestoreModelKey>;
  /**
   * The current time. Defaults to now.
   */
  readonly now?: Maybe<Date>;
}

/**
 * Builds the data for a new {@link NotificationRedirectEntry} from a template. Does not save anything.
 *
 * @param input - The template, a default target model and the current time.
 * @returns The data to save.
 */
export function createNotificationRedirectEntryData(input: CreateNotificationRedirectEntryDataInput): NotificationRedirectEntry {
  const { template, defaultTargetModel } = input;
  const cat = input.now ?? new Date();
  const xat = template.xat ?? addDays(cat, template.expiresInDays ?? DEFAULT_NOTIFICATION_REDIRECT_ENTRY_EXPIRATION_DAYS);

  return {
    cat,
    xat,
    o: template.o,
    m: template.m ?? defaultTargetModel
  };
}
