import { isSameDate, yearWeekCode } from '@dereekb/date';
import {
  type AsyncNotificationSummaryCreateAction,
  type AsyncNotificationUserCreateAction,
  type AsyncNotificationUserUpdateAction,
  CleanupSentNotificationsParams,
  CreateNotificationBoxParams,
  CreateNotificationSummaryParams,
  CreateNotificationUserParams,
  NotificationSendState,
  NotificationSendType,
  type NotificationSummary,
  type NotificationSummaryDocument,
  type NotificationUser,
  type NotificationUserDocument,
  SendNotificationParams,
  SendQueuedNotificationsParams,
  UpdateNotificationBoxParams,
  UpdateNotificationBoxRecipientParams,
  UpdateNotificationUserParams,
  firestoreDummyKey,
  getDocumentSnapshotData,
  getDocumentSnapshotDataPairs,
  inferKeyFromTwoWayFlatFirestoreModelKey,
  loadDocumentsForDocumentReferencesFromValues,
  mergeNotificationBoxRecipients,
  notificationBoxRecipientTemplateConfigArrayToRecord,
  notificationSendFlagsImplyIsComplete,
  notificationSummaryIdForModel,
  notificationsPastSendAtTimeQuery,
  notificationsReadyForCleanupQuery,
  shouldSaveNotificationToNotificationWeek,
  type AsyncNotificationBoxCreateAction,
  type AsyncNotificationBoxUpdateAction,
  type CleanupSentNotificationsResult,
  type DocumentDataWithIdAndKey,
  type FirestoreContextReference,
  type FirestoreDocumentSnapshotDataPair,
  type Notification,
  type NotificationBox,
  type NotificationBoxDocument,
  type NotificationBoxRecipient,
  type NotificationDocument,
  type NotificationFirestoreCollections,
  type NotificationItem,
  type NotificationMessageInputContext,
  type NotificationSendFlags,
  type NotificationTemplateType,
  type SendNotificationResult,
  type SendQueuedNotificationsResult,
  type Transaction,
  updateNotificationRecipient,
  updateNotificationUserDefaultNotificationBoxRecipientConfig,
  updateNotificationUserNotificationBoxRecipientConfigs,
  type ResyncAllNotificationUserParams,
  type ResyncAllNotificationUsersResult,
  type ResyncNotificationUserResult,
  ResyncNotificationUserParams,
  loadDocumentsForIds,
  type NotificationBoxId,
  type AppNotificationTemplateTypeInfoRecordServiceRef,
  type NotificationUserNotificationBoxRecipientConfig,
  iterateFirestoreDocumentSnapshotPairs,
  notificationUsersFlaggedForNeedsSyncQuery,
  effectiveNotificationBoxRecipientConfig,
  type NotificationSendEmailMessagesResult,
  type NotificationSendNotificationSummaryMessagesResult,
  type NotificationSendTextMessagesResult,
  mergeNotificationSendMessagesResult,
  type AsyncNotificationSummaryUpdateAction,
  UpdateNotificationSummaryParams,
  type NotificationMessage,
  type NotificationBoxDocumentReferencePair,
  loadNotificationBoxDocumentForReferencePair,
  NotificationTask,
  NotificationTaskServiceTaskHandlerCompletionType,
  SendNotificationResultOnSendCompleteResult,
  NotificationMessageFunctionExtrasCallbackDetails,
  updateNotificationUserNotificationSendExclusions,
  setIdAndKeyFromKeyIdRefOnDocumentData,
  calculateNsForNotificationUserNotificationBoxRecipientConfigs,
  applyExclusionsToNotificationUserNotificationBoxRecipientConfigs
} from '@dereekb/firebase';
import { assertSnapshotData, type FirebaseServerActionsContext, type FirebaseServerAuthServiceRef } from '@dereekb/firebase-server';
import { type TransformAndValidateFunctionResult } from '@dereekb/model';
import { UNSET_INDEX_NUMBER, batch, computeNextFreeIndexOnSortedValuesFunction, filterMaybeArrayValues, makeValuesGroupMap, performAsyncTasks, readIndexNumber, type Maybe, makeModelMap, removeValuesAtIndexesFromArrayCopy, takeFront, areEqualPOJOValues, type EmailAddress, type E164PhoneNumber, asArray, separateValues, dateOrMillisecondsToDate, asPromise, filterOnlyUndefinedValues, iterablesAreSetEquivalent } from '@dereekb/util';
import { type InjectionToken } from '@nestjs/common';
import { addHours, addMinutes, hoursToMilliseconds, isFuture } from 'date-fns';
import { type NotificationTemplateServiceInstance, type NotificationTemplateServiceRef } from './notification.config.service';
import { notificationBoxDoesNotExist, notificationBoxExclusionTargetInvalidError, notificationBoxRecipientDoesNotExistsError, notificationUserInvalidUidForCreateError } from './notification.error';
import { type NotificationSendMessagesInstance } from './notification.send';
import { type NotificationSendServiceRef } from './notification.send.service';
import { expandNotificationRecipients, makeNewNotificationSummaryTemplate, updateNotificationUserNotificationBoxRecipientConfig } from './notification.util';
import { NotificationTaskServiceRef, NotificationTaskServiceTaskHandler } from './notification.task.service';
import { removeFromCompletionsArrayWithTaskResult } from './notification.task.service.util';

/**
 * Injection token for the BaseNotificationServerActionsContext
 */
export const BASE_NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN: InjectionToken = 'BASE_NOTIFICATION_SERVER_ACTION_CONTEXT';

/**
 * Injection token for the NotificationServerActionsContext
 */
export const NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN: InjectionToken = 'NOTIFICATION_SERVER_ACTION_CONTEXT';

export interface BaseNotificationServerActionsContext extends FirebaseServerActionsContext, NotificationFirestoreCollections, FirebaseServerAuthServiceRef, FirestoreContextReference {}
export interface NotificationServerActionsContext extends BaseNotificationServerActionsContext, AppNotificationTemplateTypeInfoRecordServiceRef, NotificationTemplateServiceRef, NotificationSendServiceRef, NotificationTaskServiceRef {}

