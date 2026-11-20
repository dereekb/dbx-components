import { type SegueRefOrSegueRefRouterLink } from '@dereekb/dbx-core';
import { type DocumentDataWithIdAndKey, type NotificationRedirectEntry, type NotificationRedirectEntryPrefix, isNotificationRedirectEntryExpired, notificationRedirectEntryIdPrefix } from '@dereekb/firebase';
import { type Maybe, type Milliseconds, type PromiseOrValue } from '@dereekb/util';

/**
 * Message shown when a short link has expired or no longer exists, unless its prefix or the config sets another.
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_REDIRECT_EXPIRED_MESSAGE = 'This link has expired.';

/**
 * Message shown when a short link belongs to a different account.
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_REDIRECT_NOT_OWNER_MESSAGE = 'This link belongs to a different account.';

/**
 * Message shown when a short link could not be opened for any other reason.
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_REDIRECT_ERROR_MESSAGE = 'This link could not be opened.';

/**
 * Default name of the route param that holds the short link id.
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_REDIRECT_ROUTE_PARAM_KEY = 'key';

/**
 * Default time a short link message stays on screen.
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_REDIRECT_SNACKBAR_DURATION: Milliseconds = 6000;

/**
 * How short links with one prefix are handled.
 */
export interface DbxFirebaseNotificationRedirectPrefixConfig {
  /**
   * Page opened when a link with this prefix has expired, no longer exists, or has no target.
   *
   * Works after the entry is deleted, since it only needs the prefix in the link.
   */
  readonly fallback: SegueRefOrSegueRefRouterLink;
  /**
   * Message shown when a link with this prefix has expired or no longer exists.
   *
   * For example: "This notification has expired, but you can view the other available jobs."
   */
  readonly expiredMessage?: Maybe<string>;
}

/**
 * Resolves the page an entry opens. Return undefined to use the default, which is the `sref` of the target model's
 * registered type (see `DbxFirebaseModelTypesService.segueRefForKey()`).
 */
export type DbxFirebaseNotificationRedirectSegueRefForEntryFunction = (entry: DocumentDataWithIdAndKey<NotificationRedirectEntry>) => PromiseOrValue<Maybe<SegueRefOrSegueRefRouterLink>>;

/**
 * App-level configuration for the notification short link page (`dbx-firebase-notification-redirect`).
 *
 * Provided via the `redirect` key of `provideDbxFirebaseNotifications()`.
 */
export abstract class DbxFirebaseNotificationRedirectConfig {
  /**
   * Page opened when a link cannot be followed and its prefix has no config of its own.
   */
  abstract readonly defaultFallback: SegueRefOrSegueRefRouterLink;
  /**
   * Config for each link prefix, keyed by prefix.
   */
  abstract readonly prefixes?: Maybe<Readonly<Record<NotificationRedirectEntryPrefix, DbxFirebaseNotificationRedirectPrefixConfig>>>;
  /**
   * Message shown when a link has expired. Defaults to {@link DEFAULT_DBX_FIREBASE_NOTIFICATION_REDIRECT_EXPIRED_MESSAGE}.
   */
  abstract readonly expiredMessage?: Maybe<string>;
  /**
   * Message shown when a link belongs to a different account. Defaults to {@link DEFAULT_DBX_FIREBASE_NOTIFICATION_REDIRECT_NOT_OWNER_MESSAGE}.
   */
  abstract readonly notOwnerMessage?: Maybe<string>;
  /**
   * Message shown when a link could not be opened for any other reason. Defaults to {@link DEFAULT_DBX_FIREBASE_NOTIFICATION_REDIRECT_ERROR_MESSAGE}.
   */
  abstract readonly errorMessage?: Maybe<string>;
  /**
   * Overrides the page an entry opens.
   */
  abstract readonly segueRefForEntry?: Maybe<DbxFirebaseNotificationRedirectSegueRefForEntryFunction>;
  /**
   * Name of the route param that holds the short link id. Defaults to {@link DEFAULT_DBX_FIREBASE_NOTIFICATION_REDIRECT_ROUTE_PARAM_KEY}.
   */
  abstract readonly routeParamKey?: Maybe<string>;
  /**
   * Time a message stays on screen. Defaults to {@link DEFAULT_DBX_FIREBASE_NOTIFICATION_REDIRECT_SNACKBAR_DURATION}.
   */
  abstract readonly snackbarDuration?: Maybe<Milliseconds>;
}

