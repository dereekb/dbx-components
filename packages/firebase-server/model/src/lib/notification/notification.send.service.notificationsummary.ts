import {
  type NotificationFirestoreCollections,
  type FirestoreContextReference,
  type NotificationMessage,
  type AppNotificationTemplateTypeInfoRecordServiceRef,
  type NotificationSummaryId,
  type NotificationItem,
  NOTIFICATION_SUMMARY_ITEM_LIMIT,
  type NotificationSendNotificationSummaryMessagesResult,
  type NotificationSummary,
  inferKeyFromTwoWayFlatFirestoreModelKey,
  NOTIFICATION_SUMMARY_EMBEDDED_NOTIFICATION_ITEM_SUBJECT_MAX_LENGTH,
  NOTIFICATION_SUMMARY_EMBEDDED_NOTIFICATION_ITEM_MESSAGE_MAX_LENGTH,
  sortNotificationItemsFunction
} from '@dereekb/firebase';
import { type FirebaseServerActionsContext } from '@dereekb/firebase-server';
import { type NotificationSummarySendService } from './notification.send.service';
import { type NotificationSendMessagesInstance } from './notification.send';
import { type Maybe, cutStringFunction, multiValueMapBuilder, runAsyncTasksForValues, takeLast } from '@dereekb/util';
import { makeNewNotificationSummaryTemplate } from './notification.util';

/**
 * Configuration for creating a {@link FirestoreNotificationSummarySendService}.
 */
export interface FirestoreNotificationSummarySendServiceConfig {
  /**
   * Whether to allow creating new {@link NotificationSummary} documents when one does not exist for a recipient.
   *
   * Defaults to true.
   */
  readonly allowCreateNotificationSummaries?: Maybe<boolean>;
  /**
   * Server context providing Firestore access, notification collections, and template type info.
   */
  readonly context: FirebaseServerActionsContext & NotificationFirestoreCollections & FirestoreContextReference & AppNotificationTemplateTypeInfoRecordServiceRef;
}

/**
 * Firestore-backed implementation of {@link NotificationSummarySendService} that persists
 * notification items to {@link NotificationSummary} documents in Firestore.
 */
export type FirestoreNotificationSummarySendService = NotificationSummarySendService;

/**
 * Creates a {@link NotificationSummarySendService} that writes notification items to Firestore
 * {@link NotificationSummary} documents.
 *
 * Groups messages by their target {@link NotificationSummaryId}, deduplicates against existing items,
 * appends new items (capped at {@link NOTIFICATION_SUMMARY_ITEM_LIMIT}), and either updates the
 * existing summary or creates a new one (if `allowCreateNotificationSummaries` is enabled).
 *
 * Each summary update runs in a Firestore transaction to prevent concurrent write conflicts.
 *
 * @param config - service configuration including Firestore context and collection references
 * @returns a {@link NotificationSummarySendService} backed by Firestore
 *
 * @example
 * ```ts
 * const sendService = firestoreNotificationSummarySendService({
 *   context: serverActionsContext,
 *   allowCreateNotificationSummaries: true
 * });
 *
 * const sendInstance = await sendService.buildSendInstanceForNotificationSummaryMessages(messages);
 * const result = await sendInstance();
 * ```
 */
