import { isPast, addMinutes, addHours } from 'date-fns';
import {
  type DocumentDataWithIdAndKey,
  type FirebaseAuthOwnershipKey,
  type FirestoreContextReference,
  type FirestoreDocumentSnapshotDataPair,
  type FirestoreModelKey,
  type ReadFirestoreModelKeyInput,
  type Transaction,
  firestoreDummyKey,
  getDocumentSnapshotDataPairs,
  inferKeyFromTwoWayFlatFirestoreModelKey,
  loadDocumentsForDocumentReferencesFromValues,
  readFirestoreModelKey,
  getDocumentSnapshotData,
  type AsyncNotificationUpdateAction,
  type NotificationDocument,
  type NotificationFirestoreCollections,
  CreateNotificationParams,
  type AsyncNotificationCreateAction,
  type AsyncNotificationBoxUpdateAction,
  UpdateNotificationBoxParams,
  type NotificationBoxDocument,
  UpdateNotificationBoxRecipientParams,
  SendNotificationParams,
  UpdateNotificationParams,
  type NotificationBoxRecipient,
  notificationBoxRecipientTemplateConfigArrayToMap,
  SendQueuedNotificationsParams,
  type SendQueuedNotificationsResult,
  type SendNotificationResult,
  CleanupSentNotificationsParams,
  type CleanupSentNotificationsResult,
  notificationsPastSendAtTimeQuery,
  type Notification,
  type NotificationItem,
  NotificationSendType,
  type NotificationRecipientWithConfig,
  NotificationSendState,
  type NotificationBox,
  type NotificationTemplateType,
  type AsyncNotificationBoxCreateAction,
  CreateNotificationBoxParams,
  type NotificationMessageInputContext,
  notificationSendFlagsImplyIsComplete,
  type NotificationSendFlags,
  notificationBoxIdForModel,
  notificationsReadyForCleanupQuery,
  type NotificationRecipientSendFlag,
  shouldSaveNotificationToNotificationWeek
} from '@dereekb/firebase';
import { type FirebaseServerActionsContext, type FirebaseServerAuthServiceRef, assertSnapshotData } from '@dereekb/firebase-server';
import { createNotificationIdRequiredError, notificationBoxRecipientDoesNotExistsError } from './notification.error';
import { type Maybe, performAsyncTasks, batch, invertBooleanReturnFunction, lastValue, makeValuesGroupMap, mergeObjects, sortAscendingIndexNumberRefFunction, filterMaybeValues } from '@dereekb/util';
import { type TransformAndValidateFunctionResult } from '@dereekb/model';
import { expandNotificationRecipients } from './notification.util';
import { yearWeekCode } from '@dereekb/date';
import { type NotificationTemplateServiceInstance, type NotificationTemplateServiceRef } from './notification.config.service';
import { type NotificationSendServiceRef } from './notification.send.service';
import { type NotificationSendMessagesInstance } from './notification.send';
import { type InjectionToken } from '@nestjs/common';

/**
 * Injection token for the BaseNotificationServerActionsContext
 */
export const BASE_NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN: InjectionToken = 'BASE_NOTIFICATION_SERVER_ACTION_CONTEXT';

/**
 * Injection token for the NotificationServerActionsContext
 */
export const NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN: InjectionToken = 'NOTIFICATION_SERVER_ACTION_CONTEXT';

export interface BaseNotificationServerActionsContext extends FirebaseServerActionsContext, NotificationFirestoreCollections, FirebaseServerAuthServiceRef, FirestoreContextReference {}
export interface NotificationServerActionsContext extends FirebaseServerActionsContext, NotificationFirestoreCollections, FirebaseServerAuthServiceRef, NotificationTemplateServiceRef, NotificationSendServiceRef, FirestoreContextReference {}