export abstract class NotificationServerActions {
  abstract createNotificationUser(params: CreateNotificationUserParams): AsyncNotificationUserCreateAction<CreateNotificationUserParams>;
  abstract updateNotificationUser(params: UpdateNotificationUserParams): AsyncNotificationUserUpdateAction<UpdateNotificationUserParams>;
  abstract resyncNotificationUser(params: ResyncNotificationUserParams): Promise<TransformAndValidateFunctionResult<ResyncNotificationUserParams, (notificationUserDocument: NotificationUserDocument) => Promise<ResyncNotificationUserResult>>>;
  abstract resyncAllNotificationUsers(params?: ResyncAllNotificationUserParams): Promise<ResyncAllNotificationUsersResult>;
  abstract createNotificationSummary(params: CreateNotificationSummaryParams): AsyncNotificationSummaryCreateAction<CreateNotificationSummaryParams>;
  abstract updateNotificationSummary(params: UpdateNotificationSummaryParams): AsyncNotificationSummaryUpdateAction<UpdateNotificationSummaryParams>;
  abstract createNotificationBox(params: CreateNotificationBoxParams): AsyncNotificationBoxCreateAction<CreateNotificationBoxParams>;
  abstract updateNotificationBox(params: UpdateNotificationBoxParams): AsyncNotificationBoxUpdateAction<UpdateNotificationBoxParams>;
  abstract updateNotificationBoxRecipient(params: UpdateNotificationBoxRecipientParams): AsyncNotificationBoxUpdateAction<UpdateNotificationBoxRecipientParams>;
  abstract sendNotification(params: SendNotificationParams): Promise<TransformAndValidateFunctionResult<SendNotificationParams, (notificationDocument: NotificationDocument) => Promise<SendNotificationResult>>>;
  abstract sendQueuedNotifications(params: SendQueuedNotificationsParams): Promise<TransformAndValidateFunctionResult<SendQueuedNotificationsParams, () => Promise<SendQueuedNotificationsResult>>>;
  abstract cleanupSentNotifications(params: CleanupSentNotificationsParams): Promise<TransformAndValidateFunctionResult<CleanupSentNotificationsParams, () => Promise<CleanupSentNotificationsResult>>>;
}

export function notificationServerActions(context: NotificationServerActionsContext): NotificationServerActions {
  return {
    createNotificationUser: createNotificationUserFactory(context),
    updateNotificationUser: updateNotificationUserFactory(context),
    resyncNotificationUser: resyncNotificationUserFactory(context),
    resyncAllNotificationUsers: resyncAllNotificationUsersFactory(context),
    createNotificationSummary: createNotificationSummaryFactory(context),
    updateNotificationSummary: updateNotificationSummaryFactory(context),
    createNotificationBox: createNotificationBoxFactory(context),
    updateNotificationBox: updateNotificationBoxFactory(context),
    updateNotificationBoxRecipient: updateNotificationBoxRecipientFactory(context),
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
        x: [],
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
  const { firestoreContext, firebaseServerActionTransformFunctionFactory, notificationUserCollection, appNotificationTemplateTypeInfoRecordService } = context;

  return firebaseServerActionTransformFunctionFactory(UpdateNotificationUserParams, async (params) => {
    const { gc: inputGc, dc: inputDc, bc: inputBc } = params;

    return async (notificationUserDocument: NotificationUserDocument) => {
      await firestoreContext.runTransaction(async (transaction) => {
        const notificationUserDocumentInTransaction = notificationUserCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(notificationUserDocument);
        const notificationUser = await assertSnapshotData(notificationUserDocumentInTransaction);

        const updateTemplate: Partial<NotificationUser> = {};

        const allKnownNotificationTypes = appNotificationTemplateTypeInfoRecordService.getAllKnownTemplateTypes();

        if (inputDc != null) {
          updateTemplate.dc = updateNotificationUserDefaultNotificationBoxRecipientConfig(notificationUser.dc, inputDc, allKnownNotificationTypes);
        }

        if (inputGc != null) {
          const nextGc = updateNotificationUserDefaultNotificationBoxRecipientConfig(notificationUser.gc, inputGc, allKnownNotificationTypes);

          if (!areEqualPOJOValues(notificationUser.gc, nextGc)) {
            updateTemplate.gc = nextGc;

            // iterate and update any box config that has the effective recipient change
            updateTemplate.bc = notificationUser.bc.map((currentConfig) => {
              // check item isn't already marked for sync or marked as removed
              if (currentConfig.ns === true || currentConfig.rm === true) {
                return currentConfig;
              }

              const currentEffectiveRecipient: NotificationBoxRecipient = effectiveNotificationBoxRecipientConfig({
                uid: notificationUser.uid,
                appNotificationTemplateTypeInfoRecordService,
                gc: notificationUser.gc,
                boxConfig: currentConfig
              });

              const nextEffectiveRecipient: NotificationBoxRecipient = effectiveNotificationBoxRecipientConfig({
                uid: notificationUser.uid,
                appNotificationTemplateTypeInfoRecordService,
                gc: nextGc,
                boxConfig: currentConfig
              });

              const effectiveConfigChanged = !areEqualPOJOValues(currentEffectiveRecipient, nextEffectiveRecipient);
              return effectiveConfigChanged ? { ...currentConfig, ns: true } : currentConfig;
            });
          }
        }

        if (inputBc != null) {
          const updateTemplateBc = updateNotificationUserNotificationBoxRecipientConfigs(updateTemplate.bc ?? notificationUser.bc, inputBc, appNotificationTemplateTypeInfoRecordService);

          if (updateTemplateBc != null) {
            // re-apply exclusions to the updated configs
            const withExclusions = applyExclusionsToNotificationUserNotificationBoxRecipientConfigs({
              notificationUser,
              bc: updateTemplateBc,
              recalculateNs: false
            });

            updateTemplate.bc = withExclusions.bc;
            updateTemplate.b = updateTemplateBc.map((x) => x.nb);
          }
        }

        // if bc is being updated, then also update ns
        if (updateTemplate.bc != null) {
          updateTemplate.ns = calculateNsForNotificationUserNotificationBoxRecipientConfigs(updateTemplate.bc);
        }

        await notificationUserDocumentInTransaction.update(updateTemplate);
      });

      return notificationUserDocument;
    };
  });
}

const MAX_NOTIFICATION_BOXES_TO_UPDATE_PER_BATCH = 50;

export function resyncNotificationUserFactory(context: NotificationServerActionsContext) {
  const { firestoreContext, firebaseServerActionTransformFunctionFactory, notificationBoxCollection, notificationUserCollection, appNotificationTemplateTypeInfoRecordService } = context;

  return firebaseServerActionTransformFunctionFactory(ResyncNotificationUserParams, async () => {
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
            const nextRecipientsMap = new Map<NotificationBoxId, Maybe<NotificationBoxRecipient>>();

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
                  const recipient = notificationBox.r[recipientIndex];

                  const nextRecipient: NotificationBoxRecipient = effectiveNotificationBoxRecipientConfig({
                    uid: notificationUser.uid,
                    m,
                    appNotificationTemplateTypeInfoRecordService,
                    gc,
                    boxConfig: notificationUserNotificationBoxConfig,
                    recipient
                  });

                  const recipientHasChange = !areEqualPOJOValues(nextRecipient, recipient);

                  // only update recipients if the next/new recipient is not equal to the existing one
                  if (recipientHasChange) {
                    r = [...notificationBox.r];
                    r[recipientIndex] = nextRecipient;
                    nextRecipientsMap.set(nb, nextRecipient);
                  } else {
                    nextRecipientsMap.set(nb, recipient);
                  }
                }

                // update recipients if needed
                if (r != null) {
                  await document.update({ r });
                  notificationBoxesUpdatedInBatch += 1;
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
                  const updatedRecipient = nextRecipientsMap.get(nb) as NotificationBoxRecipient;

                  nextConfig = {
                    ...existingConfig,
                    nb,
                    rm: false, // mark as not removed
                    i: updatedRecipient.i ?? UNSET_INDEX_NUMBER
                  };
                }
              }

              if (nextConfig != null) {
                nextConfig.ns = false; // mark as synced
                nextConfigs.push(nextConfig);
              }
            });

            const ns = nextConfigs.some((x) => x.ns);
            await notificationUserDocumentInTransaction.update({ bc: nextConfigs, ns });
            hasUnsyncedNotificationBoxConfigs = ns;
          }

          const batchResult: ResyncNotificationUserBatchResult = {
            hasMoreNotificationBoxesToSync: hasUnsyncedNotificationBoxConfigs,
            notificationBoxesUpdatedInBatch
          };

          return batchResult;
        });

        hasMoreNotificationBoxesToSync = batchResult.hasMoreNotificationBoxesToSync;
        notificationBoxesUpdated += batchResult.notificationBoxesUpdatedInBatch;
      }

      const result: ResyncNotificationUserResult = {
        notificationBoxesUpdated
      };

      return result;
    };
  });
}

