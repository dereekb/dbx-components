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
  type InitializeNotificationModelParams,
  initializeNotificationModelParamsType,
  type InitializeAllApplicableNotificationBoxesParams,
  initializeAllApplicableNotificationBoxesParamsType,
  type InitializeAllApplicableNotificationBoxesResult,
  notificationBoxesFlaggedForNeedsInitializationQuery,
  type NotificationBox,
  type NotificationSummary,
  type InitializeAllApplicableNotificationSummariesParams,
  initializeAllApplicableNotificationSummariesParamsType,
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
 * NestJS injection token for the {@link NotificationInitServerActionsContextConfig},
 * which provides the template functions used during {@link NotificationBox} and
 * {@link NotificationSummary} initialization.
 */
export const NOTIFICATION_INIT_SERVER_ACTIONS_CONTEXT_CONFIG_TOKEN: InjectionToken = 'NOTIFICATION_INIT_SERVER_ACTIONS_CONTEXT_CONFIG';

/**
 * Configuration providing the template functions that determine how notification models
 * (boxes and summaries) are initialized for a given Firestore model.
 */
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

/**
 * Input passed to the template function during notification model initialization,
 * providing the Firestore transaction context and the model identity being initialized.
 */
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

// MARK: Notification Initialization Server Actions
/**
 * Full context for notification initialization actions, combining Firebase infrastructure,
 * notification Firestore collections, and the initialization template functions.
 */
export interface NotificationInitServerActionsContext extends FirebaseServerActionsContext, NotificationFirestoreCollections, FirestoreContextReference, NotificationInitServerActionsContextConfig {}

/**
 * Abstract service defining initialization actions for notification models.
 *
 * Provides methods to initialize individual {@link NotificationBox}/{@link NotificationSummary}
 * documents or batch-process all uninitialized ones. Initialization uses the app-specific
 * template functions from {@link NotificationInitServerActionsContextConfig} to determine
 * the initial state for each model.
 *
 * @see {@link notificationInitServerActions} for the concrete implementation factory.
 */
export abstract class NotificationInitServerActions {
  abstract initializeNotificationBox(params: InitializeNotificationModelParams): AsyncNotificationBoxUpdateAction<InitializeNotificationModelParams>;
  abstract initializeAllApplicableNotificationBoxes(params: InitializeAllApplicableNotificationBoxesParams): Promise<TransformAndValidateFunctionResult<InitializeAllApplicableNotificationBoxesParams, () => Promise<InitializeAllApplicableNotificationBoxesResult>>>;
  abstract initializeNotificationSummary(params: InitializeNotificationModelParams): AsyncNotificationSummaryUpdateAction<InitializeNotificationModelParams>;
  abstract initializeAllApplicableNotificationSummaries(params: InitializeAllApplicableNotificationSummariesParams): Promise<TransformAndValidateFunctionResult<InitializeAllApplicableNotificationSummariesParams, () => Promise<InitializeAllApplicableNotificationSummariesResult>>>;
}

/**
 * Creates a concrete {@link NotificationInitServerActions} implementation by wiring each
 * initialization action to its factory function.
 *
 * @param context - the initialization context with template functions and Firestore access
 * @returns a fully wired {@link NotificationInitServerActions} instance
 *
 * @example
 * ```ts
 * const initActions = notificationInitServerActions(context);
 * const initBox = await initActions.initializeNotificationBox({ key: modelKey });
 * await initBox(notificationBoxDocument);
 * ```
 */
export function notificationInitServerActions(context: NotificationInitServerActionsContext): NotificationInitServerActions {
  return {
    initializeNotificationBox: initializeNotificationBoxFactory(context),
    initializeAllApplicableNotificationBoxes: initializeAllApplicableNotificationBoxesFactory(context),
    initializeNotificationSummary: initializeNotificationSummaryFactory(context),
    initializeAllApplicableNotificationSummaries: initializeAllApplicableNotificationSummariesFactory(context)
  };
}

/**
 * Input for {@link initializeNotificationModelInTransaction}, providing the document,
 * its current data, the template function, and the transaction context.
 */
export interface InitializeNotificationModelInTransactionInput<
  D extends // eslint-disable-next-line @typescript-eslint/no-explicit-any
    FirestoreDocument<InitializedNotificationModel, any>
> {
  readonly makeTemplateFunction: MakeTemplateForNotificationRelatedModelInitializationFunction<FirestoreDocumentData<D>>;
  readonly throwErrorIfAlreadyInitialized?: Maybe<boolean>;
  readonly transaction: Transaction;
  readonly document: D;
  readonly data: FirestoreDocumentData<D>;
}

/**
 * Initializes a notification model document (box or summary) within a Firestore transaction.
 *
 * Uses the provided template function to determine the initial state:
 * - Returns a partial template → applies it and marks as initialized (`s=null`)
 * - Returns `null`/`undefined` → marks the model as invalid (`fi=true`)
 * - Returns `false` → deletes the document entirely
 *
 * Skips initialization if the model is already initialized, optionally throwing an error.
 *
 * @param input - the document, transaction, template function, and options
 * @returns an object with `initialized` and `alreadyInitialized` boolean flags
 * @throws notificationModelAlreadyInitializedError when `throwErrorIfAlreadyInitialized` is true
 */
export async function initializeNotificationModelInTransaction<
  D extends // eslint-disable-next-line @typescript-eslint/no-explicit-any
    FirestoreDocument<InitializedNotificationModel, any>