export abstract class NotificationServerActions {
  abstract createNotificationBox(params: CreateNotificationBoxParams): AsyncNotificationBoxCreateAction<CreateNotificationBoxParams>;
  abstract updateNotificationBox(params: UpdateNotificationBoxParams): AsyncNotificationBoxUpdateAction<UpdateNotificationBoxParams>;
  abstract updateNotificationBoxRecipient(params: UpdateNotificationBoxRecipientParams): AsyncNotificationBoxUpdateAction<UpdateNotificationBoxRecipientParams>;
  abstract createNotification(params: CreateNotificationParams): AsyncNotificationCreateAction<CreateNotificationParams>;
  abstract updateNotification(params: UpdateNotificationParams): AsyncNotificationUpdateAction<UpdateNotificationParams>;
  abstract sendNotification(params: SendNotificationParams): Promise<TransformAndValidateFunctionResult<SendNotificationParams, (notificationDocument: NotificationDocument) => Promise<SendNotificationResult>>>;
  abstract sendQueuedNotifications(params: SendQueuedNotificationsParams): Promise<TransformAndValidateFunctionResult<SendQueuedNotificationsParams, () => Promise<SendQueuedNotificationsResult>>>;
  abstract cleanupSentNotifications(params: CleanupSentNotificationsParams): Promise<TransformAndValidateFunctionResult<CleanupSentNotificationsParams, () => Promise<CleanupSentNotificationsResult>>>;
}

export function notificationServerActions(context: NotificationServerActionsContext): NotificationServerActions {
  return {
    createNotificationBox: createNotificationBoxFactory(context),
    updateNotificationBox: updateNotificationBoxFactory(context),
    updateNotificationBoxRecipient: updateNotificationBoxRecipientFactory(context),
    createNotification: createNotificationFactory(context),
    updateNotification: updateNotificationFactory(context),
    sendNotification: sendNotificationFactory(context),
    sendQueuedNotifications: sendQueuedNotificationsFactory(context),
    cleanupSentNotifications: cleanupSentNotificationsFactory(context)
  };
}

// MARK: Actions
/**
 * Used for creating a new NotificationBox within a transaction.
 *
 * Used for new models.
 */
export interface CreateNotificationBoxInTransactionParams {
  /**
   * Now date to use.
   */
  now?: Date;
  /**
   * Model to create the box for.
   */
  model: FirestoreModelKey;
}

export function createNotificationBoxInTransactionFactory(context: NotificationServerActionsContext) {
  const { notificationBoxCollection } = context;
  return async (params: CreateNotificationBoxInTransactionParams, transaction: Transaction) => {
    const { now = new Date(), model } = params;

    const notificationBoxId = notificationBoxIdForModel(model);
    const notificationBoxDocument: NotificationBoxDocument = notificationBoxCollection.documentAccessorForTransaction(transaction).loadDocumentForId(notificationBoxId);

    const notificationBoxTemplate: NotificationBox = {
      m: model,
      o: firestoreDummyKey(), // set during initialization
      r: [],
      cat: now,
      w: yearWeekCode(now),
      s: true // requires initialization
    };

    await notificationBoxDocument.create(notificationBoxTemplate);

    return {
      notificationBoxTemplate,
      notificationBoxDocument
    };
  };
}

export function createNotificationBoxFactory(context: NotificationServerActionsContext) {
  const { firestoreContext, authService, notificationBoxCollection, firebaseServerActionTransformFunctionFactory } = context;
  const createNotificationBoxInTransaction = createNotificationBoxInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(CreateNotificationBoxParams, async (params) => {
    const { model } = params;

    return async () => {
      const result = await firestoreContext.runTransaction(async (transaction) => {
        const { notificationBoxDocument } = await createNotificationBoxInTransaction(
          {
            model
          },
          transaction
        );

        return notificationBoxDocument;
      });

      return notificationBoxCollection.documentAccessor().loadDocumentFrom(result);
    };
  });
}

export function updateNotificationBoxFactory({ firebaseServerActionTransformFunctionFactory }: NotificationServerActionsContext) {
  return firebaseServerActionTransformFunctionFactory(UpdateNotificationBoxParams, async () => {
    return async (notificationBoxDocument: NotificationBoxDocument) => {
      // does nothing currently.

      return notificationBoxDocument;
    };
  });
}

