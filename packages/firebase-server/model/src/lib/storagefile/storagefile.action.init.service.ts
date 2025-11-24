import {
  type FirestoreContextReference,
  type Transaction,
  firestoreDummyKey,
  inferKeyFromTwoWayFlatFirestoreModelKey,
  firestoreModelKeyCollectionName,
  type TwoWayFlatFirestoreModelKey,
  type FirestoreModelKey,
  type FirestoreCollectionName,
  type StorageFileFirestoreCollections,
  type StorageFileGroupDocument,
  InitializeStorageFileModelParams,
  InitializeAllApplicableStorageFileGroupsParams,
  type InitializeAllApplicableStorageFileGroupsResult,
  storageFileGroupsFlaggedForNeedsInitializationQuery,
  type StorageFileGroup,
  type FirestoreDocument,
  type FirestoreDocumentData,
  type InitializedStorageFileModel,
  AsyncStorageFileGroupUpdateAction
} from '@dereekb/firebase';
import { type FirebaseServerActionsContext, assertSnapshotData } from '@dereekb/firebase-server';
import { type Maybe, performAsyncTasks } from '@dereekb/util';
import { type TransformAndValidateFunctionResult } from '@dereekb/model';
import { storageFileModelAlreadyInitializedError } from './storagefile.error';
import { type InjectionToken } from '@nestjs/common';

// MARK: StorageFileInitServerActionsContextConfig
/**
 * Token to access/override the StorageFileTemplateService's defaults records.
 */
export const STORAGE_FILE_INIT_SERVER_ACTIONS_CONTEXT_CONFIG_TOKEN: InjectionToken = 'STORAGE_FILE_INIT_SERVER_ACTIONS_CONTEXT_CONFIG';

export interface StorageFileInitServerActionsContextConfig {
  /**
   * MakeTemplateForStorageFileGroupInitializationFunction used by the system for initializing the StorageFileGroups for models.
   */
  readonly makeTemplateForStorageFileGroupInitialization: MakeTemplateForStorageFileGroupInitializationFunction;
}

export interface MakeTemplateForStorageFileRelatedModelInitializationFunctionInput {
  readonly transaction: Transaction;
  readonly flatModelKey: TwoWayFlatFirestoreModelKey;
  readonly modelKey: FirestoreModelKey;
  readonly collectionName: FirestoreCollectionName;
}

export type MakeTemplateForStorageFileRelatedModelInitializationFunctionInvalidResponse = null;

export const MAKE_TEMPLATE_FOR_STORAGEFILE_RELATED_MODEL_INITIALIZATION_FUNCTION_DELETE_RESPONSE = false;
export type MakeTemplateForStorageFileRelatedModelInitializationFunctionDeleteResponse = typeof MAKE_TEMPLATE_FOR_STORAGEFILE_RELATED_MODEL_INITIALIZATION_FUNCTION_DELETE_RESPONSE;

export type MakeTemplateForStorageFileRelatedModelInitializationFunctionResult<T> = Partial<T> | MakeTemplateForStorageFileRelatedModelInitializationFunctionInvalidResponse | MakeTemplateForStorageFileRelatedModelInitializationFunctionDeleteResponse;

/**
 * Idempotent function used by the system to determine how to handle a model initialization.
 *
 * Behavior:
 * - Returns a template for the input that is used for initializing the storagefile model. Typically this is the owner, or name, etc.
 * - If null/undefined is returned, then the model will be flagged as invalid instead.
 * - If false, then the storagefile model will be deleted. Used for cases where a model should not have t
 */
export type MakeTemplateForStorageFileRelatedModelInitializationFunction<T> = (input: MakeTemplateForStorageFileRelatedModelInitializationFunctionInput) => Promise<MakeTemplateForStorageFileRelatedModelInitializationFunctionResult<T>>;

export type MakeTemplateForStorageFileGroupInitializationFunction = MakeTemplateForStorageFileRelatedModelInitializationFunction<StorageFileGroup>;

// MARK: Notificaiton Initialization Server Actions
export interface StorageFileInitServerActionsContext extends FirebaseServerActionsContext, StorageFileFirestoreCollections, FirestoreContextReference, StorageFileInitServerActionsContextConfig {}

export abstract class StorageFileInitServerActions {
  abstract initializeStorageFileGroup(params: InitializeStorageFileModelParams): AsyncStorageFileGroupUpdateAction<InitializeStorageFileModelParams>;
  abstract initializeAllApplicableStorageFileGroups(params: InitializeAllApplicableStorageFileGroupsParams): Promise<TransformAndValidateFunctionResult<InitializeAllApplicableStorageFileGroupsParams, () => Promise<InitializeAllApplicableStorageFileGroupsResult>>>;
}

export function storageFileInitServerActions(context: StorageFileInitServerActionsContext): StorageFileInitServerActions {
  return {
    initializeStorageFileGroup: initializeStorageFileGroupFactory(context),
    initializeAllApplicableStorageFileGroups: initializeAllApplicableStorageFileGroupsFactory(context)
  };
}

