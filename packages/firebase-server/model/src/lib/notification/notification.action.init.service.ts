import {
  type FirestoreContextReference,
  type Transaction,
  firestoreDummyKey,
  inferKeyFromTwoWayFlatFirestoreModelKey,
  firestoreModelKeyCollectionName,
  type TwoWayFlatFirestoreModelKey,
  type FirestoreModelKey,
  type FirestoreCollectionName,
  type NotificationFirestoreCollections,
  type AsyncNotificationBoxUpdateAction,
  type NotificationBoxDocument,
  InitializeNotificationModelParams,
  InitializeAllApplicableNotificationBoxesParams,
  type InitializeAllApplicableNotificationBoxesResult,
  notificationBoxesFlaggedForNeedsInitializationQuery,
  type NotificationBox,
  type NotificationSummary,
  InitializeAllApplicableNotificationSummariesParams,
  type InitializeAllApplicableNotificationSummariesResult,
  notificationSummariesFlaggedForNeedsInitializationQuery,
  type NotificationSummaryDocument,
  type AsyncNotificationSummaryUpdateAction,
  type FirestoreDocument,
  type FirestoreDocumentData,
  type InitializedNotificationModel
} from '@dereekb/firebase';
import { type FirebaseServerActionsContext, assertSnapshotData } from '@dereekb/firebase-server';
import { type Maybe, performAsyncTasks } from '@dereekb/util';
import { type TransformAndValidateFunctionResult } from '@dereekb/model';
import { notificationModelAlreadyInitializedError } from './notification.error';
import { type InjectionToken } from '@nestjs/common';

// MARK: NotificationInitServerActionsContextConfig
/**
 * Token to access/override the NotificationTemplateService's defaults records.
 */
export const NOTIFICATION_INIT_SERVER_ACTIONS_CONTEXT_CONFIG_TOKEN: InjectionToken = 'NOTIFICATION_INIT_SERVER_ACTIONS_CONTEXT_CONFIG';

export interface NotificationInitServerActionsContextConfig {
  /**
   * MakeTemplateForNotificationBoxInitializationFunction used by the system for initializing the NotificationBoxes for models.
   */
  readonly makeTemplateForNotificationBoxInitialization: MakeTemplateForNotificationBoxInitializationFunction;
  /**
   * MakeTemplateForNotificationBoxInitializationFunction used by the system for initializing the NotificationSummaries for models.
   */
  readonly makeTemplateForNotificationSummaryInitialization: MakeTemplateForNotificationSummaryInitializationFunction;
}

export interface MakeTemplateForNotificationRelatedModelInitializationFunctionInput {
  readonly transaction: Transaction;
  readonly flatModelKey: TwoWayFlatFirestoreModelKey;
  readonly modelKey: FirestoreModelKey;
  readonly collectionName: FirestoreCollectionName;
}

export type MakeTemplateForNotificationRelatedModelInitializationFunctionInvalidResponse = null;

export const MAKE_TEMPLATE_FOR_NOTIFICATION_RELATED_MODEL_INITIALIZATION_FUNCTION_DELETE_RESPONSE = false;
export type MakeTemplateForNotificationRelatedModelInitializationFunctionDeleteResponse = typeof MAKE_TEMPLATE_FOR_NOTIFICATION_RELATED_MODEL_INITIALIZATION_FUNCTION_DELETE_RESPONSE;

export type MakeTemplateForNotificationRelatedModelInitializationFunctionResult<T> = Partial<T> | MakeTemplateForNotificationRelatedModelInitializationFunctionInvalidResponse | MakeTemplateForNotificationRelatedModelInitializationFunctionDeleteResponse;

/**
 * Idempotent function used by the system to determine how to handle a model initialization.
 *
 * Behavior:
 * - Returns a template for the input that is used for initializing the notification model. Typically this is the owner, or name, etc.
 * - If null/undefined is returned, then the model will be flagged as invalid instead.
 * - If false, then the notification model will be deleted. Used for cases where a model should not have t
 */
export type MakeTemplateForNotificationRelatedModelInitializationFunction<T> = (input: MakeTemplateForNotificationRelatedModelInitializationFunctionInput) => Promise<MakeTemplateForNotificationRelatedModelInitializationFunctionResult<T>>;

export type MakeTemplateForNotificationBoxInitializationFunction = MakeTemplateForNotificationRelatedModelInitializationFunction<NotificationBox>;
export type MakeTemplateForNotificationSummaryInitializationFunction = MakeTemplateForNotificationRelatedModelInitializationFunction<NotificationSummary>;

// MARK: Notificaiton Initialization Server Actions
export interface NotificationInitServerActionsContext extends FirebaseServerActionsContext, NotificationFirestoreCollections, FirestoreContextReference, NotificationInitServerActionsContextConfig {}