export function updateNotificationBoxRecipientFactory({ firestoreContext, notificationBoxCollection, firebaseServerActionTransformFunctionFactory }: NotificationServerActionsContext) {
  return firebaseServerActionTransformFunctionFactory(UpdateNotificationBoxRecipientParams, async (params) => {
    const { uid, i, e, p, insert, remove, configs: inputC } = params;

    const findRecipientFn = (x: NotificationBoxRecipient) => (uid != null && x.uid === uid) || (i != null && i === i);

    return async (notificationBoxDocument: NotificationBoxDocument) => {
      await firestoreContext.runTransaction(async () => {
        const notificationBoxDocumentInTransaction = notificationBoxCollection.documentAccessor().loadDocumentFrom(notificationBoxDocument);
        const notificationBox = await assertSnapshotData(notificationBoxDocumentInTransaction);

        let r: Maybe<NotificationBoxRecipient[]>;

        if (remove) {
          r = [...notificationBox.r].filter(invertBooleanReturnFunction(findRecipientFn)); // remove if they exist.

          if (r.length === notificationBox.r.length) {
            r = undefined; // no update if there was no change
          }
        } else {
          const targetRecipientIndex = notificationBox.r.findIndex(findRecipientFn);
          const targetRecipient = notificationBox.r[targetRecipientIndex] as NotificationBoxRecipient | undefined;

          if (!targetRecipient && !insert) {
            throw notificationBoxRecipientDoesNotExistsError();
          }

          let nextRecipient: NotificationBoxRecipient;

          const c = (inputC != null ? notificationBoxRecipientTemplateConfigArrayToMap(inputC) : targetRecipient?.c) ?? {};
          const nextI = (lastValue(r)?.i ?? -1) + 1; // r is sorted by index in ascending order, so the last value is the largest i

          nextRecipient = {
            uid,
            i: nextI,
            c,
            e,
            t: p
          };

          if (targetRecipient) {
            nextRecipient.i = targetRecipient.i;
            nextRecipient = mergeObjects([targetRecipient, nextRecipient]) as NotificationBoxRecipient;
          }

          // add to array and re-sort by index
          r = [...notificationBox.r, nextRecipient].sort(sortAscendingIndexNumberRefFunction());
        }

        if (r != null) {
          await notificationBoxDocumentInTransaction.update({ r });
        }
      });

      return notificationBoxDocument;
    };
  });
}

export interface CreateNotificationInTransactionParams {
  /**
   * The target model associated with a NotificationBox to create for.
   *
   * The NotificationBox may not exist.
   */
  readonly createFor?: ReadFirestoreModelKeyInput<any>;
  /**
   * Notification box to create the items in. Does not need to exist.
   */
  readonly notificationBox?: NotificationBoxDocument;
  /**
   * Notification send type
   */
  readonly sendType: NotificationSendType;
  /**
   * Optional send flag
   */
  readonly recipientSendFlag?: Maybe<NotificationRecipientSendFlag>;
  /**
   * Notification item details
   */
  readonly item: Omit<NotificationItem<any>, 'id' | 'cat'>;
  /**
   * Target time to send the notification at.
   *
   * Delivery at this time specifically is not guranteed.
   */
  readonly sendAt?: Maybe<Date>;
  /**
   * Additional embedded recipients, if applicable.
   */
  readonly additionalRecipients?: Maybe<NotificationRecipientWithConfig[]>;
  /**
   * Whether or not to send emails. Defaults to true.
   */
  readonly sendEmails?: boolean;
  /**
   * Whether or not to send emails. Defaults to true.
   */
  readonly sendTexts?: boolean;
  /**
   * Whether or not to send push notifications. Defaults to true.
   */
  readonly sendPushNotifications?: boolean;
  /**
   * Whether or not to send to notification summaries. Defaults to true.
   */
  readonly sendToNotificationSummary?: boolean;
  /**
   * Ownership key for the notification.
   */
  readonly ownershipKey?: FirebaseAuthOwnershipKey;
}