export function resyncAllNotificationUsersFactory(context: NotificationServerActionsContext) {
  const { notificationUserCollection } = context;
  const resyncNotificationUser = resyncNotificationUserFactory(context);

  return async () => {
    let notificationBoxesUpdated = 0;

    const resyncNotificationUserParams: ResyncNotificationUserParams = { key: firestoreDummyKey() };
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

    const result: ResyncAllNotificationUsersResult = {
      notificationUsersResynced: iterateResult.totalSnapshotsVisited,
      notificationBoxesUpdated
    };

    return result;
  };
}

export function createNotificationSummaryFactory(context: NotificationServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory, notificationSummaryCollection } = context;

  return firebaseServerActionTransformFunctionFactory(CreateNotificationSummaryParams, async (params) => {
    const { model } = params;

    return async () => {
      const notificationSummaryId = notificationSummaryIdForModel(model);
      const notificationSummaryDocument: NotificationSummaryDocument = notificationSummaryCollection.documentAccessor().loadDocumentForId(notificationSummaryId);

      const newSummaryTemplate: NotificationSummary = makeNewNotificationSummaryTemplate(model);
      await notificationSummaryDocument.create(newSummaryTemplate);
      return notificationSummaryDocument;
    };
  });
}

export function updateNotificationSummaryFactory(context: NotificationServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(UpdateNotificationSummaryParams, async (params) => {
    const { setReadAtTime, flagAllRead } = params;

    return async (notificationSummaryDocument: NotificationSummaryDocument) => {
      let updateTemplate: Maybe<Partial<NotificationSummary>>;

      if (setReadAtTime != null) {
        updateTemplate = { rat: setReadAtTime };
      } else if (flagAllRead === true) {
        updateTemplate = { rat: new Date() };
      }

      if (updateTemplate != null) {
        await notificationSummaryDocument.update(updateTemplate);
      }

      return notificationSummaryDocument;
    };
  });
}

/**
 * Used for creating a new NotificationBox within a transaction.
 *
 * Used for new models.
 */
export interface CreateNotificationBoxInTransactionInput extends NotificationBoxDocumentReferencePair {
  /**
   * Now date to use.
   */
  readonly now?: Maybe<Date>;
  /**
   * If true, skips create
   */
  readonly skipCreate?: Maybe<boolean>;
}

export function createNotificationBoxInTransactionFactory(context: BaseNotificationServerActionsContext) {
  const { notificationBoxCollection } = context;

  return async (params: CreateNotificationBoxInTransactionInput, transaction: Transaction) => {
    const { now: inputNow, skipCreate } = params;
    const now = inputNow ?? new Date();

    const notificationBoxDocument: NotificationBoxDocument = loadNotificationBoxDocumentForReferencePair(params, notificationBoxCollection.documentAccessorForTransaction(transaction));

    const notificationBoxTemplate: NotificationBox = {
      m: notificationBoxDocument.notificationBoxRelatedModelKey,
      o: firestoreDummyKey(), // set during initialization
      r: [],
      cat: now,
      w: yearWeekCode(now),
      s: true // requires initialization
    };

    if (!skipCreate) {
      await notificationBoxDocument.create(notificationBoxTemplate);
    }

    return {
      notificationBoxTemplate,
      notificationBoxDocument
    };
  };
}

