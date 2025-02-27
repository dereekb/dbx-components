import {
  type NotificationFirestoreCollections,
  type FirestoreContextReference,
  type NotificationMessage,
  type AppNotificationTemplateTypeInfoRecordServiceRef,
  type NotificationSummaryId,
  type NotificationItem,
  NOTIFICATION_SUMMARY_ITEM_LIMIT,
  type NotificationSendNotificationSummaryMessagesResult,
  NotificationSummary,
  inferKeyFromTwoWayFlatFirestoreModelKey,
  NOTIFICATION_SUMMARY_EMBEDDED_NOTIFICATION_ITEM_SUBJECT_MAX_LENGTH,
  NOTIFICATION_SUMMARY_EMBEDDED_NOTIFICATION_ITEM_MESSAGE_MAX_LENGTH
} from '@dereekb/firebase';
import { type FirebaseServerActionsContext } from '@dereekb/firebase-server';
import { type NotificationSummarySendService } from './notification.send.service';
import { type NotificationSendMessagesInstance } from './notification.send';
import { Maybe, cutStringFunction, multiValueMapBuilder, runAsyncTasksForValues, takeLast } from '@dereekb/util';
import { makeNewNotificationSummaryTemplate } from './notification.util';

export interface FirestoreNotificationSummarySendServiceConfig {
  /**
   * Whether or not to allow the creation of new NotificationSummary objects if one does not exist for a message.
   *
   * Defaults to true.
   */
  readonly allowCreateNotificationSummaries?: Maybe<boolean>;
  readonly context: FirebaseServerActionsContext & NotificationFirestoreCollections & FirestoreContextReference & AppNotificationTemplateTypeInfoRecordServiceRef;
}

/**
 * Default NotificationSummarySendService implementation
 */
export type FirestoreNotificationSummarySendService = NotificationSummarySendService;

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
                // add the new items to existing n then keep the last 1000
                const n = takeLast(
                  existingMessages.concat(
                    messagesToSend.map((x) => {
                      const item: NotificationItem = {
                        ...(x.item as NotificationItem),
                        s: cutSubject(x.content.title),
                        g: cutMessage(x.content.openingMessage)
                      };

                      return item;
                    })
                  ),
                  NOTIFICATION_SUMMARY_ITEM_LIMIT
                );

                updateTemplate = {
                  n,
                  lat: new Date()
                };
              }

              if (updateTemplate != null) {
                if (notificationSummary != null) {
                  await notificationSummaryDocument.update(updateTemplate!);
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