export function createNotificationInTransactionFactory(context: NotificationServerActionsContext) {
  const { notificationCollectionFactory, notificationBoxCollection } = context;
  return async (params: CreateNotificationInTransactionParams, transaction: Transaction) => {
    const { createFor, notificationBox: inputNotificationBox, sendType, recipientSendFlag, item, sendAt, additionalRecipients, sendEmails = true, sendTexts = true, sendPushNotifications = true, sendToNotificationSummary = true, ownershipKey } = params;

    let id: Maybe<string> = inputNotificationBox?.id;

    if (!id && createFor != null) {
      const modelKey = readFirestoreModelKey(createFor, false);

      if (modelKey != null) {
        id = notificationBoxIdForModel(modelKey);
      }
    }

    if (!id) {
      throw createNotificationIdRequiredError();
    }

    const notificationBoxInTransaction = notificationBoxCollection.documentAccessorForTransaction(transaction).loadDocumentForId(id);
    const notificationDocument = notificationCollectionFactory(notificationBoxInTransaction).documentAccessorForTransaction(transaction).newDocument();

    await notificationDocument.create({
      st: sendType,
      r: additionalRecipients ?? [],
      rf: recipientSendFlag,
      es: sendEmails ? NotificationSendState.QUEUED : NotificationSendState.NONE,
      ts: sendTexts ? NotificationSendState.QUEUED : NotificationSendState.NONE,
      ps: sendPushNotifications ? NotificationSendState.QUEUED : NotificationSendState.NONE,
      ns: sendToNotificationSummary ? NotificationSendState.QUEUED : NotificationSendState.NONE,
      n: {
        ...item,
        id: notificationDocument.id,
        cat: new Date()
      },
      sat: sendAt ?? new Date(),
      a: 0,
      d: false
    });

    return notificationDocument;
  };
}

export function createNotificationFactory(context: NotificationServerActionsContext) {
  const { firestoreContext, firebaseServerActionTransformFunctionFactory } = context;
  const createNotificationInTransaction = createNotificationInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(CreateNotificationParams, async (params) => {
    const { t, m, s, g, d, r: additionalRecipients } = params;

    return async (notificationBoxDocument: NotificationBoxDocument) => {
      const createParams: CreateNotificationInTransactionParams = {
        notificationBox: notificationBoxDocument,
        additionalRecipients,
        item: {
          t,
          m,
          s,
          g,
          d
        },
        sendType: NotificationSendType.SEND_IF_BOX_EXISTS
      };

      const result = await firestoreContext.runTransaction((transaction) => createNotificationInTransaction(createParams, transaction));
      return result;
    };
  });
}

export function updateNotificationFactory({ firebaseServerActionTransformFunctionFactory }: NotificationServerActionsContext) {
  return firebaseServerActionTransformFunctionFactory(UpdateNotificationParams, async () => {
    return async (notificationDocument: NotificationDocument) => {
      // does nothing currently.

      return notificationDocument;
    };
  });
}

export const UNKNOWN_NOTIFICATION_TEMPLATE_TYPE_HOURS_DELAY = 8;
export const UNKNOWN_NOTIFICATION_TEMPLATE_TYPE_DELETE_AFTER_RETRY_ATTEMPTS = 3;
export const NOTIFICATION_MAX_SEND_ATTEMPTS = 5;
export const NOTIFICATION_BOX_NOT_INITIALIZED_DELAY_MINUTES = 8;