export abstract class NotificationInitServerActions {
  abstract initializeNotificationBox(params: InitializeNotificationModelParams): AsyncNotificationBoxUpdateAction<InitializeNotificationModelParams>;
  abstract initializeAllApplicableNotificationBoxes(params: InitializeAllApplicableNotificationBoxesParams): Promise<TransformAndValidateFunctionResult<InitializeAllApplicableNotificationBoxesParams, () => Promise<InitializeAllApplicableNotificationBoxesResult>>>;
  abstract initializeNotificationSummary(params: InitializeNotificationModelParams): AsyncNotificationSummaryUpdateAction<InitializeNotificationModelParams>;
  abstract initializeAllApplicableNotificationSummaries(params: InitializeAllApplicableNotificationSummariesParams): Promise<TransformAndValidateFunctionResult<InitializeAllApplicableNotificationSummariesParams, () => Promise<InitializeAllApplicableNotificationSummariesResult>>>;
}

export function notificationInitServerActions(context: NotificationInitServerActionsContext): NotificationInitServerActions {
  return {
    initializeNotificationBox: initializeNotificationBoxFactory(context),
    initializeAllApplicableNotificationBoxes: initializeAllApplicableNotificationBoxesFactory(context),
    initializeNotificationSummary: initializeNotificationSummaryFactory(context),
    initializeAllApplicableNotificationSummaries: initializeAllApplicableNotificationSummariesFactory(context)
  };
}

export interface InitializeNotificationModelInTransactionInput<D extends FirestoreDocument<InitializedNotificationModel, any>> {
  readonly makeTemplateFunction: MakeTemplateForNotificationRelatedModelInitializationFunction<FirestoreDocumentData<D>>;
  readonly throwErrorIfAlreadyInitialized?: Maybe<boolean>;
  readonly transaction: Transaction;
  readonly document: D;
  readonly data: FirestoreDocumentData<D>;
}

export async function initializeNotificationModelInTransaction<D extends FirestoreDocument<InitializedNotificationModel, any>>(input: InitializeNotificationModelInTransactionInput<D>) {
  const { makeTemplateFunction, throwErrorIfAlreadyInitialized, transaction, document: documentInTransaction, data: notificationBox } = input;

  let initialized: boolean = false;
  const alreadyInitialized: boolean = !notificationBox.s;

  if (!alreadyInitialized) {
    const flatModelKey = documentInTransaction.id;
    const modelKey = inferKeyFromTwoWayFlatFirestoreModelKey(flatModelKey);
    const modelCollectionName = firestoreModelKeyCollectionName(modelKey) as string;

    const input: MakeTemplateForNotificationRelatedModelInitializationFunctionInput = {
      transaction,
      flatModelKey,
      modelKey,
      collectionName: modelCollectionName
    };

    const template = await makeTemplateFunction(input);

    if (template === false) {
      await documentInTransaction.accessor.delete();
    } else if (template == null) {
      await documentInTransaction.update({
        s: false, // set false when "f" is set true
        fi: true
      });
    } else {
      initialized = true;

      await documentInTransaction.update({
        //
        ...template,
        m: undefined, // should not be changed
        s: null, // is now initialized.
        fi: false // set false
      });
    }
  } else if (throwErrorIfAlreadyInitialized) {
    throw notificationModelAlreadyInitializedError();
  }

  return {
    initialized,
    alreadyInitialized
  };
}

export function initializeNotificationBoxInTransactionFactory(context: NotificationInitServerActionsContext) {
  const { notificationBoxCollection, makeTemplateForNotificationBoxInitialization } = context;

  return async (params: InitializeNotificationModelParams, notificationBoxDocument: NotificationBoxDocument, transaction: Transaction) => {
    const { throwErrorIfAlreadyInitialized } = params;
    const notificationBoxDocumentInTransaction = notificationBoxCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(notificationBoxDocument);
    const notificationBox = await assertSnapshotData(notificationBoxDocumentInTransaction);

    return initializeNotificationModelInTransaction({
      makeTemplateFunction: makeTemplateForNotificationBoxInitialization,
      throwErrorIfAlreadyInitialized,
      transaction,
      document: notificationBoxDocumentInTransaction,
      data: notificationBox
    });
  };
}

export function initializeNotificationBoxFactory(context: NotificationInitServerActionsContext) {
  const { firestoreContext, firebaseServerActionTransformFunctionFactory } = context;
  const initializeNotificationBoxInTransaction = initializeNotificationBoxInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(InitializeNotificationModelParams, async (params) => {
    return async (notificationBoxDocument: NotificationBoxDocument) => {
      await firestoreContext.runTransaction((transaction) => initializeNotificationBoxInTransaction(params, notificationBoxDocument, transaction));
      return notificationBoxDocument;
    };
  });
}

