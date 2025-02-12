import { yearWeekCode } from '@dereekb/date';
import {
  AsyncNotificationSummaryCreateAction,
  AsyncNotificationUserCreateAction,
  AsyncNotificationUserUpdateAction,
  CleanupSentNotificationsParams,
  CreateNotificationBoxParams,
  CreateNotificationParams,
  CreateNotificationSummaryParams,
  CreateNotificationUserParams,
  NotificationSendState,
  NotificationSendType,
  NotificationSummary,
  NotificationSummaryDocument,
  NotificationUser,
  NotificationUserDocument,
  SendNotificationParams,
  SendQueuedNotificationsParams,
  UpdateNotificationBoxParams,
  UpdateNotificationBoxRecipientParams,
  UpdateNotificationParams,
  UpdateNotificationUserParams,
  firestoreDummyKey,
  getDocumentSnapshotData,
  getDocumentSnapshotDataPairs,
  inferKeyFromTwoWayFlatFirestoreModelKey,
  loadDocumentsForDocumentReferencesFromValues,
  mergeNotificationBoxRecipients,
  notificationBoxIdForModel,
  notificationBoxRecipientTemplateConfigArrayToRecord,
  notificationSendFlagsImplyIsComplete,
  notificationSummaryIdForModel,
  notificationsPastSendAtTimeQuery,
  notificationsReadyForCleanupQuery,
  readFirestoreModelKey,
  shouldSaveNotificationToNotificationWeek,
  type AsyncNotificationBoxCreateAction,
  type AsyncNotificationBoxUpdateAction,
  type AsyncNotificationCreateAction,
  type AsyncNotificationUpdateAction,
  type CleanupSentNotificationsResult,
  type DocumentDataWithIdAndKey,
  type FirebaseAuthOwnershipKey,
  type FirestoreContextReference,
  type FirestoreDocumentSnapshotDataPair,
  type FirestoreModelKey,
  type Notification,
  type NotificationBox,
  type NotificationBoxDocument,
  type NotificationBoxRecipient,
  type NotificationDocument,
  type NotificationFirestoreCollections,
  type NotificationItem,
  type NotificationMessageInputContext,
  type NotificationRecipientSendFlag,
  type NotificationRecipientWithConfig,
  type NotificationSendFlags,
  type NotificationTemplateType,
  type ReadFirestoreModelKeyInput,
  type SendNotificationResult,
  type SendQueuedNotificationsResult,
  type Transaction,
  updateNotificationRecipient,
  updateNotificationUserDefaultNotificationBoxRecipientConfig,
  updateNotificationUserNotificationBoxRecipientConfigs,
  ResyncAllNotificationUserNotificationBoxConfigsParams,
  ResyncAllNotificationUserNotificationBoxConfigsResult,
  ResyncNotificationUserNotificationBoxConfigsResult,
  ResyncNotificationUserNotificationBoxConfigsParams,
  loadDocumentsForIdsFromValues,
  loadDocumentsForIds,
  getDocumentSnapshotsData,
  NotificationBoxId,
  AppNotificationTemplateTypeDetailsRecordServiceRef,
  NotificationBoxRecipientTemplateConfigRecord,
  NotificationUserNotificationBoxRecipientConfig,
  iterateFirestoreDocumentSnapshotPairs,
  notificationUsersFlaggedForNeedsSyncQuery
} from '@dereekb/firebase';
import { assertSnapshotData, type FirebaseServerActionsContext, type FirebaseServerAuthServiceRef } from '@dereekb/firebase-server';
import { type TransformAndValidateFunctionResult } from '@dereekb/model';
import { UNSET_INDEX_NUMBER, batch, computeNextFreeIndexOnSortedValuesFunction, filterMaybeValues, makeValuesGroupMap, performAsyncTasks, readIndexNumber, type Maybe, makeModelMap, filterKeyValueTuples, filterTuplesOnPOJOFunction, filterKeysOnPOJOFunction, removeValuesAtIndexesFromArrayCopy, replaceCharacterAtIndexWith, takeFront, areEqualPOJOValues } from '@dereekb/util';
import { type InjectionToken } from '@nestjs/common';
import { addHours, addMinutes, isPast } from 'date-fns';
import { type NotificationTemplateServiceInstance, type NotificationTemplateServiceRef } from './notification.config.service';
import { createNotificationIdRequiredError, notificationBoxRecipientDoesNotExistsError, notificationUserInvalidUidForCreateError } from './notification.error';
import { type NotificationSendMessagesInstance } from './notification.send';
import { type NotificationSendServiceRef } from './notification.send.service';
import { expandNotificationRecipients, updateNotificationUserNotificationBoxRecipientConfig } from './notification.util';