>(input: InitializeNotificationModelInTransactionInput<D>) {
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

/**
 * Factory for initializing a single {@link NotificationBox} within a Firestore transaction.
 *
 * Loads the box document in the transaction, reads its current data, and delegates
 * to {@link initializeNotificationModelInTransaction} with the box-specific template function.
 *
 * @param context - the initialization context with collection references and template functions
 * @returns an async function that initializes a notification box given params, document, and transaction
 */
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

/**
 * Factory for the `initializeNotificationBox` action.
 *
 * Wraps the in-transaction initialization in a Firestore transaction
 * and follows the transform-and-validate pattern.
 *
 * @param context - the initialization context with Firestore access and template functions
 * @returns a transform-and-validate function that initializes a single notification box
 */
export function initializeNotificationBoxFactory(context: NotificationInitServerActionsContext) {
  const { firestoreContext, firebaseServerActionTransformFunctionFactory } = context;
  const initializeNotificationBoxInTransaction = initializeNotificationBoxInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(initializeNotificationModelParamsType, async (params) => {
    return async (notificationBoxDocument: NotificationBoxDocument) => {
      await firestoreContext.runTransaction((transaction) => initializeNotificationBoxInTransaction(params, notificationBoxDocument, transaction));
      return notificationBoxDocument;
    };
  });
}

/**
 * Factory for the `initializeAllApplicableNotificationBoxes` action.
 *
 * Batch-processes all {@link NotificationBox} documents flagged for initialization
 * by querying for entries with `s=true` (setup needed), then initializing each in
 * parallel (up to 5 concurrent tasks). Loops until no more flagged boxes are found.
 *
 * @param context - the initialization context with Firestore access and collection references
 * @returns a transform-and-validate function that batch-initializes all applicable notification boxes
 */
export function initializeAllApplicableNotificationBoxesFactory(context: NotificationInitServerActionsContext) {
  const { firestoreContext, firebaseServerActionTransformFunctionFactory, notificationBoxCollection } = context;
  const initializeNotificationBoxInTransaction = initializeNotificationBoxInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(initializeAllApplicableNotificationBoxesParamsType, async () => {
    return async () => {
      let notificationBoxesVisited: number = 0;
      let notificationBoxesSucceeded: number = 0;
      let notificationBoxesFailed: number = 0;
      let notificationBoxesAlreadyInitialized: number = 0;

      const initializeNotificationBoxParams: InitializeNotificationModelParams = { key: firestoreDummyKey(), throwErrorIfAlreadyInitialized: false };

      async function initializeNotificationBoxes() {
        const query = notificationBoxCollection.queryDocument(notificationBoxesFlaggedForNeedsInitializationQuery());
        const notificationBoxDocuments = await query.getDocs();

        // eslint-disable-next-line sonarjs/prefer-immediate-return -- intermediate variable needed for type inference
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

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- intentional infinite loop with break
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

/**
 * Factory for initializing a single {@link NotificationSummary} within a Firestore transaction.
 *
 * Loads the summary document in the transaction, reads its current data, and delegates
 * to {@link initializeNotificationModelInTransaction} with the summary-specific template function.
 *
 * @param context - the initialization context with collection references and template functions
 * @returns an async function that initializes a notification summary given params, document, and transaction
 */
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

/**
 * Factory for the `initializeNotificationSummary` action.
 *
 * Wraps the in-transaction summary initialization in a Firestore transaction
 * and follows the transform-and-validate pattern.
 *
 * @param context - the initialization context with Firestore access and template functions
 * @returns a transform-and-validate function that initializes a single notification summary
 */
export function initializeNotificationSummaryFactory(context: NotificationInitServerActionsContext) {
  const { firestoreContext, firebaseServerActionTransformFunctionFactory } = context;
  const initializeNotificationSummaryInTransaction = initializeNotificationSummaryInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(initializeNotificationModelParamsType, async (params) => {
    return async (notificationSummaryDocument: NotificationSummaryDocument) => {
      await firestoreContext.runTransaction((transaction) => initializeNotificationSummaryInTransaction(params, notificationSummaryDocument, transaction));
      return notificationSummaryDocument;
    };
  });
}

/**
 * Factory for the `initializeAllApplicableNotificationSummaries` action.
 *
 * Batch-processes all {@link NotificationSummary} documents flagged for initialization
 * by querying for entries with `s=true` (setup needed), then initializing each in
 * parallel (up to 5 concurrent tasks). Loops until no more flagged summaries are found.
 *
 * @param context - the initialization context with Firestore access and collection references
 * @returns a transform-and-validate function that batch-initializes all applicable notification summaries
 */
export function initializeAllApplicableNotificationSummariesFactory(context: NotificationInitServerActionsContext) {
  const { firestoreContext, firebaseServerActionTransformFunctionFactory, notificationSummaryCollection } = context;
  const initializeNotificationSummaryInTransaction = initializeNotificationSummaryInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(initializeAllApplicableNotificationSummariesParamsType, async () => {
    return async () => {
      let notificationSummariesVisited: number = 0;
      let notificationSummariesSucceeded: number = 0;
      let notificationSummariesFailed: number = 0;
      let notificationSummariesAlreadyInitialized: number = 0;

      const initializeNotificationSummaryParams: InitializeNotificationModelParams = { key: firestoreDummyKey(), throwErrorIfAlreadyInitialized: false };

      async function initializeNotificationSummaries() {
        const query = notificationSummaryCollection.queryDocument(notificationSummariesFlaggedForNeedsInitializationQuery());
        const notificationSummaryDocuments = await query.getDocs();

        // eslint-disable-next-line sonarjs/prefer-immediate-return -- intermediate variable needed for type inference
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

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- intentional infinite loop with break
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
