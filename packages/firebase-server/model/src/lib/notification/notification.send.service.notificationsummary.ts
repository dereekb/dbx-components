import { type NotificationFirestoreCollections, type FirestoreContextReference, type NotificationMessage, type AppNotificationTemplateTypeInfoRecordServiceRef, type NotificationSummaryId, type NotificationItem, NOTIFICATION_SUMMARY_ITEM_LIMIT, type NotificationSendNotificationSummaryMessagesResult } from '@dereekb/firebase';
import { type FirebaseServerActionsContext } from '@dereekb/firebase-server';
import { type NotificationSummarySendService } from './notification.send.service';
import { type NotificationSendMessagesInstance } from './notification.send';
import { multiValueMapBuilder, runAsyncTasksForValues, takeLast } from '@dereekb/util';

export interface FirestoreNotificationSummarySendServiceConfig {
  readonly context: FirebaseServerActionsContext & NotificationFirestoreCollections & FirestoreContextReference & AppNotificationTemplateTypeInfoRecordServiceRef;
}

/**
 * Default NotificationSummarySendService implementation
 */
export type FirestoreNotificationSummarySendService = NotificationSummarySendService;

export function firestoreNotificationSummarySendService(config: FirestoreNotificationSummarySendServiceConfig): FirestoreNotificationSummarySendService {
  const { context } = config;
  const { firestoreContext, notificationSummaryCollection } = context;

  const sendService: FirestoreNotificationSummarySendService = {
    async buildSendInstanceForNotificationSummaryMessages(notificationMessages: NotificationMessage[]): Promise<NotificationSendMessagesInstance<NotificationSendNotificationSummaryMessagesResult>> {
      const messagesGroupedByNotificationSummaryMapBuilder = multiValueMapBuilder<NotificationMessage, NotificationSummaryId>();

      notificationMessages.forEach((x) => {
        if (x.inputContext.recipient.s != null && x.item != null) {
          // only add to map builder if recipient id is defined
          messagesGroupedByNotificationSummaryMapBuilder.add(x.inputContext.recipient.s, x);
        }
      });

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

              if (notificationSummary != null) {
                const existingMessageIds = new Set(notificationSummary.n.map((x) => x.id));

                // ignore any repeat messages
                const messagesToSend = messages.filter((x) => !existingMessageIds.has((x.item as NotificationItem).id));

                if (messagesToSend.length > 0) {
                  // add the new items to existing n then keep the last 1000
                  const n = takeLast(
                    notificationSummary.n.concat(
                      messagesToSend.map((x) => {
                        const item: NotificationItem = {
                          ...(x.item as NotificationItem),
                          s: x.content.title,
                          g: x.content.openingMessage
                        };

                        return item;
                      })
                    ),
                    NOTIFICATION_SUMMARY_ITEM_LIMIT
                  );
                  await notificationSummaryDocument.update({ lat: new Date(), n });
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