export function sendNotificationFactory(context: NotificationServerActionsContext) {
  const { notificationSendService, notificationTemplateService, authService, notificationBoxCollection, notificationCollectionGroup, firestoreContext, firebaseServerActionTransformFunctionFactory } = context;
  const createNotificationBoxInTransaction = createNotificationBoxInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(SendNotificationParams, async (params) => {
    const { ignoreSendAtThrottle } = params;

    return async (notificationDocument: NotificationDocument) => {
      // does nothing currently.

      const { throttled, tryRun, notification, createdBox, notificationBox, notificationBoxModelKey, deletedNotification, templateInstance, isKnownTemplateType } = await firestoreContext.runTransaction(async (transaction) => {
        const notificationBoxDocument = notificationBoxCollection.documentAccessorForTransaction(transaction).loadDocument(notificationDocument.parent);
        const notificationDocumentInTransaction = notificationCollectionGroup.documentAccessorForTransaction(transaction).loadDocumentFrom(notificationDocument);
        let [notificationBox, notification] = await Promise.all([notificationBoxDocument.snapshotData(), getDocumentSnapshotData(notificationDocumentInTransaction)]);
        const model = inferKeyFromTwoWayFlatFirestoreModelKey(notificationBoxDocument.id);

        let tryRun = true;
        let throttled = false;
        let nextSat: Maybe<Date>;

        if (!notification) {
          tryRun = false;
        } else if (!ignoreSendAtThrottle) {
          tryRun = isPast(notification.sat);

          if (tryRun) {
            nextSat = addMinutes(new Date(), 10); // try again in 10 minutes if not successful
          } else {
            throttled = true;
          }
        }

        let createdBox = false;
        let deletedNotification = false;
        let notificationBoxNeedsInitialization = false;
        let isKnownTemplateType: Maybe<boolean>;
        let templateInstance: Maybe<NotificationTemplateServiceInstance>;

        async function deleteNotification() {
          tryRun = false;
          await notificationDocumentInTransaction.accessor.delete();
          deletedNotification = true;
        }

        // create/init the notification box if necessary/configured.
        if (notification && tryRun) {
          // if we're still trying to run, check the template is ok. If not, cancel the run.
          const { t } = notification.n;

          templateInstance = notificationTemplateService.templateInstanceForType(t);
          isKnownTemplateType = templateInstance.isKnownType;

          if (!isKnownTemplateType) {
            // log the issue that an unknown notification was sent

            if (notification.a < UNKNOWN_NOTIFICATION_TEMPLATE_TYPE_DELETE_AFTER_RETRY_ATTEMPTS) {
              console.warn(`Unknown template type of "${t}" was found in a Notification. Send is being delayed by ${UNKNOWN_NOTIFICATION_TEMPLATE_TYPE_HOURS_DELAY} hours.`);
              // delay send for 12 hours, for a max of 24 hours incase it is an issue.
              nextSat = addHours(new Date(), UNKNOWN_NOTIFICATION_TEMPLATE_TYPE_HOURS_DELAY);
              tryRun = false;
            } else {
              console.warn(`Unknown template type of "${t}" was found in a Notification. The Notification has failed sending multiple times and is being deleted.`);
              // after attempting to send 3 times, delete it.
              await deleteNotification();
            }
          }

          // handle the notification box's absence
          if (!notificationBox && tryRun) {
            switch (notification.st) {
              case NotificationSendType.INIT_BOX_AND_SEND:
                const { notificationBoxTemplate } = await createNotificationBoxInTransaction(
                  {
                    model
                  },
                  transaction
                );

                notificationBox = notificationBoxTemplate;
                createdBox = true;
                break;
              case NotificationSendType.SEND_IF_BOX_EXISTS:
                // delete the notification since it won't get sent.
                await deleteNotification();
                break;
              case NotificationSendType.SEND_WITHOUT_CREATING_BOX:
                // continue with current tryRun
                break;
            }
          }

          // if the notification box is not initialized/synchronized yet, do not run.
          if (tryRun && notificationBox && notificationBox.s) {
            notificationBoxNeedsInitialization = true;
            tryRun = false;
            nextSat = addMinutes(new Date(), NOTIFICATION_BOX_NOT_INITIALIZED_DELAY_MINUTES);
          }
        }

        // update the notification send at time and attempt count
        if (notification != null && nextSat != null && !deletedNotification) {
          const isAtMaxAttempts = notification.a >= NOTIFICATION_MAX_SEND_ATTEMPTS;

          if (isAtMaxAttempts && notificationBoxNeedsInitialization) {
            await deleteNotification(); // just delete the notification if the box still hasn't been initialized successfully at this point.
          }

          if (!deletedNotification) {
            await notificationDocumentInTransaction.update({ sat: nextSat, a: notification.a + 1 });
          }
        }

        return {
          throttled,
          deletedNotification,
          createdBox,
          notificationBoxModelKey: model,
          notificationBox,
          notification,
          templateInstance,
          isKnownTemplateType,
          tryRun
        };
      });

      let success = false;
      let textsSent: Maybe<number>;
      let emailsSent: Maybe<number>;
      let pushNotificationsSent: Maybe<number>;
      let loadMessageFunctionFailure: boolean = false;
      let buildMessageFailure: boolean = false;
      let notificationMarkedDone: boolean = false;
      const notificationTemplateType: Maybe<NotificationTemplateType> = templateInstance?.type;

      // notification is only null/undefined if it didn't exist.
      if (notification != null) {
        if (tryRun && templateInstance != null) {
          // first load the message function
          const messageFunction = await templateInstance
            .loadMessageFunction({
              item: notification.n,
              notification,
              notificationBox: {
                m: notificationBoxModelKey
              }
            })
            .catch((e) => {
              loadMessageFunctionFailure = true;
              success = false;
              console.error(`Failed loading message function for type ${notificationTemplateType}: `, e);
              return undefined;
            });

          if (messageFunction) {
            // expand recipients
            const {
              emails: emailRecipients,
              texts: textRecipients,
              notificationSummaries: notificationSummaryRecipients
            } = await expandNotificationRecipients({
              notification,
              notificationBox,
              authService,
              globalRecipients: messageFunction.additionalRecipients
            });

            let { es, ts, ps, ns } = notification;

            // do emails
            if (es === NotificationSendState.QUEUED) {
              const emailInputContexts: NotificationMessageInputContext[] = emailRecipients.map((x) => {
                const context: NotificationMessageInputContext = {
                  recipient: {
                    n: x.name,
                    e: x.emailAddress,
                    t: x.phoneNumber
                  }
                };

                return context;
              });

              const emailMessages = await Promise.all(emailInputContexts.map(messageFunction)).catch((e) => {
                console.error(`Failed building message function for type ${notificationTemplateType}: `, e);
                buildMessageFailure = true;
                return undefined;
              });

              if (emailMessages?.length) {
                if (notificationSendService.emailSendService != null) {
                  let sendInstance: Maybe<NotificationSendMessagesInstance>;

                  try {
                    sendInstance = await notificationSendService.emailSendService.buildSendInstanceForEmailNotificationMessages(emailMessages);
                  } catch (e) {
                    console.error(`Failed building email send instance for notification "${notification.id}" with type "${notificationTemplateType}": `, e);
                    es = NotificationSendState.CONFIG_ERROR;
                  }

                  if (sendInstance) {
                    try {
                      await sendInstance();
                      emailsSent = emailMessages.length;
                      es = NotificationSendState.SENT;
                    } catch (e) {
                      console.error(`Failed sending email notification "${notification.id}" with type "${notificationTemplateType}": `, e);
                      es = NotificationSendState.SEND_ERROR;
                    }
                  }
                } else {
                  console.error(`Failed sending email notification "${notification.id}" with type "${notificationTemplateType}" due to no email service being configured.`);
                  es = NotificationSendState.CONFIG_ERROR;
                }
              } else {
                emailsSent = 0;
                es = NotificationSendState.SENT;
              }
            }

            // TODO: send texts, etc.
            ts = NotificationSendState.NO_TRY;
            ps = NotificationSendState.NO_TRY;

            // do notification summaries
            if (ns === NotificationSendState.QUEUED) {
              // TODO: add notifications to respective notification summaries...
            }

            // calculate results
            const notificationTemplate: NotificationSendFlags & Partial<Notification> = { es, ts, ps, ns };

            success = notificationSendFlagsImplyIsComplete(notificationTemplate);

            if (success) {
              notificationTemplate.d = true;
            } else {
              notificationTemplate.a = notification.a + 1;

              if (notificationTemplate.a >= NOTIFICATION_MAX_SEND_ATTEMPTS) {
                notificationTemplate.d = true;
              }
            }

            await notificationDocument.update(notificationTemplate);
            notificationMarkedDone = notificationTemplate.d === true;
          }
        } else {
          switch (notification.st) {
            case NotificationSendType.SEND_IF_BOX_EXISTS:
              // deleted successfully
              success = deletedNotification;
              break;
          }
        }
      }

      const result: SendNotificationResult = {
        notificationTemplateType,
        isKnownTemplateType,
        throttled,
        exists: notification != null,
        boxExists: notificationBox != null,
        createdBox,
        deletedNotification,
        notificationMarkedDone,
        tryRun,
        success,
        textsSent,
        emailsSent,
        pushNotificationsSent,
        loadMessageFunctionFailure,
        buildMessageFailure
      };

      return result;
    };
  });
}

