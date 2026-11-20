import { type Building, type Maybe, type WebsiteUrl } from '@dereekb/util';
import {
  type CreateNotificationRedirectEntryTemplate,
  type FirebaseAuthOwnershipKey,
  type FirebaseAuthUserId,
  type FirestoreContext,
  type NotificationRedirectEntry,
  type NotificationRedirectEntryDocument,
  type NotificationRedirectEntryFirestoreCollection,
  type NotificationRedirectEntryId,
  createNotificationRedirectEntryData,
  iterateFirestoreDocumentSnapshotBatches,
  makeNotificationRedirectEntryCode,
  notificationRedirectEntriesExpiredQuery,
  notificationRedirectEntryId,
  notificationRedirectEntryShortLinkUrl
} from '@dereekb/firebase';

/**
 * Default number of ids {@link notificationShortLinkFactory} tries before giving up, in case a random id is already taken.
 */
export const DEFAULT_NOTIFICATION_SHORT_LINK_MAX_CREATE_ATTEMPTS = 3;

/**
 * Maps a recipient's uid to the ownership key stored on their short link entries (e.g. `uid → 'pr/<uid>'`).
 *
 * Must produce the same key the app's firestore rules compare against the signed-in user.
 */
export type NotificationShortLinkOwnershipKeyForUidFunction = (uid: FirebaseAuthUserId) => Maybe<FirebaseAuthOwnershipKey>;

/**
 * Config for {@link notificationShortLinkFactory}.
 */
export interface NotificationShortLinkFactoryConfig {
  /**
   * Collection the entries are created in.
   */
  readonly notificationRedirectEntryCollection: NotificationRedirectEntryFirestoreCollection;
  /**
   * Url that short links are opened at, without the id. For example `https://app.example.com/s`.
   */
  readonly baseUrl: WebsiteUrl;
  /**
   * Maps a recipient's uid to an ownership key. Required to create links with {@link NotificationShortLinkParams.uid}.
   */
  readonly ownershipKeyForUid?: Maybe<NotificationShortLinkOwnershipKeyForUidFunction>;
  /**
   * Length of the random part of each id. Defaults to `DEFAULT_NOTIFICATION_REDIRECT_ENTRY_CODE_LENGTH`.
   */
  readonly codeLength?: Maybe<number>;
  /**
   * Number of ids to try before giving up. Defaults to {@link DEFAULT_NOTIFICATION_SHORT_LINK_MAX_CREATE_ATTEMPTS}.
   */
  readonly maxCreateAttempts?: Maybe<number>;
}

/**
 * Params for creating one short link with a {@link NotificationShortLinkFactory}.
 */
export interface NotificationShortLinkParams extends CreateNotificationRedirectEntryTemplate {
  /**
   * Uid of the only person who may open the link, usually `inputContext.recipient.uid` inside a message function.
   *
   * Mapped to the entry's owner with {@link NotificationShortLinkFactoryConfig.ownershipKeyForUid}. Ignored when an owner
   * (`o`) is given directly.
   */
  readonly uid?: Maybe<FirebaseAuthUserId>;
  /**
   * The current time. Defaults to now.
   */
  readonly now?: Maybe<Date>;
}

/**
 * A created short link.
 */
export interface NotificationShortLink {
  /**
   * Id of the entry, and the last path segment of {@link url}.
   */
  readonly id: NotificationRedirectEntryId;
  /**
   * The short link.
   */
  readonly url: WebsiteUrl;
  /**
   * The saved entry.
   */
  readonly entry: NotificationRedirectEntry;
  /**
   * The entry's document.
   */
  readonly document: NotificationRedirectEntryDocument;
}

/**
 * Creates short links for notifications. See {@link notificationShortLinkFactory}.
 */
export type NotificationShortLinkFactory = ((params?: Maybe<NotificationShortLinkParams>) => Promise<NotificationShortLink>) & {
  /**
   * Builds the short link for an existing entry id, such as the `NotificationItem.l` of a notification created with
   * `CreateNotificationTemplate.redirectEntry`.
   */
  readonly urlForId: (id: NotificationRedirectEntryId) => WebsiteUrl;
};