/**
 * Injection token for the BaseNotificationServerActionsContext
 */
export const BASE_NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN: InjectionToken = 'BASE_NOTIFICATION_SERVER_ACTION_CONTEXT';

/**
 * Injection token for the NotificationServerActionsContext
 */
export const NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN: InjectionToken = 'NOTIFICATION_SERVER_ACTION_CONTEXT';

export interface BaseNotificationServerActionsContext extends FirebaseServerActionsContext, NotificationFirestoreCollections, FirebaseServerAuthServiceRef, FirestoreContextReference {}
export interface NotificationServerActionsContext extends FirebaseServerActionsContext, NotificationFirestoreCollections, AppNotificationTemplateTypeDetailsRecordServiceRef, FirebaseServerAuthServiceRef, NotificationTemplateServiceRef, NotificationSendServiceRef, FirestoreContextReference {}

export abstract class NotificationServerActions {
  abstract createNotificationUser(params: CreateNotificationUserParams): AsyncNotificationUserCreateAction<CreateNotificationUserParams>;
  abstract updateNotificationUser(params: UpdateNotificationUserParams): AsyncNotificationUserUpdateAction<UpdateNotificationUserParams>;
  abstract resyncNotificationUserNotificationBoxConfigs(params: ResyncNotificationUserNotificationBoxConfigsParams): Promise<TransformAndValidateFunctionResult<ResyncNotificationUserNotificationBoxConfigsParams, (notificationUserDocument: NotificationUserDocument) => Promise<ResyncNotificationUserNotificationBoxConfigsResult>>>;
  abstract resyncAllNotificationUserNotificationBoxConfigs(params?: ResyncAllNotificationUserNotificationBoxConfigsParams): Promise<ResyncAllNotificationUserNotificationBoxConfigsResult>;
  abstract createNotificationSummary(params: CreateNotificationSummaryParams): AsyncNotificationSummaryCreateAction<CreateNotificationSummaryParams>;
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
    createNotificationUser: createNotificationUserFactory(context),
    updateNotificationUser: updateNotificationUserFactory(context),
    resyncNotificationUserNotificationBoxConfigs: resyncNotificationUserNotificationBoxConfigsFactory(context),
    resyncAllNotificationUserNotificationBoxConfigs: resyncAllNotificationUserNotificationBoxConfigsFactory(context),
    createNotificationSummary: createNotificationSummaryFactory(context),
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
export function createNotificationUserFactory(context: NotificationServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory, notificationUserCollection, authService } = context;

  return firebaseServerActionTransformFunctionFactory(CreateNotificationUserParams, async (params) => {
    const { uid } = params;

    return async () => {
      // assert they exist in the auth system
      const userContext = authService.userContext(uid);
      const userExistsInAuth = await userContext.exists();

      if (!userExistsInAuth) {
        throw notificationUserInvalidUidForCreateError(uid);
      }

      const notificationUserDocument = notificationUserCollection.documentAccessor().loadDocumentForId(uid);

      const newUserTemplate: NotificationUser = {
        uid,
        bc: [],
        b: [],
        dc: {
          c: {}
        },
        gc: {
          c: {}
        }
      };

      await notificationUserDocument.create(newUserTemplate);
      return notificationUserDocument;
    };
  });
}