export function sendQueuedNotificationsFactory(context: NotificationServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory, notificationCollectionGroup } = context;
  const sendNotification = sendNotificationFactory(context);

  return firebaseServerActionTransformFunctionFactory(SendQueuedNotificationsParams, async () => {
    return async () => {
      let notificationBoxesCreated: number = 0;
      let notificationsDeleted: number = 0;
      let notificationsVisited: number = 0;
      let notificationsSucceeded: number = 0;
      let notificationsFailed: number = 0;
      let textsSent: number = 0;
      let emailsSent: number = 0;
      let pushNotificationsSent: number = 0;

      const sendNotificationParams: SendNotificationParams = { key: firestoreDummyKey(), throwErrorIfSent: false };
      const sendNotificationInstance = await sendNotification(sendNotificationParams);

      // iterate through all JobApplication items that need to be synced
      while (true) {
        const sendQueuedNotificationsResults = await sendQueuedNotifications();

        sendQueuedNotificationsResults.results.forEach((x) => {
          const result = x[1];

          if (result.success) {
            notificationsSucceeded += 1;
          } else {
            notificationsFailed += 1;
          }

          if (result.deletedNotification) {
            notificationsDeleted += 1;
          }

          if (result.boxExists) {
            notificationBoxesCreated += 1;
          }

          textsSent += result.textsSent ?? 0;
          emailsSent += result.emailsSent ?? 0;
          pushNotificationsSent += result.pushNotificationsSent ?? 0;
        });

        const found = sendQueuedNotificationsResults.results.length;
        notificationsVisited += found;

        if (!found) {
          break;
        }
      }

      async function sendQueuedNotifications() {
        const query = notificationCollectionGroup.queryDocument(notificationsPastSendAtTimeQuery());
        const notificationDocuments = await query.getDocs();

        const result = await performAsyncTasks(
          notificationDocuments,
          async (notificationDocument) => {
            const result = await sendNotificationInstance(notificationDocument);
            return result;
          },
          {
            maxParallelTasks: 10
          }
        );

        return result;
      }

      const result: SendQueuedNotificationsResult = {
        notificationBoxesCreated,
        notificationsDeleted,
        notificationsVisited,
        notificationsSucceeded,
        notificationsFailed,
        textsSent,
        emailsSent,
        pushNotificationsSent
      };

      return result;
    };
  });
}

