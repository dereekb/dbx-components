import { FirestoreContextReference, Transaction, firestoreDummyKey, inferKeyFromTwoWayFlatFirestoreModelKey, firestoreModelKeyCollectionName, TwoWayFlatFirestoreModelKey, FirestoreModelKey, FirestoreCollectionName } from '@dereekb/firebase';
import { FirebaseServerActionsContext, assertSnapshotData } from '@dereekb/firebase-server';
import { NotificationFirestoreCollections, AsyncNotificationBoxUpdateAction, NotificationBoxDocument, InitializeNotificationBoxParams, InitializeAllApplicableNotificationBoxesParams, InitializeAllApplicableNotificationBoxesResult, notificationBoxesFlaggedForNeedsInitializationQuery, NotificationBox } from '@dereekb/firebase';
import { Maybe, performAsyncTasks } from '@dereekb/util';
import { TransformAndValidateFunctionResult } from '@dereekb/model';
import { notificationBoxAlreadyInitializedError } from './notification.error';

export interface NotificationInitServerActionsContextConfig {
  /**
   * MakeTemplateForNotificationBoxInitializationFunction used by the system for initializing the NotificationBoxes for models.
   */
  readonly makeTemplateForNotificationBoxInitialization: MakeTemplateForNotificationBoxInitializationFunction;
}

export interface MakeTemplateForNotificationBoxInitializationFunctionInput {
  readonly transaction: Transaction;
  readonly flatModelKey: TwoWayFlatFirestoreModelKey;
  readonly modelKey: FirestoreModelKey;
  readonly collectionName: FirestoreCollectionName;
}

export type MakeTemplateForNotificationBoxInitializationFunctionDeleteResponse = false;

/**
 * Function used by the system to determine how to handle a NotifcationBox initialization.
 *
 * Behavior:
 * - Creates a template for the input for initializing a NotificationBox with its related model for models that should be initialized.
 * - If null/undefined is returned, then the model will be flagged as invalid instead.
 * - If false, then the NotificationBox will be deleted.
 */
export type MakeTemplateForNotificationBoxInitializationFunction = (input: MakeTemplateForNotificationBoxInitializationFunctionInput) => Promise<Maybe<Partial<NotificationBox>> | MakeTemplateForNotificationBoxInitializationFunctionDeleteResponse>;

export interface NotificationInitServerActionsContext extends FirebaseServerActionsContext, NotificationFirestoreCollections, FirestoreContextReference, NotificationInitServerActionsContextConfig {}

export abstract class NotificationInitServerActions {
  abstract initializeNotificationBox(params: InitializeNotificationBoxParams): AsyncNotificationBoxUpdateAction<InitializeNotificationBoxParams>;
  abstract initializeAllApplicableNotificationBoxes(params: InitializeAllApplicableNotificationBoxesParams): Promise<TransformAndValidateFunctionResult<InitializeAllApplicableNotificationBoxesParams, () => Promise<InitializeAllApplicableNotificationBoxesResult>>>;
}

export function notificationInitServerActions(context: NotificationInitServerActionsContext): NotificationInitServerActions {
  return {
    initializeNotificationBox: initializeNotificationBoxFactory(context),
    initializeAllApplicableNotificationBoxes: initializeAllApplicableNotificationBoxesFactory(context)
  };
}

export function initializeNotificationBoxInTransactionFactory(context: NotificationInitServerActionsContext) {
  const { notificationBoxCollection, makeTemplateForNotificationBoxInitialization } = context;

  return async (params: InitializeNotificationBoxParams, notificationBoxDocument: NotificationBoxDocument, transaction: Transaction) => {
    const { throwErrorIfInitialized } = params;
    const notificationBoxDocumentInTransaction = notificationBoxCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(notificationBoxDocument);
    const notificationBox = await assertSnapshotData(notificationBoxDocumentInTransaction);

    let initialized: boolean = false;
    const alreadyInitialized: boolean = !notificationBox.s;

    if (!alreadyInitialized) {
      const flatModelKey = notificationBoxDocument.id;
      const modelKey = inferKeyFromTwoWayFlatFirestoreModelKey(flatModelKey);
      const modelCollectionName = firestoreModelKeyCollectionName(modelKey) as string;

      const input: MakeTemplateForNotificationBoxInitializationFunctionInput = {
        transaction,
        flatModelKey,
        modelKey,
        collectionName: modelCollectionName
      };

      const template = await makeTemplateForNotificationBoxInitialization(input);

      if (template === false) {
        await notificationBoxDocumentInTransaction.accessor.delete();
      } else if (template == null) {
        await notificationBoxDocumentInTransaction.update({
          s: false, // set false when "f" is set true
          f: true
        });
      } else {
        initialized = true;

        await notificationBoxDocumentInTransaction.update({
          //
          ...template,
          m: undefined, // should not be changed
          s: null, // is now initialized.
          f: false // set false
        });
      }
    } else if (throwErrorIfInitialized) {
      throw notificationBoxAlreadyInitializedError();
    }

    return {
      initialized,
      alreadyInitialized
    };
  };
}

export function initializeNotificationBoxFactory(context: NotificationInitServerActionsContext) {
  const { firestoreContext, firebaseServerActionTransformFunctionFactory } = context;
  const initializeNotificationBoxInTransaction = initializeNotificationBoxInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(InitializeNotificationBoxParams, async (params) => {
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

      const initializeNotificationBoxParams: InitializeNotificationBoxParams = { key: firestoreDummyKey(), throwErrorIfInitialized: false };

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

      // iterate through all JobApplication items that need to be synced
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
