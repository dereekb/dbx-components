import { isE164PhoneNumber, performAsyncTasks, type PromiseOrValue } from '@dereekb/util';
import {
  type DocumentDataWithIdAndKey,
  type FirebaseAuthUserId,
  type FirestoreDocumentSnapshotDataPairWithData,
  getDocumentSnapshotDataPairsWithData,
  loadDocumentsForIds,
  type NotificationFirestoreCollections,
  type NotificationUser,
  type NotificationUserDocument,
  notificationUsersWithTextPhoneNumberQuery
} from '@dereekb/firebase';
import { TwilioOptOutType } from '@dereekb/nestjs/twilio';
import { Logger } from '@nestjs/common';
import { type TwilioTextKeywordEvent, type TwilioTextKeywordHandler } from './notification.optout.twilio';

/**
 * Max number of {@link NotificationUserTwilioTextKeywordLoadedFunction} calls {@link notificationUserTwilioTextKeywordHandler} runs at once.
 */
export const NOTIFICATION_USER_TWILIO_TEXT_KEYWORD_HANDLER_MAX_PARALLEL_TASKS = 5;

/**
 * Context for {@link notificationUserTwilioTextKeywordHandler}.
 */
export type NotificationUserTwilioTextKeywordHandlerContext = Pick<NotificationFirestoreCollections, 'notificationUserCollection'>;

/**
 * Input for a {@link NotificationUserTwilioTextKeywordLoadedFunction}.
 */
export interface NotificationUserTwilioTextKeywordLoadedInput {
  /**
   * The keyword text. Its `payload.From` is the sender's phone number; do not forward it to analytics.
   */
  readonly event: TwilioTextKeywordEvent;
  /**
   * The matched NotificationUser, loaded after the opt-out was applied.
   */
  readonly notificationUser: DocumentDataWithIdAndKey<NotificationUser>;
  /**
   * The NotificationUser's id, which is the user's uid.
   */
  readonly uid: FirebaseAuthUserId;
}

/**
 * Called by {@link notificationUserTwilioTextKeywordHandler} once per NotificationUser matched by a keyword text.
 */
export type NotificationUserTwilioTextKeywordLoadedFunction = (input: NotificationUserTwilioTextKeywordLoadedInput) => PromiseOrValue<void>;

/**
 * Config for {@link notificationUserTwilioTextKeywordHandler}.
 */
export interface NotificationUserTwilioTextKeywordHandlerConfig {
  /**
   * Provides the NotificationUser collection. The app's `NotificationServerActionsContext` works.
   */
  readonly context: NotificationUserTwilioTextKeywordHandlerContext;
  /**
   * Called once per matched NotificationUser.
   */
  readonly onNotificationUserLoaded: NotificationUserTwilioTextKeywordLoadedFunction;
}

/**
 * Creates a {@link TwilioTextKeywordHandler} that loads the NotificationUsers a STOP, START or HELP text came from, and calls
 * `onNotificationUserLoaded` once per user. Pass it to `twilioNotificationTextOptOutHandler()` as `onTextKeyword`.
 *
 * - STOP and START: loads the NotificationUsers the opt-out was applied to (`applied.notificationUserIds`).
 * - HELP: queries the NotificationUsers whose texting number (`gc.t`) is the sender. Read-only; the app never replies to HELP, since
 *   Twilio's Advanced Opt-Out already does.
 *
 * Several NotificationUsers may share a number, so each is called. No match, or a sender that is not an E.164 phone number, means no
 * calls. A failed call is logged and never skips the other users.
 *
 * Key analytics by `uid`, and do not forward the sender's phone number (`event.payload.From`).
 *
 * @param config - The NotificationUser collection context and the per-user callback.
 * @returns The keyword handler.
 *
 * @example
 * ```ts
 * const onTextKeyword = notificationUserTwilioTextKeywordHandler({
 *   context: notificationServerActionsContext,
 *   onNotificationUserLoaded: ({ event, uid }) => analyticsService.sendEventData(uid, 'Text Keyword', { keyword: event.type })
 * });
 *
 * const handleTextOptOut = twilioNotificationTextOptOutHandler({ notificationServerActions, onTextKeyword });
 * ```
 */
export function notificationUserTwilioTextKeywordHandler(config: NotificationUserTwilioTextKeywordHandlerConfig): TwilioTextKeywordHandler {
  const { context, onNotificationUserLoaded } = config;
  const { notificationUserCollection } = context;
  const logger = new Logger('NotificationUserTwilioTextKeywordHandler');

  async function loadNotificationUserPairs(event: TwilioTextKeywordEvent): Promise<FirestoreDocumentSnapshotDataPairWithData<NotificationUserDocument>[]> {
    const { type, payload, applied } = event;
    let pairs: FirestoreDocumentSnapshotDataPairWithData<NotificationUserDocument>[] = [];

    if (type === TwilioOptOutType.HELP) {
      const phoneNumber = payload.From;

      if (phoneNumber != null && isE164PhoneNumber(phoneNumber, false)) {
        pairs = await notificationUserCollection.queryDocument(notificationUsersWithTextPhoneNumberQuery(phoneNumber)).getDocSnapshotDataPairs();
      }
    } else {
      const notificationUserIds = applied?.notificationUserIds ?? [];

      if (notificationUserIds.length > 0) {
        pairs = await getDocumentSnapshotDataPairsWithData(loadDocumentsForIds(notificationUserCollection.documentAccessor(), notificationUserIds));
      }
    }

    return pairs;
  }

  return async (event: TwilioTextKeywordEvent) => {
    const pairs = await loadNotificationUserPairs(event);

    const { errors } = await performAsyncTasks(
      pairs,
      async (pair) => {
        await onNotificationUserLoaded({ event, notificationUser: pair.data, uid: pair.document.id });
      },
      { throwError: false, maxParallelTasks: NOTIFICATION_USER_TWILIO_TEXT_KEYWORD_HANDLER_MAX_PARALLEL_TASKS }
    );

    errors.forEach(([pair, e]) => {
      // best-effort; never log the sender's phone number
      logger.warn(`onNotificationUserLoaded failed for the ${event.type} text of NotificationUser "${pair.document.id}".`, e);
    });
  };
}