/**
 * What happened when a short link was opened.
 *
 * - `target`: the entry was found and its target page opened.
 * - `no_target`: the entry was found but has no target page, so its prefix's fallback opened.
 * - `expired`: the entry has expired, no longer exists, or the id is not a valid short link id.
 * - `not_owner`: the entry belongs to a different account.
 * - `error`: the entry could not be loaded.
 */
export type DbxFirebaseNotificationRedirectOutcome = 'target' | 'no_target' | 'expired' | 'not_owner' | 'error';

/**
 * Where a short link sends the person, and the message to show them.
 */
export interface DbxFirebaseNotificationRedirectDecision {
  readonly outcome: DbxFirebaseNotificationRedirectOutcome;
  readonly segueRef: SegueRefOrSegueRefRouterLink;
  readonly message?: Maybe<string>;
}

/**
 * Result of loading the entry behind a short link.
 *
 * - `found`: the entry was read, along with the page its target model resolves to, if any.
 * - `missing`: the entry does not exist, or the id is not a valid short link id.
 * - `not_owner`: reading the entry was denied.
 * - `error`: reading the entry failed for another reason.
 */
export type DbxFirebaseNotificationRedirectEntryLoadResult = { readonly type: 'found'; readonly entry: DocumentDataWithIdAndKey<NotificationRedirectEntry>; readonly targetSegueRef?: Maybe<SegueRefOrSegueRefRouterLink> } | { readonly type: 'missing' } | { readonly type: 'not_owner' } | { readonly type: 'error' };

/**
 * Input for {@link dbxFirebaseNotificationRedirectDecision}.
 */
export interface DbxFirebaseNotificationRedirectDecisionInput {
  readonly config: Pick<DbxFirebaseNotificationRedirectConfig, 'defaultFallback' | 'prefixes' | 'expiredMessage' | 'notOwnerMessage' | 'errorMessage'>;
  /**
   * The id from the short link. Its prefix picks the fallback page.
   */
  readonly id: Maybe<string>;
  readonly load: DbxFirebaseNotificationRedirectEntryLoadResult;
  /**
   * The current time. Defaults to now.
   */
  readonly now?: Maybe<Date>;
}

/**
 * Decides where a short link sends the person. Pure, so it can be tested without a router or firestore.
 *
 * @param input - The config, the id from the link and the result of loading its entry.
 * @returns The page to open and the message to show.
 */
export function dbxFirebaseNotificationRedirectDecision(input: DbxFirebaseNotificationRedirectDecisionInput): DbxFirebaseNotificationRedirectDecision {
  const { config, id, load } = input;
  const prefix = notificationRedirectEntryIdPrefix(id);
  const prefixConfig = prefix == null ? undefined : config.prefixes?.[prefix];
  const fallback = prefixConfig?.fallback ?? config.defaultFallback;
  const expiredMessage = prefixConfig?.expiredMessage ?? config.expiredMessage ?? DEFAULT_DBX_FIREBASE_NOTIFICATION_REDIRECT_EXPIRED_MESSAGE;

  let decision: DbxFirebaseNotificationRedirectDecision;

  switch (load.type) {
    case 'found':
      if (isNotificationRedirectEntryExpired(load.entry, input.now ?? undefined)) {
        decision = { outcome: 'expired', segueRef: fallback, message: expiredMessage };
      } else if (load.targetSegueRef) {
        decision = { outcome: 'target', segueRef: load.targetSegueRef };
      } else {
        decision = { outcome: 'no_target', segueRef: fallback };
      }
      break;
    case 'missing':
      decision = { outcome: 'expired', segueRef: fallback, message: expiredMessage };
      break;
    case 'not_owner':
      decision = { outcome: 'not_owner', segueRef: fallback, message: config.notOwnerMessage ?? DEFAULT_DBX_FIREBASE_NOTIFICATION_REDIRECT_NOT_OWNER_MESSAGE };
      break;
    default:
      decision = { outcome: 'error', segueRef: fallback, message: config.errorMessage ?? DEFAULT_DBX_FIREBASE_NOTIFICATION_REDIRECT_ERROR_MESSAGE };
      break;
  }

  return decision;
}