export interface InitializeStorageFileModelInTransactionInput<D extends FirestoreDocument<InitializedStorageFileModel, any>> {
  readonly makeTemplateFunction: MakeTemplateForStorageFileRelatedModelInitializationFunction<FirestoreDocumentData<D>>;
  readonly throwErrorIfAlreadyInitialized?: Maybe<boolean>;
  readonly transaction: Transaction;
  readonly document: D;
  readonly data: FirestoreDocumentData<D>;
}

export async function initializeStorageFileModelInTransaction<D extends FirestoreDocument<InitializedStorageFileModel, any>>(input: InitializeStorageFileModelInTransactionInput<D>) {
  const { makeTemplateFunction, throwErrorIfAlreadyInitialized, transaction, document: documentInTransaction, data: storageFileGroup } = input;

  let initialized: boolean = false;
  const alreadyInitialized: boolean = !storageFileGroup.s;

  if (!alreadyInitialized) {
    const flatModelKey = documentInTransaction.id;
    const modelKey = inferKeyFromTwoWayFlatFirestoreModelKey(flatModelKey);
    const modelCollectionName = firestoreModelKeyCollectionName(modelKey) as string;

    const input: MakeTemplateForStorageFileRelatedModelInitializationFunctionInput = {
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
    throw storageFileModelAlreadyInitializedError();
  }

  return {
    initialized,
    alreadyInitialized
  };
}

export function initializeStorageFileGroupInTransactionFactory(context: StorageFileInitServerActionsContext) {
  const { storageFileGroupCollection, makeTemplateForStorageFileGroupInitialization } = context;

  return async (params: InitializeStorageFileModelParams, storageFileGroupDocument: StorageFileGroupDocument, transaction: Transaction) => {
    const { throwErrorIfAlreadyInitialized } = params;
    const storageFileGroupDocumentInTransaction = storageFileGroupCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(storageFileGroupDocument);
    const storageFileGroup = await assertSnapshotData(storageFileGroupDocumentInTransaction);

    return initializeStorageFileModelInTransaction({
      makeTemplateFunction: makeTemplateForStorageFileGroupInitialization,
      throwErrorIfAlreadyInitialized,
      transaction,
      document: storageFileGroupDocumentInTransaction,
      data: storageFileGroup
    });
  };
}

export function initializeStorageFileGroupFactory(context: StorageFileInitServerActionsContext) {
  const { firestoreContext, firebaseServerActionTransformFunctionFactory } = context;
  const initializeStorageFileGroupInTransaction = initializeStorageFileGroupInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(InitializeStorageFileModelParams, async (params) => {
    return async (storageFileGroupDocument: StorageFileGroupDocument) => {
      await firestoreContext.runTransaction((transaction) => initializeStorageFileGroupInTransaction(params, storageFileGroupDocument, transaction));
      return storageFileGroupDocument;
    };
  });
}

export function initializeAllApplicableStorageFileGroupsFactory(context: StorageFileInitServerActionsContext) {
  const { firestoreContext, firebaseServerActionTransformFunctionFactory, storageFileGroupCollection } = context;
  const initializeStorageFileGroupInTransaction = initializeStorageFileGroupInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(InitializeAllApplicableStorageFileGroupsParams, async () => {
    return async () => {
      let storageFileGroupsVisited: number = 0;
      let storageFileGroupsSucceeded: number = 0;
      let storageFileGroupsFailed: number = 0;
      let storageFileGroupsAlreadyInitialized: number = 0;

      const initializeStorageFileGroupParams: InitializeStorageFileModelParams = { key: firestoreDummyKey(), throwErrorIfAlreadyInitialized: false };

      async function initializeStorageFileGroups() {
        const query = storageFileGroupCollection.queryDocument(storageFileGroupsFlaggedForNeedsInitializationQuery());
        const storageFileGroupDocuments = await query.getDocs();

        const result = await performAsyncTasks(
          storageFileGroupDocuments,
          async (storageFileGroupDocument) => {
            return firestoreContext.runTransaction((transaction) => initializeStorageFileGroupInTransaction(initializeStorageFileGroupParams, storageFileGroupDocument, transaction));
          },
          {
            maxParallelTasks: 5
          }
        );

        return result;
      }

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const initializeStorageFileGroupsResults = await initializeStorageFileGroups();
        initializeStorageFileGroupsResults.results.forEach((x) => {
          const result = x[1];

          if (result.alreadyInitialized) {
            storageFileGroupsAlreadyInitialized += 1;
          } else if (result.initialized) {
            storageFileGroupsSucceeded += 1;
          } else {
            storageFileGroupsFailed += 1;
          }
        });

        const found = initializeStorageFileGroupsResults.results.length;
        storageFileGroupsVisited += found;

        if (!found) {
          break;
        }
      }

      const result: InitializeAllApplicableStorageFileGroupsResult = {
        storageFileGroupsVisited,
        storageFileGroupsSucceeded,
        storageFileGroupsFailed,
        storageFileGroupsAlreadyInitialized
      };

      return result;
    };
  });
}