/**
 * Creates a {@link NotificationShortLinkFactory}, which saves a {@link NotificationRedirectEntry} and returns its short link.
 *
 * Use it inside a notification's message function to give each recipient their own link, owned by them, so that
 * nobody else can open it. To share one link between every recipient, create it with the notification instead
 * (`CreateNotificationTemplate.redirectEntry`) and build its url with {@link NotificationShortLinkFactory.urlForId}.
 *
 * A message function can run more than once for the same recipient, since sends are retried, so a recipient may end
 * up with more than one entry. The extras expire and are cleaned up like any other.
 *
 * @param config - The collection, base url and owner mapping.
 * @returns The factory.
 * @throws {Error} When called with a `uid` but the config has no `ownershipKeyForUid`.
 *
 * @example
 * ```ts
 * const shortLinks = notificationShortLinkFactory({
 *   notificationRedirectEntryCollection: context.notificationRedirectEntryCollection,
 *   baseUrl: `${clientUrl}/s`,
 *   ownershipKeyForUid: (uid) => firestoreModelKey(profileIdentity, uid)
 * });
 *
 * // inside a message function
 * const { url } = await shortLinks({ prefix: 'j', m: item.m, uid: inputContext.recipient.uid, xat: jobEndsAt });
 * ```
 */
export function notificationShortLinkFactory(config: NotificationShortLinkFactoryConfig): NotificationShortLinkFactory {
  const { notificationRedirectEntryCollection, baseUrl, ownershipKeyForUid, codeLength, maxCreateAttempts: inputMaxCreateAttempts } = config;
  const maxCreateAttempts = Math.max(1, inputMaxCreateAttempts ?? DEFAULT_NOTIFICATION_SHORT_LINK_MAX_CREATE_ATTEMPTS);
  const urlForId = (id: NotificationRedirectEntryId) => notificationRedirectEntryShortLinkUrl({ baseUrl, id });

  const factory = (async (params?: Maybe<NotificationShortLinkParams>) => {
    const { uid, now, ...template } = params ?? {};
    let o = template.o;

    if (o == null && uid != null) {
      if (!ownershipKeyForUid) {
        throw new Error('notificationShortLinkFactory(): a uid was provided but the factory has no ownershipKeyForUid configured.');
      }

      o = ownershipKeyForUid(uid);
    }

    const entry = createNotificationRedirectEntryData({ template: { ...template, o }, now });
    const accessor = notificationRedirectEntryCollection.documentAccessor();
    let result: Maybe<NotificationShortLink>;
    let attempt = 0;

    while (!result) {
      attempt += 1;
      const document = accessor.loadDocumentForId(notificationRedirectEntryId({ prefix: template.prefix, code: makeNotificationRedirectEntryCode(codeLength ?? undefined) }));

      try {
        await document.create(entry);
        result = { id: document.id, url: urlForId(document.id), entry, document };
      } catch (e) {
        // only retry when the random id was already taken
        const idWasTaken = attempt < maxCreateAttempts && (await document.exists());

        if (!idWasTaken) {
          throw e;
        }
      }
    }

    return result;
  }) as Building<NotificationShortLinkFactory>;

  factory.urlForId = urlForId;
  return factory as NotificationShortLinkFactory;
}

// MARK: Cleanup
/**
 * Input for {@link deleteExpiredNotificationRedirectEntries}.
 */
export interface DeleteExpiredNotificationRedirectEntriesInput {
  readonly firestoreContext: FirestoreContext;
  readonly notificationRedirectEntryCollection: NotificationRedirectEntryFirestoreCollection;
  /**
   * Entries that expired at or before this time are deleted. Defaults to now.
   */
  readonly now?: Maybe<Date>;
}

/**
 * Number of entries deleted per write batch by {@link deleteExpiredNotificationRedirectEntries}.
 */
export const DELETE_EXPIRED_NOTIFICATION_REDIRECT_ENTRIES_BATCH_SIZE = 400;

/**
 * Deletes every {@link NotificationRedirectEntry} that has expired. Called by `cleanupSentNotifications`.
 *
 * @param input - The firestore context, collection and current time.
 * @returns The number of entries deleted.
 */
export async function deleteExpiredNotificationRedirectEntries(input: DeleteExpiredNotificationRedirectEntriesInput): Promise<number> {
  const { firestoreContext, notificationRedirectEntryCollection } = input;
  const now = input.now ?? new Date();
  let deleted = 0;

  await iterateFirestoreDocumentSnapshotBatches({
    queryFactory: notificationRedirectEntryCollection,
    constraintsFactory: () => notificationRedirectEntriesExpiredQuery(now),
    limitPerCheckpoint: DELETE_EXPIRED_NOTIFICATION_REDIRECT_ENTRIES_BATCH_SIZE,
    batchSize: null,
    iterateSnapshotBatch: async (snapshots) => {
      const writeBatch = firestoreContext.batch();
      const writeBatchAccessor = notificationRedirectEntryCollection.documentAccessorForTransaction(writeBatch);
      await Promise.all(snapshots.map((x) => writeBatchAccessor.loadDocumentForId(x.id).accessor.delete()));
      await writeBatch.commit();
      deleted += snapshots.length;
    }
  });

  return deleted;
}