export function updateNotificationUserFactory(context: NotificationServerActionsContext) {
  const { firestoreContext, firebaseServerActionTransformFunctionFactory, notificationUserCollection } = context;

  return firebaseServerActionTransformFunctionFactory(UpdateNotificationUserParams, async (params) => {
    const { gc: inputGc, dc: inputDc, bc: inputBc } = params;

    return async (notificationUserDocument: NotificationUserDocument) => {
      await firestoreContext.runTransaction(async (transaction) => {
        const notificationUserDocumentInTransaction = notificationUserCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(notificationUserDocument);
        const notificationUser = await assertSnapshotData(notificationUserDocumentInTransaction);

        let updateTemplate: Partial<NotificationUser> = {};

        if (inputDc != null) {
          updateTemplate.dc = updateNotificationUserDefaultNotificationBoxRecipientConfig(notificationUser.dc, inputDc);
        }

        if (inputGc != null) {
          updateTemplate.gc = updateNotificationUserDefaultNotificationBoxRecipientConfig(notificationUser.gc, inputGc);
          updateTemplate.bc = notificationUser.bc.map((x) => (x.rm ? x : { ...x, ns: true })); // flag all non-removed types as needing a sync
          updateTemplate.ns = true; // changing global settings changes trigger a resync
        }

        if (inputBc != null) {
          const updateTemplateBc = updateNotificationUserNotificationBoxRecipientConfigs(updateTemplate.bc ?? notificationUser.bc, inputBc);

          if (updateTemplateBc != null) {
            updateTemplate.ns = updateTemplate.ns || updateTemplateBc.some((x) => x.ns);
            updateTemplate.bc = updateTemplateBc;
            updateTemplate.b = updateTemplateBc.map((x) => x.nb);
          }
        }

        await notificationUserDocumentInTransaction.update(updateTemplate);
      });

      return notificationUserDocument;
    };
  });
}

const MAX_NOTIFICATION_BOXES_TO_UPDATE_PER_BATCH = 50;