export function cleanupSentNotificationsFactory(context: NotificationServerActionsContext) {
  const { firestoreContext, firebaseServerActionTransformFunctionFactory, notificationCollectionGroup, notificationCollectionFactory, notificationBoxCollection, notificationWeekCollectionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(CleanupSentNotificationsParams, async () => {
    return async () => {
      let notificationBoxesUpdatesCount: number = 0;
      let notificationsDeleted: number = 0;
      let notificationWeeksCreated: number = 0;
      let notificationWeeksUpdated: number = 0;

      // iterate through all JobApplication items that need to be synced
      while (true) {
        const cleanupSentNotificationsResults = await cleanupSentNotifications();

        cleanupSentNotificationsResults.results.forEach((x) => {
          const { itemsDeleted, weeksCreated, weeksUpdated } = x[1];

          notificationsDeleted += itemsDeleted;
          notificationWeeksCreated += weeksCreated;
          notificationWeeksUpdated += weeksUpdated;
        });

        const notificationBoxesUpdated = cleanupSentNotificationsResults.results.length;
        notificationBoxesUpdatesCount += notificationBoxesUpdated;

        if (!notificationBoxesUpdated) {
          break;
        }
      }

      async function cleanupSentNotifications() {
        const query = notificationCollectionGroup.queryDocument(notificationsReadyForCleanupQuery());
        const notificationDocuments = await query.getDocs();
        const notificationDocumentsGroupedByNotificationBox = Array.from(makeValuesGroupMap(notificationDocuments, (x) => x.parent.id).values());

        const result = await performAsyncTasks(
          notificationDocumentsGroupedByNotificationBox,
          async (notificationDocumentsInSameBox) => {
            const allPairs = await getDocumentSnapshotDataPairs(notificationDocumentsInSameBox);
            const allPairsWithDataAndMarkedDeleted = allPairs.filter((x) => x.data?.d);

            const pairsGroupedByWeek = Array.from(makeValuesGroupMap(allPairsWithDataAndMarkedDeleted, (x) => yearWeekCode((x.data as Notification).sat)).entries());

            // batch incase there are a lot of new notifications to move to week
            const pairsGroupedByWeekInBatches = pairsGroupedByWeek
              .map((x) => {
                const batches = batch(x[1], 40);
                return batches.map((batch) => [x[0], batch] as [number, FirestoreDocumentSnapshotDataPair<NotificationDocument>[]]);
              })
              .flat();

            const notificationBoxDocument = await notificationBoxCollection.documentAccessor().loadDocument(notificationDocumentsInSameBox[0].parent);

            // create/update the NotificationWeek
            const notificationWeekResults = await performAsyncTasks(pairsGroupedByWeekInBatches, async ([yearWeekCode, notificationDocumentsInSameWeek]) => {
              return firestoreContext.runTransaction(async (transaction) => {
                const notificationWeekDocument = notificationWeekCollectionFactory(notificationBoxDocument).documentAccessorForTransaction(transaction).loadDocumentForId(`${yearWeekCode}`);
                const notificationDocumentsInTransaction = loadDocumentsForDocumentReferencesFromValues(notificationCollectionGroup.documentAccessorForTransaction(transaction), notificationDocumentsInSameWeek, (x) => x.snapshot.ref);

                const notificationWeek = await notificationWeekDocument.snapshotData();

                const newItems: NotificationItem[] = filterMaybeValues(
                  notificationDocumentsInSameWeek.map((x) => {
                    const data = x.data as DocumentDataWithIdAndKey<Notification>;
                    const shouldSaveToNotificationWeek = shouldSaveNotificationToNotificationWeek(data);
                    return shouldSaveToNotificationWeek ? data.n : undefined;
                  })
                );

                const n: NotificationItem[] = [...(notificationWeek?.n ?? []), ...newItems];

                if (!notificationWeek) {
                  // create
                  await notificationWeekDocument.create({
                    w: yearWeekCode,
                    n
                  });
                } else {
                  // update
                  await notificationWeekDocument.update({
                    n
                  });
                }

                // delete the notification items
                await Promise.all(notificationDocumentsInTransaction.map((x) => x.accessor.delete()));

                return {
                  created: !notificationWeek
                };
              });
            });

            let weeksCreated = 0;
            let weeksUpdated = 0;

            notificationWeekResults.results.forEach((x) => {
              if (x[1].created) {
                weeksCreated += 1;
              } else {
                weeksUpdated += 1;
              }
            });

            const result = {
              weeksCreated,
              weeksUpdated,
              itemsDeleted: allPairsWithDataAndMarkedDeleted.length
            };

            return result;
          },
          {
            maxParallelTasks: 10
          }
        );

        return result;
      }

      const result: CleanupSentNotificationsResult = {
        notificationBoxesUpdatesCount,
        notificationsDeleted,
        notificationWeeksCreated,
        notificationWeeksUpdated
      };

      return result;
    };
  });
}