export function firestoreNotificationSummarySendService(config: FirestoreNotificationSummarySendServiceConfig): FirestoreNotificationSummarySendService {
  const { context, allowCreateNotificationSummaries: inputAllowCreateNotificationSummaries } = config;
  const { firestoreContext, notificationSummaryCollection } = context;

  const allowCreateNotificationSummaries = inputAllowCreateNotificationSummaries ?? true;

  const sendService: FirestoreNotificationSummarySendService = {
    async buildSendInstanceForNotificationSummaryMessages(notificationMessages: NotificationMessage[]): Promise<NotificationSendMessagesInstance<NotificationSendNotificationSummaryMessagesResult>> {
      const messagesGroupedByNotificationSummaryMapBuilder = multiValueMapBuilder<NotificationMessage, NotificationSummaryId>();

      notificationMessages.forEach((x) => {
        if (x.inputContext.recipient.s != null && x.item != null) {
          // only add to map builder if recipient id is defined
          messagesGroupedByNotificationSummaryMapBuilder.add(x.inputContext.recipient.s, x);
        }
      });

      const cutSubject = cutStringFunction({ maxLength: NOTIFICATION_SUMMARY_EMBEDDED_NOTIFICATION_ITEM_SUBJECT_MAX_LENGTH });
      const cutMessage = cutStringFunction({ maxLength: NOTIFICATION_SUMMARY_EMBEDDED_NOTIFICATION_ITEM_MESSAGE_MAX_LENGTH });

      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      const messagesGroups = messagesGroupedByNotificationSummaryMapBuilder.entries() as [NotificationSummaryId, NotificationMessage<{}>[]][];

      return async () => {
        const success: NotificationSummaryId[] = [];
        const failed: NotificationSummaryId[] = [];
        const ignored: NotificationSummaryId[] = [];

        await runAsyncTasksForValues(messagesGroups, async ([notificationSummaryId, messages]) => {
          await firestoreContext
            .runTransaction(async (transaction) => {
              const notificationSummaryDocument = notificationSummaryCollection.documentAccessorForTransaction(transaction).loadDocumentForId(notificationSummaryId as NotificationSummaryId);
              const notificationSummary = await notificationSummaryDocument.snapshotData();

              let updated = false;
              let updateTemplate: Maybe<Pick<NotificationSummary, 'n' | 'lat'>>;

              const existingMessages = notificationSummary?.n ?? [];
              const existingMessageIds = new Set(existingMessages.map((x) => x.id));

              // ignore any repeat messages
              const messagesToSend = messages.filter((x) => !existingMessageIds.has((x.item as NotificationItem).id));

              if (messagesToSend.length > 0) {
                // add the new items to existing n, then keep the last 1000
                const sortedN = [
                  ...existingMessages,
                  ...messagesToSend.map((x) => {
                    let message: string = '';

                    if (x.content.openingMessage) {
                      message = x.content.openingMessage;
                    }

                    if (x.content.closingMessage) {
                      message = (message ? message + '\n\n' : message) + x.content.closingMessage;
                    }

                    const item: NotificationItem = {
                      ...(x.item as NotificationItem),
                      s: cutSubject(x.content.title),
                      g: cutMessage(message)
                    };

                    return item;
                  })
                ].sort(sortNotificationItemsFunction);

                const n = takeLast(sortedN, NOTIFICATION_SUMMARY_ITEM_LIMIT);

                updateTemplate = {
                  n,
                  lat: new Date()
                };
              }

              if (updateTemplate != null) {
                if (notificationSummary != null) {
                  await notificationSummaryDocument.update(updateTemplate);
                  updated = true;
                } else if (allowCreateNotificationSummaries) {
                  // if it does not exist, and we are allowed to create new summaries, create it and add the new notifications
                  const createTemplate: NotificationSummary = {
                    ...makeNewNotificationSummaryTemplate(inferKeyFromTwoWayFlatFirestoreModelKey(notificationSummaryId)),
                    ...updateTemplate
                  };

                  await notificationSummaryDocument.create(createTemplate);
                  updated = true;
                }
              }

              return updated;
            })
            .then((updated) => {
              if (updated) {
                success.push(notificationSummaryId);
              } else {
                ignored.push(notificationSummaryId);
              }
            })
            .catch((e) => {
              console.error('firestoreNotificationSummarySendService(): failed updating notification summary', e);
              failed.push(notificationSummaryId);
            });
        });

        const sendResult: NotificationSendNotificationSummaryMessagesResult = {
          success,
          failed,
          ignored
        };

        return sendResult;
      };
    }
  };

  return sendService;
}