export function resyncNotificationUserNotificationBoxConfigsFactory(context: NotificationServerActionsContext) {
  const { firestoreContext, firebaseServerActionTransformFunctionFactory, notificationBoxCollection, notificationUserCollection, appNotificationTemplateTypeDetailsRecordService } = context;

  return firebaseServerActionTransformFunctionFactory(ResyncNotificationUserNotificationBoxConfigsParams, async (params) => {
    return async (notificationUserDocument: NotificationUserDocument) => {
      // run updates in batches

      interface ResyncNotificationUserBatchResult {
        readonly notificationBoxesUpdatedInBatch: number;
        readonly hasMoreNotificationBoxesToSync: boolean;
      }

      let notificationBoxesUpdated = 0;
      let hasMoreNotificationBoxesToSync = true;

      while (hasMoreNotificationBoxesToSync) {
        const batchResult = await firestoreContext.runTransaction(async (transaction) => {
          const notificationUserDocumentInTransaction = notificationUserCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(notificationUserDocument);
          const notificationUser = await assertSnapshotData(notificationUserDocumentInTransaction);
          const { gc } = notificationUser;

          const notificationBoxConfigsToSync = notificationUser.bc.filter((x) => x.ns);
          const notificationBoxConfigsToSyncInThisBatch = takeFront(notificationBoxConfigsToSync, MAX_NOTIFICATION_BOXES_TO_UPDATE_PER_BATCH);

          /**
           * These are the actual number of NotificationBox values that had recipients updated.
           */
          let notificationBoxesUpdatedInBatch = 0;
          let hasUnsyncedNotificationBoxConfigs = false;

          if (notificationBoxConfigsToSyncInThisBatch.length > 0) {
            const notificationBoxConfigsToSyncInThisBatchMap = makeModelMap(notificationBoxConfigsToSyncInThisBatch, (x) => x.nb);

            const notificationBoxIdsToSyncInThisBatch = Array.from(notificationBoxConfigsToSyncInThisBatchMap.keys()) as string[];

            const notificationBoxDocuments = loadDocumentsForIds(notificationBoxCollection.documentAccessorForTransaction(transaction), notificationBoxIdsToSyncInThisBatch);
            const notificationBoxDocumentSnapshotDataPairs = await getDocumentSnapshotDataPairs(notificationBoxDocuments);

            const notificationBoxConfigsToRemoveFromNotificationUser = new Set<NotificationBoxId>();
            const notificationUserNotificationBoxConfigsToMarkAsRemoved = new Set<NotificationBoxId>();
            const updatedRecipientsMap = new Map<NotificationBoxId, Maybe<NotificationBoxRecipient>>();

            // update each NotificationBoxDocument
            await performAsyncTasks(notificationBoxDocumentSnapshotDataPairs, async (notificationBoxDocumentSnapshotDataPair) => {
              const { data: notificationBox, document } = notificationBoxDocumentSnapshotDataPair;
              const nb: NotificationBoxId = document.id;

              const notificationUserNotificationBoxConfig = notificationBoxConfigsToSyncInThisBatchMap.get(nb) as NotificationUserNotificationBoxRecipientConfig; // always exists

              if (!notificationBox) {
                // if the entire NotificationBox no longer exists, flag to remove it from the user as a cleanup measure
                notificationBoxConfigsToRemoveFromNotificationUser.add(nb);
              } else {
                // update in the NotificationBox
                const recipientIndex = notificationBox.r.findIndex((x) => x.uid === notificationUser.uid);

                let r: NotificationBoxRecipient[] | undefined;

                if (recipientIndex === -1) {
                  // if they are not in the NotificationBox, then mark them as removed on the user
                  notificationUserNotificationBoxConfigsToMarkAsRemoved.add(nb);
                } else if (notificationUserNotificationBoxConfig.rm) {
                  // remove from the notification box if it is flagged
                  r = removeValuesAtIndexesFromArrayCopy(notificationBox.r, recipientIndex);
                } else {
                  const { m } = notificationBox;

                  const applicableTemplateTypesForModel = appNotificationTemplateTypeDetailsRecordService.getTemplateTypesForNotificationModel(m);
                  const filterOnlyApplicableTemplateTypes = filterKeysOnPOJOFunction<NotificationBoxRecipientTemplateConfigRecord>(applicableTemplateTypesForModel);

                  const recipient = notificationBox.r[recipientIndex];

                  // retain only the relevant/applicable template types for the model associate with the notification box
                  const c = filterOnlyApplicableTemplateTypes({
                    ...recipient.c,
                    ...notificationUserNotificationBoxConfig.c,
                    ...gc.c
                  });

                  const nextRecipient: NotificationBoxRecipient = {
                    ...recipient,
                    c,
                    uid: notificationUser.uid, // index and uid are retained
                    i: recipient.i,
                    // copy from NotificationUser
                    f: gc.f ?? notificationUserNotificationBoxConfig.f ?? recipient.f,
                    lk: gc.lk ?? notificationUserNotificationBoxConfig.lk, // lock state only comes from NotificationUser
                    // email and text overrides first come from global, then the NotificationBox specific config
                    e: gc.e ?? notificationUserNotificationBoxConfig.e,
                    t: gc.t ?? notificationUserNotificationBoxConfig.t,
                    // no custom name or notification summary allowed
                    n: undefined,
                    s: undefined // should never be defined since uid is defined
                  };

                  // only update recipients if the next/new recipient is not equal to the existing one
                  if (!areEqualPOJOValues(nextRecipient, recipient)) {
                    r = [...notificationBox.r];
                    r[recipientIndex] = nextRecipient;
                    updatedRecipientsMap.set(nb, nextRecipient);
                  }
                }

                // update recipients if needed
                if (r != null) {
                  await document.update({ r });
                  notificationBoxesUpdatedInBatch++;
                }
              }
            });

            // Update the NotificationUser
            const notificationBoxIdsSynced = new Set(notificationBoxIdsToSyncInThisBatch);

            // start nextConfigs off as a new array with none of the sync'd ids
            const nextConfigs = notificationBoxConfigsToSyncInThisBatch.filter((x) => !notificationBoxIdsSynced.has(x.nb));

            notificationBoxIdsToSyncInThisBatch.forEach((nb) => {
              let nextConfig: Maybe<NotificationUserNotificationBoxRecipientConfig>;

              if (notificationBoxConfigsToRemoveFromNotificationUser.has(nb)) {
                // do nothing, as it should be removed
              } else {
                const existingConfig = notificationBoxConfigsToSyncInThisBatchMap.get(nb) as NotificationUserNotificationBoxRecipientConfig;

                if (notificationUserNotificationBoxConfigsToMarkAsRemoved.has(nb) || existingConfig.rm) {
                  // if the recipient was being removed or is marked as removed, then update the config to confirm removal
                  nextConfig = {
                    ...existingConfig,
                    nb,
                    rm: true,
                    i: UNSET_INDEX_NUMBER
                  };
                } else {
                  // else, use the updated recipient and keep/copy the
                  const updatedRecipient = updatedRecipientsMap.get(nb) as NotificationBoxRecipient;

                  nextConfig = {
                    ...existingConfig,
                    nb,
                    rm: false, // mark as not removed
                    i: updatedRecipient.i ?? UNSET_INDEX_NUMBER
                  };
                }
              }

              if (nextConfig != null) {
                nextConfigs.push(nextConfig);
              }
            });

            const ns = nextConfigs.some((x) => x.ns);
            await notificationUserDocumentInTransaction.update({ bc: nextConfigs, ns });
            hasUnsyncedNotificationBoxConfigs = ns;
          }

          const result: ResyncNotificationUserBatchResult = {
            hasMoreNotificationBoxesToSync: hasUnsyncedNotificationBoxConfigs,
            notificationBoxesUpdatedInBatch
          };

          return result;
        });

        hasMoreNotificationBoxesToSync = batchResult.hasMoreNotificationBoxesToSync;
        notificationBoxesUpdated += batchResult.notificationBoxesUpdatedInBatch;
      }

      const result: ResyncNotificationUserNotificationBoxConfigsResult = {
        notificationBoxesUpdated
      };

      return result;
    };
  });
}