export function initializeAllApplicableNotificationBoxesFactory(context: NotificationInitServerActionsContext) {
  const { firestoreContext, firebaseServerActionTransformFunctionFactory, notificationBoxCollection, notificationCollectionGroup } = context;
  const initializeNotificationBoxInTransaction = initializeNotificationBoxInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(InitializeAllApplicableNotificationBoxesParams, async () => {
    return async () => {
      let notificationBoxesVisited: number = 0;
      let notificationBoxesSucceeded: number = 0;
      let notificationBoxesFailed: number = 0;
      let notificationBoxesAlreadyInitialized: number = 0;

      const initializeNotificationBoxParams: InitializeNotificationModelParams = { key: firestoreDummyKey(), throwErrorIfAlreadyInitialized: false };

      async function initializeNotificationBoxes() {
        const query = notificationBoxCollection.queryDocument(notificationBoxesFlaggedForNeedsInitializationQuery());
        const notificationBoxDocuments = await query.getDocs();

        const result = await performAsyncTasks(
          notificationBoxDocuments,
          async (notificationBoxDocument) => {
            return firestoreContext.runTransaction((transaction) => initializeNotificationBoxInTransaction(initializeNotificationBoxParams, notificationBoxDocument, transaction));
          },
          {
            maxParallelTasks: 5
          }
        );

        return result;
      }

      // iterate through all NotificationBox items that need to be synced
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const initializeNotificationBoxesResults = await initializeNotificationBoxes();
        initializeNotificationBoxesResults.results.forEach((x) => {
          const result = x[1];

          if (result.alreadyInitialized) {
            notificationBoxesAlreadyInitialized += 1;
          } else if (result.initialized) {
            notificationBoxesSucceeded += 1;
          } else {
            notificationBoxesFailed += 1;
          }
        });

        const found = initializeNotificationBoxesResults.results.length;
        notificationBoxesVisited += found;

        if (!found) {
          break;
        }
      }

      const result: InitializeAllApplicableNotificationBoxesResult = {
        notificationBoxesVisited,
        notificationBoxesSucceeded,
        notificationBoxesFailed,
        notificationBoxesAlreadyInitialized
      };

      return result;
    };
  });
}

export function initializeNotificationSummaryInTransactionFactory(context: NotificationInitServerActionsContext) {
  const { notificationSummaryCollection, makeTemplateForNotificationSummaryInitialization } = context;

  return async (params: InitializeNotificationModelParams, notificationSummaryDocument: NotificationSummaryDocument, transaction: Transaction) => {
    const { throwErrorIfAlreadyInitialized } = params;
    const notificationSummaryDocumentInTransaction = notificationSummaryCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(notificationSummaryDocument);
    const notificationSummary = await assertSnapshotData(notificationSummaryDocumentInTransaction);

    return initializeNotificationModelInTransaction({
      makeTemplateFunction: makeTemplateForNotificationSummaryInitialization,
      throwErrorIfAlreadyInitialized,
      transaction,
      document: notificationSummaryDocumentInTransaction,
      data: notificationSummary
    });
  };
}

export function initializeNotificationSummaryFactory(context: NotificationInitServerActionsContext) {
  const { firestoreContext, firebaseServerActionTransformFunctionFactory } = context;
  const initializeNotificationSummaryInTransaction = initializeNotificationSummaryInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(InitializeNotificationModelParams, async (params) => {
    return async (notificationSummaryDocument: NotificationSummaryDocument) => {
      await firestoreContext.runTransaction((transaction) => initializeNotificationSummaryInTransaction(params, notificationSummaryDocument, transaction));
      return notificationSummaryDocument;
    };
  });
}

export function initializeAllApplicableNotificationSummariesFactory(context: NotificationInitServerActionsContext) {
  const { firestoreContext, firebaseServerActionTransformFunctionFactory, notificationSummaryCollection, notificationCollectionGroup } = context;
  const initializeNotificationSummaryInTransaction = initializeNotificationSummaryInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(InitializeAllApplicableNotificationSummariesParams, async () => {
    return async () => {
      let notificationSummariesVisited: number = 0;
      let notificationSummariesSucceeded: number = 0;
      let notificationSummariesFailed: number = 0;
      let notificationSummariesAlreadyInitialized: number = 0;

      const initializeNotificationSummaryParams: InitializeNotificationModelParams = { key: firestoreDummyKey(), throwErrorIfAlreadyInitialized: false };

      async function initializeNotificationSummaries() {
        const query = notificationSummaryCollection.queryDocument(notificationSummariesFlaggedForNeedsInitializationQuery());
        const notificationSummaryDocuments = await query.getDocs();

        const result = await performAsyncTasks(
          notificationSummaryDocuments,
          async (notificationSummaryDocument) => {
            return firestoreContext.runTransaction((transaction) => initializeNotificationSummaryInTransaction(initializeNotificationSummaryParams, notificationSummaryDocument, transaction));
          },
          {
            maxParallelTasks: 5
          }
        );

        return result;
      }

      // iterate through all NotificationSummary items that need to be synced
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const initializeNotificationSummariesResults = await initializeNotificationSummaries();
        initializeNotificationSummariesResults.results.forEach((x) => {
          const result = x[1];

          if (result.alreadyInitialized) {
            notificationSummariesAlreadyInitialized += 1;
          } else if (result.initialized) {
            notificationSummariesSucceeded += 1;
          } else {
            notificationSummariesFailed += 1;
          }
        });

        const found = initializeNotificationSummariesResults.results.length;
        notificationSummariesVisited += found;

        if (!found) {
          break;
        }
      }

      const result: InitializeAllApplicableNotificationSummariesResult = {
        notificationSummariesVisited,
        notificationSummariesSucceeded,
        notificationSummariesFailed,
        notificationSummariesAlreadyInitialized
      };

      return result;
    };
  });
}