export function createNotificationBoxFactory(context: NotificationServerActionsContext) {
  const { firestoreContext, notificationBoxCollection, firebaseServerActionTransformFunctionFactory } = context;
  const createNotificationBoxInTransaction = createNotificationBoxInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(CreateNotificationBoxParams, async (params) => {
    const { model } = params;

    return async () => {
      const result = await firestoreContext.runTransaction(async (transaction) => {
        const { notificationBoxDocument } = await createNotificationBoxInTransaction({ notificationBoxRelatedModelKey: model }, transaction);
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

export interface UpdateNotificationBoxRecipientExclusionInTransactionInput extends NotificationBoxDocumentReferencePair {
  readonly params: UpdateNotificationBoxRecipientParams;
}

export interface UpdateNotificationBoxRecipientExclusionInTransactionResult {
  readonly notificationUserUpdate: Partial<NotificationUser>;
}

export function updateNotificationBoxRecipientExclusionInTransactionFactory(context: BaseNotificationServerActionsContext) {
  const { notificationBoxCollection, notificationUserCollection } = context;

  return async (input: UpdateNotificationBoxRecipientExclusionInTransactionInput, transaction: Transaction): Promise<Maybe<UpdateNotificationBoxRecipientExclusionInTransactionResult>> => {
    const { params } = input;
    const { uid: inputUid, i, setExclusion } = params;

    const notificationBoxDocument: NotificationBoxDocument = loadNotificationBoxDocumentForReferencePair(input, notificationBoxCollection.documentAccessorForTransaction(transaction));

    let targetUid = inputUid;
    let result: Maybe<UpdateNotificationBoxRecipientExclusionInTransactionResult> = undefined;

    if (setExclusion == null) {
      throw new Error('setExclusion was undefined. Maybe you wanted to call updateNotificationBoxRecipientInTransactionFactory() instead?');
    } else if (!inputUid && i != null) {
      // only load the notification box if targeting a recipient by index
      const notificationBox = await notificationBoxDocument.snapshotData();

      if (!notificationBox) {
        throw notificationBoxExclusionTargetInvalidError();
      }

      const targetRecipient = notificationBox.r.find((x) => x.i === i);

      if (!targetRecipient || !targetRecipient.uid) {
        throw notificationBoxExclusionTargetInvalidError();
      } else {
        targetUid = targetRecipient.uid;
      }
    }

    if (!targetUid) {
      throw notificationBoxExclusionTargetInvalidError();
    }

    const notificationUserDocument = await notificationUserCollection.documentAccessorForTransaction(transaction).loadDocumentForId(targetUid);
    const notificationUser = await notificationUserDocument.snapshotData();

    if (notificationUser) {
      // only update if the user exists
      const targetExclusions = [notificationBoxDocument.id];

      const { update: notificationUserUpdate } = updateNotificationUserNotificationSendExclusions({
        notificationUser,
        addExclusions: setExclusion ? targetExclusions : undefined,
        removeExclusions: setExclusion ? undefined : targetExclusions
      });

      await notificationUserDocument.update(notificationUserUpdate);

      result = {
        notificationUserUpdate
      };
    }

    return result;
  };
}

export interface UpdateNotificationBoxRecipientInTransactionInput extends NotificationBoxDocumentReferencePair {
  /**
   * Parameters to update the notification box recipient with.
   */
  readonly params: UpdateNotificationBoxRecipientParams;
  /**
   * Whether or not to create the NotificationBox if it does not exist.
   */
  readonly allowCreateNotificationBoxIfItDoesNotExist?: Maybe<boolean>;
  /**
   * Whether or not to throw an error if the NotificationBox does not exist. If false, the function will do nothing if the NotificationBox does not exist and will return undefined.
   *
   * Throws a notificationBoxDoesNotExistForModelError() error.
   */
  readonly throwErrorIfNotificationBoxDoesNotExist?: Maybe<boolean>;
}

export interface UpdateNotificationBoxRecipientInTransactionResult {
  readonly notificationBoxWasCreated: boolean;
  readonly updatedNotificationBox: NotificationBox;
  readonly notificationBoxDocument: NotificationBoxDocument;
}

export function updateNotificationBoxRecipientInTransactionFactory(context: BaseNotificationServerActionsContext) {
  const { authService, notificationBoxCollection, notificationUserCollection } = context;
  const createNotificationBoxInTransaction = createNotificationBoxInTransactionFactory(context);

  return async (input: UpdateNotificationBoxRecipientInTransactionInput, transaction: Transaction): Promise<Maybe<UpdateNotificationBoxRecipientInTransactionResult>> => {
    const { params, allowCreateNotificationBoxIfItDoesNotExist, throwErrorIfNotificationBoxDoesNotExist } = input;

    const { uid, i, insert, remove, configs: inputC, setExclusion } = params;
    const findRecipientFn = (x: NotificationBoxRecipient) => (uid != null && x.uid === uid) || (i != null && x.i === i);

    if (setExclusion != null) {
      throw new Error('exclusion update must be processed by updateNotificationBoxRecipientExclusionInTransactionFactory() function.');
    }

    const notificationBoxDocument: NotificationBoxDocument = loadNotificationBoxDocumentForReferencePair(input, notificationBoxCollection.documentAccessorForTransaction(transaction));

    let notificationBox = await notificationBoxDocument.snapshotData();
    let createNotificationBox = false;

    let result: Maybe<UpdateNotificationBoxRecipientInTransactionResult> = undefined;

    if (!notificationBox) {
      if (allowCreateNotificationBoxIfItDoesNotExist) {
        const { notificationBoxTemplate } = await createNotificationBoxInTransaction(
          {
            notificationBoxDocument,
            skipCreate: true // don't create since we still need to read things for the transaction
          },
          transaction
        );
        notificationBox = notificationBoxTemplate;
        createNotificationBox = true;
      } else if (throwErrorIfNotificationBoxDoesNotExist) {
        throw notificationBoxDoesNotExist();
      }
    }

    if (notificationBox) {
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

      // save changes to r if it has changed
      if (r != null) {
        const notificationUserId = targetRecipient?.uid ?? nextRecipient?.uid;

        // sync with the notification user's document, if it exists
        if (notificationUserId != null) {
          const notificationBoxId = notificationBoxDocument.id;
          const notificationUserDocument = await notificationUserCollection.documentAccessorForTransaction(transaction).loadDocumentForId(notificationUserId);

          let notificationUser = await notificationUserDocument.snapshotData();
          const createNotificationUser = !notificationUser && !remove && insert;

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
              x: [],
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
            const { updatedBc, updatedNotificationBoxRecipient } = updateNotificationUserNotificationBoxRecipientConfig({
              notificationBoxId,
              notificationUserId,
              notificationBoxAssociatedModelKey: m,
              notificationUser,
              insertingRecipientIntoNotificationBox: insert,
              removeRecipientFromNotificationBox: remove,
              notificationBoxRecipient: nextRecipient
            });

            const updatedB = updatedBc ? updatedBc.map((x) => x.nb) : undefined;

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

        const updatedNotificationBox = { ...notificationBox, r };

        let notificationBoxWasCreated = false;

        if (createNotificationBox) {
          await notificationBoxDocument.create(updatedNotificationBox);
          notificationBoxWasCreated = true;
        } else {
          await notificationBoxDocument.update({ r });
        }

        result = {
          updatedNotificationBox,
          notificationBoxWasCreated,
          notificationBoxDocument
        };
      }
    }

    return result;
  };
}

export function updateNotificationBoxRecipientFactory(context: NotificationServerActionsContext) {
  const { firestoreContext, firebaseServerActionTransformFunctionFactory } = context;
  const updateNotificationBoxRecipientInTransaction = updateNotificationBoxRecipientInTransactionFactory(context);
  const updateNotificationBoxRecipientExclusionInTransaction = updateNotificationBoxRecipientExclusionInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(UpdateNotificationBoxRecipientParams, async (params) => {
    return async (notificationBoxDocument: NotificationBoxDocument) => {
      await firestoreContext.runTransaction(async (transaction) => {
        if (params.setExclusion != null) {
          await updateNotificationBoxRecipientExclusionInTransaction(
            {
              params,
              notificationBoxDocument
            },
            transaction
          );
        } else {
          await updateNotificationBoxRecipientInTransaction(
            {
              params,
              throwErrorIfNotificationBoxDoesNotExist: true,
              notificationBoxDocument
            },
            transaction
          );
        }
      });

      return notificationBoxDocument;
    };
  });
}

export const UNKNOWN_NOTIFICATION_TEMPLATE_TYPE_HOURS_DELAY = 8;
export const UNKNOWN_NOTIFICATION_TEMPLATE_TYPE_DELETE_AFTER_RETRY_ATTEMPTS = 1;
export const UNKNOWN_NOTIFICATION_TASK_TYPE_HOURS_DELAY = 8;
export const UNKNOWN_NOTIFICATION_TASK_TYPE_DELETE_AFTER_RETRY_ATTEMPTS = 1;

export const KNOWN_BUT_UNCONFIGURED_NOTIFICATION_TEMPLATE_TYPE_HOURS_DELAY = UNKNOWN_NOTIFICATION_TEMPLATE_TYPE_HOURS_DELAY;
export const KNOWN_BUT_UNCONFIGURED_NOTIFICATION_TEMPLATE_TYPE_DELETE_AFTER_RETRY_ATTEMPTS = 5;

export const NOTIFICATION_MAX_SEND_ATTEMPTS = 5;
export const NOTIFICATION_BOX_NOT_INITIALIZED_DELAY_MINUTES = 8;

export const NOTIFICATION_TASK_TYPE_MAX_SEND_ATTEMPTS = 5;
export const NOTIFICATION_TASK_TYPE_FAILURE_DELAY_HOURS = 3;
export const NOTIFICATION_TASK_TYPE_FAILURE_DELAY_MS = hoursToMilliseconds(NOTIFICATION_TASK_TYPE_FAILURE_DELAY_HOURS);

export function sendNotificationFactory(context: NotificationServerActionsContext) {
  const { appNotificationTemplateTypeInfoRecordService, notificationSendService, notificationTaskService, notificationTemplateService, authService, notificationBoxCollection, notificationCollectionGroup, notificationUserCollection, firestoreContext, firebaseServerActionTransformFunctionFactory } = context;
  const createNotificationBoxInTransaction = createNotificationBoxInTransactionFactory(context);
  const notificationUserAccessor = notificationUserCollection.documentAccessor();

  return firebaseServerActionTransformFunctionFactory(SendNotificationParams, async (params) => {
    const { ignoreSendAtThrottle } = params;

    return async (inputNotificationDocument: NotificationDocument) => {
      // Load the notification document outside of any potential context (transaction, etc.)
      const notificationDocument = notificationCollectionGroup.documentAccessor().loadDocumentFrom(inputNotificationDocument);

      const { throttled, tryRun, isNotificationTask, notificationTaskHandler, notification, createdBox, notificationBoxNeedsInitialization, notificationBox, notificationBoxModelKey, deletedNotification, templateInstance, isConfiguredTemplateType, isKnownTemplateType, onlySendToExplicitlyEnabledRecipients, onlyTextExplicitlyEnabledRecipients } = await firestoreContext.runTransaction(async (transaction) => {
        const notificationBoxDocument = notificationBoxCollection.documentAccessorForTransaction(transaction).loadDocument(notificationDocument.parent);
        const notificationDocumentInTransaction = notificationCollectionGroup.documentAccessorForTransaction(transaction).loadDocumentFrom(notificationDocument);

        let [notificationBox, notification] = await Promise.all([getDocumentSnapshotData(notificationBoxDocument), getDocumentSnapshotData(notificationDocumentInTransaction)]);

        const model = inferKeyFromTwoWayFlatFirestoreModelKey(notificationBoxDocument.id);
        const isNotificationTask = notification?.st === NotificationSendType.TASK_NOTIFICATION;

        let tryRun = true;
        let throttled = false;
        let nextSat: Maybe<Date>;

        if (!notification) {
          tryRun = false;
        } else if (!ignoreSendAtThrottle) {
          tryRun = !isFuture(notification.sat);

          if (tryRun) {
            if (!isNotificationTask) {
              // update the next send type of non-tasks to try being sent again in 10 minutes, if they fail
              nextSat = addMinutes(new Date(), 10);
            }
          } else {
            throttled = true;
          }
        }

        let createdBox = false;
        let deletedNotification = false;
        let notificationBoxNeedsInitialization = false;
        let isKnownTemplateType: Maybe<boolean>;
        let isConfiguredTemplateType: Maybe<boolean>;
        let onlySendToExplicitlyEnabledRecipients: Maybe<boolean>;
        let onlyTextExplicitlyEnabledRecipients: Maybe<boolean>;
        let templateInstance: Maybe<NotificationTemplateServiceInstance>;
        let notificationTaskHandler: Maybe<NotificationTaskServiceTaskHandler>;

        async function deleteNotification() {
          tryRun = false;
          await notificationDocumentInTransaction.accessor.delete();
          deletedNotification = true;
        }

        // create/init the notification box if necessary/configured.
        if (notification && tryRun) {
          // if we're still trying to run, check the template is ok. If not, cancel the run.
          const {
            t // notification task/template type
          } = notification.n;

          if (isNotificationTask) {
            notificationTaskHandler = notificationTaskService.taskHandlerForNotificationTaskType(t);

            if (notificationTaskHandler) {
              if (notification.a >= NOTIFICATION_TASK_TYPE_MAX_SEND_ATTEMPTS) {
                tryRun = false;

                console.warn(`Configured notification task of type "${t}" has reached the delete threshhold after being attempted ${notification.a} times. Deleting notification task.`);
                await deleteNotification();
              }
            } else {
              tryRun = false;
              const delay = UNKNOWN_NOTIFICATION_TASK_TYPE_HOURS_DELAY;

              if (notification.a < UNKNOWN_NOTIFICATION_TASK_TYPE_DELETE_AFTER_RETRY_ATTEMPTS) {
                console.warn(`Notification task type of "${t}" was found in a Notification but has no handler. Action is being delayed by ${delay} hours.`);
                nextSat = addHours(new Date(), delay);
              } else {
                console.warn(`Notification task type of "${t}" was found in a Notification but has no handler. Action is being deleted.`);

                // delete the notification
                await deleteNotification();
              }
            }
          } else {
            templateInstance = notificationTemplateService.templateInstanceForType(t);
            isConfiguredTemplateType = templateInstance.isConfiguredType;

            const templateTypeInfo = appNotificationTemplateTypeInfoRecordService.appNotificationTemplateTypeInfoRecord[t];

            isKnownTemplateType = templateTypeInfo != null;
            onlySendToExplicitlyEnabledRecipients = notification.ois ?? templateTypeInfo?.onlySendToExplicitlyEnabledRecipients;
            onlyTextExplicitlyEnabledRecipients = notification.ots ?? templateTypeInfo?.onlyTextExplicitlyEnabledRecipients;

            if (!isConfiguredTemplateType) {
              // log the issue that an notification with an unconfigured type was queued
              const retryAttempts = isKnownTemplateType ? KNOWN_BUT_UNCONFIGURED_NOTIFICATION_TEMPLATE_TYPE_DELETE_AFTER_RETRY_ATTEMPTS : UNKNOWN_NOTIFICATION_TEMPLATE_TYPE_DELETE_AFTER_RETRY_ATTEMPTS;
              const delay = isKnownTemplateType ? KNOWN_BUT_UNCONFIGURED_NOTIFICATION_TEMPLATE_TYPE_HOURS_DELAY : UNKNOWN_NOTIFICATION_TEMPLATE_TYPE_HOURS_DELAY;

              if (notification.a < retryAttempts) {
                if (isKnownTemplateType) {
                  console.warn(`Unconfigured but known template type of "${t}" (${templateTypeInfo.name}) was found in a Notification. Send is being delayed by ${delay} hours.`);
                } else {
                  console.warn(`Unknown template type of "${t}" was found in a Notification. Send is being delayed by ${delay} hours.`);
                }

                // delay send for 12 hours, for a max of 24 hours incase it is an issue.
                nextSat = addHours(new Date(), delay);
                tryRun = false;
              } else {
                console.warn(`Unconfigured template type of "${t}" was found in a Notification. The Notification has reached the delete threshhold after failing to send due to misconfiguration multiple times and is being deleted.`);

                // after attempting to send 3 times, delete it.
                await deleteNotification();
              }
            }

            // handle the notification box's absence
            if (!notificationBox && tryRun) {
              switch (notification.st) {
                case NotificationSendType.INIT_BOX_AND_SEND:
                  const { notificationBoxTemplate } = await createNotificationBoxInTransaction({ notificationBoxDocument }, transaction);
                  notificationBox = setIdAndKeyFromKeyIdRefOnDocumentData(notificationBoxTemplate, notificationBoxDocument);
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
          isNotificationTask,
          deletedNotification,
          createdBox,
          notificationBoxModelKey: model,
          notificationBoxNeedsInitialization,
          notificationBox,
          notification,
          templateInstance,
          isKnownTemplateType,
          notificationTaskHandler,
          isConfiguredTemplateType,
          tryRun,
          onlySendToExplicitlyEnabledRecipients,
          onlyTextExplicitlyEnabledRecipients
        };
      });

      let success = false;
      let isUniqueNotificationTask = false;
      let uniqueNotificationTaskConflict = false;

      let sendEmailsResult: Maybe<NotificationSendEmailMessagesResult>;
      let sendTextsResult: Maybe<NotificationSendTextMessagesResult>;
      let sendNotificationSummaryResult: Maybe<NotificationSendNotificationSummaryMessagesResult>;

      let loadMessageFunctionFailure: boolean = false;
      let buildMessageFailure: boolean = false;
      let notificationMarkedDone: boolean = false;
      let notificationTaskCompletionType: Maybe<NotificationTaskServiceTaskHandlerCompletionType>;
      let notificationTaskPartsRunCount: number = 0;
      let notificationTaskLoopingProtectionTriggered: Maybe<boolean>;
      let onSendAttemptedResult: Maybe<SendNotificationResultOnSendCompleteResult>;
      let onSendSuccessResult: Maybe<SendNotificationResultOnSendCompleteResult>;

      const notificationTemplateType: Maybe<NotificationTemplateType> = templateInstance?.type;

      if (isNotificationTask) {
        await handleNotificationTask();
      } else {
        await handleNormalNotification();
      }

      interface RunNotificationTaskNextPartResult {
        /**
         * Set if the result comes back as a partial completion, with canRunNextCheckpoint as true, and there is no delay.
         */
        readonly tryRunNextPart: boolean;
        readonly partNotificationTaskCompletionType: Maybe<NotificationTaskServiceTaskHandlerCompletionType>;
        readonly partNotificationMarkedDone: boolean;
        /**
         * Set if the tpr did not change or has reversed, meaning the task went back to a prior step.
         *
         * This is used as a check to prevent infinite loops.
         */
        readonly partTprReversal: boolean;
        readonly partSuccess: boolean;
      }

      async function _runNotificationTaskNextPart(notification: DocumentDataWithIdAndKey<Notification>, notificationTaskHandler: NotificationTaskServiceTaskHandler): Promise<RunNotificationTaskNextPartResult> {
        const { n: item, cat, ut } = notification;

        let tryRunNextPart = false;
        let partNotificationTaskCompletionType: Maybe<NotificationTaskServiceTaskHandlerCompletionType>;
        let partNotificationMarkedDone = false;
        let partTprReversal = false;
        let partSuccess = false;

        const unique = ut ?? false;
        const notificationTask: NotificationTask = {
          notificationDocument,
          totalSendAttempts: notification.a,
          currentCheckpointSendAttempts: notification.at ?? 0,
          taskType: item.t,
          item,
          data: item.d,
          checkpoints: notification.tpr,
          createdAt: cat,
          unique
        };

        // calculate results
        const notificationTemplate: Partial<Notification> = {};

        // perform the task
        try {
          const handleTaskResult = await notificationTaskHandler.handleNotificationTask(notificationTask);
          const { completion, updateMetadata, delayUntil, canRunNextCheckpoint } = handleTaskResult;

          partNotificationTaskCompletionType = completion;
          partSuccess = true;

          switch (completion) {
            case true:
              notificationTemplate.d = true; // mark as done
              break;
            case false:
              // failed
              notificationTemplate.a = notification.a + 1; // increase attempts count
              notificationTemplate.at = (notification.at ?? 0) + 1; // increase checkpoint attempts count

              // remove any completions, if applicable
              notificationTemplate.tpr = removeFromCompletionsArrayWithTaskResult(notification.tpr, handleTaskResult);
              partSuccess = false;
              break;
            default:
              // default case called if not true or false, which implies either a delay or partial completion

              // update the checkpoint attempts count
              if (Array.isArray(completion) && completion.length === 0) {
                notificationTemplate.at = (notification.at ?? 0) + 1; // increase checkpoint attempt/delays count
              } else {
                tryRunNextPart = canRunNextCheckpoint === true && delayUntil == null; // can try the next part if there is no delayUntil and canRunNextCheckpoint is true
                notificationTemplate.at = 0; // reset checkpoint attempt/delay count
              }

              // add the checkpoint to the notification
              notificationTemplate.tpr = [
                ...removeFromCompletionsArrayWithTaskResult(notification.tpr, handleTaskResult), // remove any completions, if applicable
                ...asArray(completion)
              ];

              // calculate the updated notification item
              notificationTemplate.n = {
                ...notification.n,
                d: {
                  ...notification.n.d,
                  ...(updateMetadata ? filterOnlyUndefinedValues(updateMetadata) : undefined) // ignore any undefined values
                }
              };

              // can only run the next part if the tpr has changed, and the number of checkpoints completed has increased
              // if the tpr has not changed, then it is also considered a reversal
              if (tryRunNextPart) {
                const tprChanged = !iterablesAreSetEquivalent(notification.tpr, notificationTemplate.tpr);
                partTprReversal = !tprChanged || (tprChanged && notificationTemplate.tpr.length <= notification.tpr.length);
              }

              break;
          }

          // do not update sat if the task is complete
          if (completion !== true && delayUntil != null) {
            notificationTemplate.sat = dateOrMillisecondsToDate(delayUntil);
          }

          partNotificationMarkedDone = notificationTemplate.d === true;
        } catch (e) {
          console.error(`Failed handling task for notification "${notification.key}" with type "${notificationTask.taskType}": `, e);
          notificationTemplate.a = notification.a + 1; // increase attempts count
          notificationTemplate.sat = dateOrMillisecondsToDate(NOTIFICATION_TASK_TYPE_FAILURE_DELAY_MS);
          partSuccess = false;
        }

        // notification tasks are read
        let saveTaskResult = true;

        if (unique) {
          isUniqueNotificationTask = true;
          const latestNotification = await notificationDocument.snapshotData();

          if (!latestNotification || !isSameDate(latestNotification.cat, notification.cat)) {
            saveTaskResult = false;
            uniqueNotificationTaskConflict = true;
          }
        }

        if (saveTaskResult) {
          await notificationDocument.update(notificationTemplate);
        }

        return {
          tryRunNextPart,
          partNotificationMarkedDone,
          partNotificationTaskCompletionType,
          partTprReversal,
          partSuccess
        };
      }

      /**
       * Notification task handling.
       *
       * Notification takss can have multiple async but sequential parts.
       *
       * Some of these parts may be able to be run immediately one after the other, instead of waiting for
       * another sendNotification() to complete on it.
       */
      async function handleNotificationTask() {
        const MAX_NOTIFICATION_TASK_PARTS_RUN_ALLOWED = 5;

        if (tryRun && notification != null && notificationTaskHandler) {
          let currentNotification = notification;
          notificationTaskLoopingProtectionTriggered = false;

          notificationTaskPartsRunCount = 0;

          while (notificationTaskPartsRunCount < MAX_NOTIFICATION_TASK_PARTS_RUN_ALLOWED) {
            notificationTaskPartsRunCount += 1;

            const result = await _runNotificationTaskNextPart(currentNotification, notificationTaskHandler);

            notificationTaskCompletionType = result.partNotificationTaskCompletionType;
            success = result.partSuccess;

            const tryRunNextPart = result.partSuccess && result.tryRunNextPart && !notificationTaskLoopingProtectionTriggered;
            notificationTaskLoopingProtectionTriggered = notificationTaskLoopingProtectionTriggered || result.partTprReversal; // update the flag if the TPR has been reversed

            if (tryRunNextPart) {
              const updatedNotificationData = await notificationDocument.snapshotData();

              if (updatedNotificationData) {
                currentNotification = setIdAndKeyFromKeyIdRefOnDocumentData(updatedNotificationData, notificationDocument);
              } else {
                break; // notification is unavailable now
              }
            } else {
              break; // escape the loop
            }
          }
        }
      }

      /**
       * Handles a normal (non-task) notification.
       */
      async function handleNormalNotification() {
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
              function filterOutNoContentNotificationMessages(messages: NotificationMessage<any>[]) {
                return messages.filter((x) => !x.flag);
              }

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
                globalRecipients: messageFunction.globalRecipients,
                onlySendToExplicitlyEnabledRecipients,
                onlyTextExplicitlyEnabledRecipients,
                notificationSummaryIdForUid: notificationSendService.notificationSummaryIdForUidFunction
              });

              let { es, ts, ps, ns, esr: currentEsr, tsr: currentTsr } = notification;

              // do emails
              let esr: EmailAddress[] | undefined;

              if (es === NotificationSendState.QUEUED || es === NotificationSendState.SENT_PARTIAL) {
                const emailRecipientsAlreadySentTo = new Set<EmailAddress>(currentEsr.map((x) => x.toLowerCase()));
                const emailInputContexts: NotificationMessageInputContext[] = emailRecipients
                  .filter((x) => !emailRecipientsAlreadySentTo.has(x.emailAddress.toLowerCase()))
                  .map((x) => {
                    const context: NotificationMessageInputContext = {
                      recipient: {
                        n: x.name,
                        e: x.emailAddress,
                        t: x.phoneNumber
                      }
                    };

                    return context;
                  });

                const emailMessages = await Promise.all(emailInputContexts.map(messageFunction))
                  .then(filterOutNoContentNotificationMessages)
                  .catch((e) => {
                    console.error(`Failed building message function for type ${notificationTemplateType}: `, e);
                    buildMessageFailure = true;
                    return undefined;
                  });

                if (emailMessages?.length) {
                  if (notificationSendService.emailSendService != null) {
                    let sendInstance: Maybe<NotificationSendMessagesInstance<NotificationSendEmailMessagesResult>>;

                    try {
                      sendInstance = await notificationSendService.emailSendService.buildSendInstanceForEmailNotificationMessages(emailMessages);
                    } catch (e) {
                      console.error(`Failed building email send instance for notification "${notification.id}" with type "${notificationTemplateType}": `, e);
                      es = NotificationSendState.CONFIG_ERROR;
                    }

                    if (sendInstance) {
                      try {
                        sendEmailsResult = await sendInstance();
                      } catch (e) {
                        console.error(`Failed sending email notification "${notification.id}" with type "${notificationTemplateType}": `, e);
                        es = NotificationSendState.SEND_ERROR;
                      }
                    }
                  } else {
                    console.error(`Failed sending email notification "${notification.id}" with type "${notificationTemplateType}" due to no email service being configured.`);
                    es = NotificationSendState.CONFIG_ERROR;
                  }

                  if (sendEmailsResult != null) {
                    const { success, failed } = sendEmailsResult;
                    esr = success.length ? currentEsr.concat(success.map((x) => x.toLowerCase())) : undefined;

                    if (failed.length > 0) {
                      es = NotificationSendState.SENT_PARTIAL;
                    } else {
                      es = NotificationSendState.SENT;
                    }
                  }
                } else {
                  es = NotificationSendState.SENT;
                }
              }

              // do phone numbers
              let tsr: E164PhoneNumber[] | undefined;

              if (ts === NotificationSendState.QUEUED || ts === NotificationSendState.SENT_PARTIAL) {
                const textRecipientsAlreadySentTo = new Set<E164PhoneNumber>(currentTsr);
                const textInputContexts: NotificationMessageInputContext[] = textRecipients
                  .filter((x) => !textRecipientsAlreadySentTo.has(x.phoneNumber))
                  .map((x) => {
                    const context: NotificationMessageInputContext = {
                      recipient: {
                        n: x.name,
                        e: x.emailAddress,
                        t: x.phoneNumber
                      }
                    };

                    return context;
                  });

                const textMessages = await Promise.all(textInputContexts.map(messageFunction))
                  .then(filterOutNoContentNotificationMessages)
                  .catch((e) => {
                    console.error(`Failed building message function for type ${notificationTemplateType}: `, e);
                    buildMessageFailure = true;
                    return undefined;
                  });

                if (textMessages?.length) {
                  if (notificationSendService.textSendService != null) {
                    let sendInstance: Maybe<NotificationSendMessagesInstance<NotificationSendTextMessagesResult>>;

                    try {
                      sendInstance = await notificationSendService.textSendService.buildSendInstanceForTextNotificationMessages(textMessages);
                    } catch (e) {
                      console.error(`Failed building text send instance for notification "${notification.id}" with type "${notificationTemplateType}": `, e);
                      ts = NotificationSendState.CONFIG_ERROR;
                    }

                    if (sendInstance) {
                      try {
                        sendTextsResult = await sendInstance();
                      } catch (e) {
                        console.error(`Failed sending text notification "${notification.id}" with type "${notificationTemplateType}": `, e);
                        ts = NotificationSendState.SEND_ERROR;
                      }
                    }
                  } else {
                    console.error(`Failed sending text notification "${notification.id}" with type "${notificationTemplateType}" due to no text service being configured.`);
                    ts = NotificationSendState.CONFIG_ERROR;
                  }

                  if (sendTextsResult != null) {
                    const { success, failed } = sendTextsResult;
                    tsr = success.length ? currentTsr.concat(success) : undefined;

                    if (failed.length > 0) {
                      ts = NotificationSendState.SENT_PARTIAL;
                    } else {
                      ts = NotificationSendState.SENT;
                    }
                  }
                } else {
                  ts = NotificationSendState.SENT;
                }
              }

              ps = NotificationSendState.NO_TRY;
              // NOTE: FCM token management will probably done with a separate system within Notification that stores FCMs for specific users in the app. May also use UIDs to determine who got the push notificdation or not...

              // do notification summaries
              if (ns === NotificationSendState.QUEUED || ns === NotificationSendState.SENT_PARTIAL) {
                const notificationSummaryInputContexts: NotificationMessageInputContext[] = notificationSummaryRecipients.map((x) => {
                  const context: NotificationMessageInputContext = {
                    recipient: {
                      n: x.name,
                      s: x.notificationSummaryId
                    }
                  };

                  return context;
                });

                const notificationSummaryMessages = await Promise.all(notificationSummaryInputContexts.map(messageFunction))
                  .then(filterOutNoContentNotificationMessages)
                  .catch((e) => {
                    console.error(`Failed building message function for type ${notificationTemplateType}: `, e);
                    buildMessageFailure = true;
                    return undefined;
                  });

                if (notificationSummaryMessages?.length) {
                  if (notificationSendService.notificationSummarySendService != null) {
                    let sendInstance: Maybe<NotificationSendMessagesInstance<NotificationSendNotificationSummaryMessagesResult>>;

                    try {
                      sendInstance = await notificationSendService.notificationSummarySendService.buildSendInstanceForNotificationSummaryMessages(notificationSummaryMessages);
                    } catch (e) {
                      console.error(`Failed building notification summary send instance for notification "${notification.id}" with type "${notificationTemplateType}": `, e);
                      ns = NotificationSendState.CONFIG_ERROR;
                    }

                    if (sendInstance) {
                      try {
                        sendNotificationSummaryResult = await sendInstance();
                        ns = NotificationSendState.SENT;
                      } catch (e) {
                        console.error(`Failed sending notification summary notification "${notification.id}" with type "${notificationTemplateType}": `, e);
                        ns = NotificationSendState.SEND_ERROR;
                      }
                    }
                  } else {
                    console.error(`Failed sending notification summary notification "${notification.id}" with type "${notificationTemplateType}" due to no notification summary service being configured.`);
                    ns = NotificationSendState.CONFIG_ERROR;
                  }
                } else {
                  ns = NotificationSendState.SENT;
                }
              }

              // calculate results
              const notificationTemplate: NotificationSendFlags & Partial<Notification> = { es, ts, ps, ns, esr, tsr };
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

              const callbackDetails: NotificationMessageFunctionExtrasCallbackDetails = {
                success,
                updatedSendFlags: notificationTemplate,
                sendEmailsResult,
                sendTextsResult,
                sendNotificationSummaryResult
              };

              const { onSendAttempted, onSendSuccess } = messageFunction;

              // call onSendAttempted, if one is configured
              if (onSendAttempted) {
                onSendAttemptedResult = await asPromise(onSendAttempted(callbackDetails))
                  .then((value) => {
                    return { value };
                  })
                  .catch((e) => {
                    console.warn(`Caught exception while calling onSendAttempted for notification "${notification.id}" with type "${notificationTemplateType}": `, e);
                    return { error: e };
                  });
              }

              // call onSendSuccess, if one is configured
              if (notificationMarkedDone && onSendSuccess) {
                onSendSuccessResult = await asPromise(onSendSuccess(callbackDetails))
                  .then((value) => {
                    return { value };
                  })
                  .catch((e) => {
                    console.warn(`Caught exception while calling onSendSuccess for notification "${notification.id}" with type "${notificationTemplateType}": `, e);
                    return { error: e };
                  });
              }
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
      }

      const result: SendNotificationResult = {
        notificationTemplateType,
        isKnownTemplateType,
        isNotificationTask,
        isUniqueNotificationTask,
        uniqueNotificationTaskConflict,
        isConfiguredTemplateType,
        throttled,
        exists: notification != null,
        boxExists: notificationBox != null,
        notificationTaskPartsRunCount,
        notificationTaskLoopingProtectionTriggered,
        notificationBoxNeedsInitialization,
        notificationTaskCompletionType,
        createdBox,
        deletedNotification,
        notificationMarkedDone,
        tryRun,
        success,
        sendEmailsResult,
        sendTextsResult,
        sendNotificationSummaryResult,
        loadMessageFunctionFailure,
        buildMessageFailure,
        onSendAttemptedResult,
        onSendSuccessResult
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
      let notificationTasksVisited: number = 0;
      let notificationsVisited: number = 0;
      let notificationsSucceeded: number = 0;
      let notificationsDelayed: number = 0;
      let notificationsFailed: number = 0;

      let sendEmailsResult: Maybe<NotificationSendEmailMessagesResult>;
      let sendTextsResult: Maybe<NotificationSendTextMessagesResult>;
      let sendNotificationSummaryResult: Maybe<NotificationSendNotificationSummaryMessagesResult>;

      const sendNotificationParams: SendNotificationParams = { key: firestoreDummyKey(), throwErrorIfSent: false };
      const sendNotificationInstance = await sendNotification(sendNotificationParams);

      // iterate through all notification items that need to be synced
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const sendQueuedNotificationsResults = await sendQueuedNotifications();

        sendQueuedNotificationsResults.results.forEach((x) => {
          const result = x[1];

          if (result.success) {
            notificationsSucceeded += 1;
          } else if (result.createdBox || result.notificationBoxNeedsInitialization) {
            notificationsDelayed = 1;
          } else {
            notificationsFailed += 1;
          }

          if (result.isNotificationTask) {
            notificationTasksVisited += 1;
          }

          if (result.deletedNotification) {
            notificationsDeleted += 1;
          }

          if (result.createdBox) {
            notificationBoxesCreated += 1;
          }

          sendEmailsResult = mergeNotificationSendMessagesResult(sendEmailsResult, result.sendEmailsResult);
          sendTextsResult = mergeNotificationSendMessagesResult(sendTextsResult, result.sendTextsResult);
          sendNotificationSummaryResult = mergeNotificationSendMessagesResult(sendNotificationSummaryResult, result.sendNotificationSummaryResult);
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
        notificationTasksVisited,
        notificationsVisited,
        notificationsSucceeded,
        notificationsDelayed,
        notificationsFailed,
        sendEmailsResult,
        sendTextsResult,
        sendNotificationSummaryResult
      };

      return result;
    };
  });
}

export function cleanupSentNotificationsFactory(context: NotificationServerActionsContext) {
  const { firestoreContext, firebaseServerActionTransformFunctionFactory, notificationCollectionGroup, notificationBoxCollection, notificationWeekCollectionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(CleanupSentNotificationsParams, async () => {
    return async () => {
      let notificationBoxesUpdatesCount: number = 0;
      let notificationsDeleted: number = 0;
      const notificationTasksDeletedCount: number = 0;
      let notificationWeeksCreated: number = 0;
      let notificationWeeksUpdated: number = 0;

      // iterate through all JobApplication items that need to be synced
      // eslint-disable-next-line no-constant-condition
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

            const { included: taskPairsWithDataAndMarkedDeleted, excluded: normalPairsWithDataAndMarkedDeleted } = separateValues(allPairsWithDataAndMarkedDeleted, (x) => x.data?.st === NotificationSendType.TASK_NOTIFICATION);

            const pairsGroupedByWeek = Array.from(makeValuesGroupMap(normalPairsWithDataAndMarkedDeleted, (x) => yearWeekCode((x.data as Notification).sat)).entries());

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

                const newItems: NotificationItem[] = filterMaybeArrayValues(
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

            // delete all the task notifications
            const writeBatch = firestoreContext.batch();
            const writeBatchAccessor = notificationCollectionGroup.documentAccessorForTransaction(writeBatch);
            await Promise.all(taskPairsWithDataAndMarkedDeleted.map((x) => writeBatchAccessor.loadDocumentFrom(x.document).accessor.delete()));
            await writeBatch.commit();

            let weeksCreated = 0;
            let weeksUpdated = 0;
            const tasksDeleted = taskPairsWithDataAndMarkedDeleted.length;

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
              itemsDeleted: allPairsWithDataAndMarkedDeleted.length,
              tasksDeleted
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
        notificationTasksDeletedCount,
        notificationsDeleted,
        notificationWeeksCreated,
        notificationWeeksUpdated
      };

      return result;
    };
  });
}