export function resyncAllNotificationUserNotificationBoxConfigsFactory(context: NotificationServerActionsContext) {
  const { firestoreContext, firebaseServerActionTransformFunctionFactory, notificationUserCollection } = context;
  const resyncNotificationUser = resyncNotificationUserNotificationBoxConfigsFactory(context);

  return async (params?: ResyncAllNotificationUserNotificationBoxConfigsParams) => {
    let notificationBoxesUpdated = 0;

    const resyncNotificationUserParams: ResyncNotificationUserNotificationBoxConfigsParams = { key: firestoreDummyKey() };
    const resyncNotificationUserInstance = await resyncNotificationUser(resyncNotificationUserParams);

    const iterateResult = await iterateFirestoreDocumentSnapshotPairs({
      documentAccessor: notificationUserCollection.documentAccessor(),
      iterateSnapshotPair: async (snapshotPair) => {
        const { document: notificationUserDocument } = snapshotPair;

        const result = await resyncNotificationUserInstance(notificationUserDocument);
        notificationBoxesUpdated += result.notificationBoxesUpdated;
      },
      constraintsFactory: () => notificationUsersFlaggedForNeedsSyncQuery(),
      snapshotsPerformTasksConfig: {
        // prevent NotificationUsers with the same NotificationBoxes from being updated/sync'd at the same time
        nonConcurrentTaskKeyFactory: (x) => {
          const notificationBoxIdsToSync: NotificationBoxId[] = x
            .data()
            .bc.filter((x) => x.ns)
            .map((x) => x.nb);
          return notificationBoxIdsToSync;
        }
      },
      queryFactory: notificationUserCollection,
      batchSize: undefined,
      performTasksConfig: {
        maxParallelTasks: 10
      }
    });

    const result: ResyncAllNotificationUserNotificationBoxConfigsResult = {
      notificationUsersResynced: iterateResult.totalSnapshotsVisited,
      notificationBoxesUpdated: 0
    };

    return result;
  };
}

export function createNotificationSummaryFactory(context: NotificationServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory, notificationSummaryCollection, authService } = context;

  return firebaseServerActionTransformFunctionFactory(CreateNotificationSummaryParams, async (params) => {
    const { model } = params;

    return async () => {
      const notificationSummaryId = notificationSummaryIdForModel(model);
      const notificationSummaryDocument: NotificationSummaryDocument = notificationSummaryCollection.documentAccessor().loadDocumentForId(notificationSummaryId);

      const newSummaryTemplate: NotificationSummary = {
        cat: new Date(),
        m: model,
        o: firestoreDummyKey(),
        s: true,
        n: []
      };

      await notificationSummaryDocument.create(newSummaryTemplate);
      return notificationSummaryDocument;
    };
  });
}

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

export function updateNotificationBoxRecipientFactory({ firestoreContext, authService, notificationBoxCollection, notificationUserCollection, firebaseServerActionTransformFunctionFactory }: NotificationServerActionsContext) {
  return firebaseServerActionTransformFunctionFactory(UpdateNotificationBoxRecipientParams, async (params) => {
    const { uid, i, insert, remove, configs: inputC } = params;

    const findRecipientFn = (x: NotificationBoxRecipient) => (uid != null && x.uid === uid) || (i != null && i === i);

    return async (notificationBoxDocument: NotificationBoxDocument) => {
      await firestoreContext.runTransaction(async (transaction) => {
        const notificationBoxDocumentInTransaction = notificationBoxCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(notificationBoxDocument);
        const notificationBox = await assertSnapshotData(notificationBoxDocumentInTransaction);
        const { m } = notificationBox;

        let r: Maybe<NotificationBoxRecipient[]>;
        let targetRecipientIndex = notificationBox.r.findIndex(findRecipientFn);
        const targetRecipient = notificationBox.r[targetRecipientIndex] as NotificationBoxRecipient | undefined;
        let nextRecipient: Maybe<NotificationBoxRecipient>;

        if (remove) {
          if (targetRecipientIndex != null) {
            r = [...notificationBox.r]; // remove if they exist.
            delete r[targetRecipientIndex];
          }
        } else {
          if (!targetRecipient && !insert) {
            throw notificationBoxRecipientDoesNotExistsError();
          }

          const c = (inputC != null ? notificationBoxRecipientTemplateConfigArrayToRecord(inputC) : targetRecipient?.c) ?? {};

          nextRecipient = {
            uid,
            i: targetRecipient?.i ?? UNSET_INDEX_NUMBER,
            c,
            ...updateNotificationRecipient(targetRecipient ?? {}, params)
          };

          r = [...notificationBox.r];

          if (targetRecipient) {
            nextRecipient.i = targetRecipient.i;

            nextRecipient = mergeNotificationBoxRecipients(targetRecipient, nextRecipient) as NotificationBoxRecipient;
            r[targetRecipientIndex] = nextRecipient; // override in the array
          } else {
            const nextI = computeNextFreeIndexOnSortedValuesFunction(readIndexNumber)(notificationBox.r); // r is sorted by index in ascending order, so the last value is the largest i
            nextRecipient.i = nextI;

            // should have the greatest i value, push to end
            r.push(nextRecipient);
            targetRecipientIndex = r.length - 1;
          }
        }

        // save changes to r if it changed
        if (r != null) {
          const notificationUserId = targetRecipient?.uid ?? nextRecipient?.uid;

          // sync with the notification user's document, if it exists
          if (notificationUserId != null) {
            const notificationBoxId = notificationBoxDocument.id;
            const notificationUserDocument = await notificationUserCollection.documentAccessorForTransaction(transaction).loadDocumentForId(notificationUserId);

            let notificationUser = await notificationUserDocument.snapshotData();
            let createNotificationUser = !notificationUser && !remove && insert;

            if (createNotificationUser) {
              // assert they exist in the auth system
              const userContext = authService.userContext(notificationUserId);
              const userExistsInAuth = await userContext.exists();

              if (!userExistsInAuth) {
                throw notificationUserInvalidUidForCreateError(notificationUserId);
              }

              const notificationUserTemplate: NotificationUser = {
                uid: notificationUserId,
                b: [],
                bc: [],
                ns: false,
                dc: {
                  c: {}
                },
                gc: {
                  c: {}
                }
              };

              notificationUser = notificationUserTemplate;
            }

            // if the user is being inserted or exists, then make updates
            if (notificationUser != null) {
              let { updatedBc, updatedNotificationBoxRecipient } = updateNotificationUserNotificationBoxRecipientConfig({
                notificationBoxId,
                notificationUserId,
                notificationBoxAssociatedModelKey: m,
                notificationUser,
                insertingRecipientIntoNotificationBox: insert,
                removeRecipientFromNotificationBox: remove,
                notificationBoxRecipient: nextRecipient
              });

              let updatedB = updatedBc ? updatedBc.map((x) => x.nb) : undefined;

              if (createNotificationUser) {
                const newUserTemplate: NotificationUser = {
                  ...notificationUser,
                  bc: updatedBc ?? [],
                  b: updatedB ?? []
                };

                await notificationUserDocument.create(newUserTemplate);
              } else if (updatedBc != null) {
                await notificationUserDocument.update({ bc: updatedBc, b: updatedB });
              }

              // Set if nextRecipient is updated/influence from existing configuration
              if (targetRecipientIndex != null && updatedNotificationBoxRecipient && !remove) {
                r[targetRecipientIndex] = updatedNotificationBoxRecipient; // set the updated value in r
              }
            }

            // else, if removing and they don't exist, nothing to update
          }

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
  const { notificationSendService, notificationTemplateService, authService, notificationBoxCollection, notificationCollectionGroup, notificationUserCollection, firestoreContext, firebaseServerActionTransformFunctionFactory } = context;
  const createNotificationBoxInTransaction = createNotificationBoxInTransactionFactory(context);
  const notificationUserAccessor = notificationUserCollection.documentAccessor();

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
              notificationUserAccessor,
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
