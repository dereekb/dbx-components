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
  type InitializeStorageFileModelParams,
  initializeStorageFileModelParamsType,
  type InitializeAllApplicableStorageFileGroupsParams,
  initializeAllApplicableStorageFileGroupsParamsType,
  type InitializeAllApplicableStorageFileGroupsResult,
  storageFileGroupsFlaggedForNeedsInitializationQuery,
  type StorageFileGroup,
  type FirestoreDocument,
  type FirestoreDocumentData,
  type InitializedStorageFileModel,
  type AsyncStorageFileGroupUpdateAction,
  type StorageFileGroupContentFlagsData
} from '@dereekb/firebase';
import { type FirebaseServerActionsContext, assertSnapshotData } from '@dereekb/firebase-server';
import { type Maybe, performAsyncTasks } from '@dereekb/util';
import { type TransformAndValidateFunctionResult } from '@dereekb/model';
import { storageFileModelAlreadyInitializedError } from './storagefile.error';
import { type InjectionToken } from '@nestjs/common';

// MARK: StorageFileInitServerActionsContextConfig
/**
 * NestJS injection token for the {@link StorageFileInitServerActionsContextConfig},
 * which provides the template function used during {@link StorageFileGroup} initialization.
 */
export const STORAGE_FILE_INIT_SERVER_ACTIONS_CONTEXT_CONFIG_TOKEN: InjectionToken = 'STORAGE_FILE_INIT_SERVER_ACTIONS_CONTEXT_CONFIG';

/**
 * Configuration providing the template function that determines how {@link StorageFileGroup}
 * documents are initialized for a given Firestore model.
 */
export interface StorageFileInitServerActionsContextConfig {
  /**
   * MakeTemplateForStorageFileGroupInitializationFunction used by the system for initializing the StorageFileGroups for models.
   */
  readonly makeTemplateForStorageFileGroupInitialization: MakeTemplateForStorageFileGroupInitializationFunction;
}

/**
 * Input passed to the template function during storage file model initialization,
 * providing the Firestore transaction context and the model identity being initialized.
 */
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

/**
 * Used for initializing a StorageFileGroup.
 */
export type MakeTemplateForStorageFileGroupInitializationFunction = MakeTemplateForStorageFileRelatedModelInitializationFunction<Pick<StorageFileGroup, 'o'> & StorageFileGroupContentFlagsData>;

// MARK: StorageFile Initialization Server Actions
/**
 * Full context for storage file initialization actions, combining Firebase infrastructure,
 * storage file Firestore collections, and the initialization template function.
 */
export interface StorageFileInitServerActionsContext extends FirebaseServerActionsContext, StorageFileFirestoreCollections, FirestoreContextReference, StorageFileInitServerActionsContextConfig {}

/**
 * Abstract service defining initialization actions for storage file models.
 *
 * Provides methods to initialize individual {@link StorageFileGroup} documents
 * or batch-process all uninitialized groups.
 *
 * @see {@link storageFileInitServerActions} for the concrete implementation factory.
 */
export abstract class StorageFileInitServerActions {
  abstract initializeStorageFileGroup(params: InitializeStorageFileModelParams): AsyncStorageFileGroupUpdateAction<InitializeStorageFileModelParams>;
  abstract initializeAllApplicableStorageFileGroups(params: InitializeAllApplicableStorageFileGroupsParams): Promise<TransformAndValidateFunctionResult<InitializeAllApplicableStorageFileGroupsParams, () => Promise<InitializeAllApplicableStorageFileGroupsResult>>>;
}

/**
 * Creates a concrete {@link StorageFileInitServerActions} implementation by wiring each
 * initialization action to its factory function.
 *
 * @param context - the initialization context with template function and Firestore access
 * @returns a {@link StorageFileInitServerActions} wired to the provided context
 */
export function storageFileInitServerActions(context: StorageFileInitServerActionsContext): StorageFileInitServerActions {
  return {
    initializeStorageFileGroup: initializeStorageFileGroupFactory(context),
    initializeAllApplicableStorageFileGroups: initializeAllApplicableStorageFileGroupsFactory(context)
  };
}

/**
 * Input for {@link initializeStorageFileModelInTransaction}, providing the document,
 * its current data, the template function, and the transaction context.
 */
export interface InitializeStorageFileModelInTransactionInput<D extends FirestoreDocument<InitializedStorageFileModel>> {
  readonly makeTemplateFunction: MakeTemplateForStorageFileRelatedModelInitializationFunction<FirestoreDocumentData<D>>;
  readonly throwErrorIfAlreadyInitialized?: Maybe<boolean>;
  readonly transaction: Transaction;
  readonly document: D;
  readonly data: FirestoreDocumentData<D>;
}

/**
 * Initializes a storage file model document (group) within a Firestore transaction.
 *
 * Uses the provided template function to determine the initial state:
 * - Returns a partial template → applies it and marks as initialized (`s=null`)
 * - Returns `null`/`undefined` → marks the model as invalid (`fi=true`)
 * - Returns `false` → deletes the document entirely
 *
 * @param input - the document, transaction, template function, and options
 * @returns an object indicating whether the document was initialized or was already initialized
 * @throws storageFileModelAlreadyInitializedError when `throwErrorIfAlreadyInitialized` is true
 */
export async function initializeStorageFileModelInTransaction<D extends FirestoreDocument<InitializedStorageFileModel>>(input: InitializeStorageFileModelInTransactionInput<D>) {
  const { makeTemplateFunction, throwErrorIfAlreadyInitialized, transaction, document: documentInTransaction, data: storageFileModel } = input;

  let initialized: boolean = false;
  const alreadyInitialized: boolean = !storageFileModel.s;

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

/**
 * Factory for initializing a single {@link StorageFileGroup} within a Firestore transaction.
 *
 * Applies the app-specific template function, restricting the template to only the `o` (owner)
 * and content flag properties, and always flags the group for content regeneration.
 *
 * @param context - the initialization context providing collection access and the template function
 * @returns an async function that initializes a storage file group document within a transaction
 */
export function initializeStorageFileGroupInTransactionFactory(context: StorageFileInitServerActionsContext) {
  const { storageFileGroupCollection, makeTemplateForStorageFileGroupInitialization } = context;

  return async (params: InitializeStorageFileModelParams, storageFileGroupDocument: StorageFileGroupDocument, transaction: Transaction) => {
    const { throwErrorIfAlreadyInitialized } = params;
    const storageFileGroupDocumentInTransaction = storageFileGroupCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(storageFileGroupDocument);
    const storageFileGroup = await assertSnapshotData(storageFileGroupDocumentInTransaction);

    return initializeStorageFileModelInTransaction({
      makeTemplateFunction: async (input) => {
        const baseTemplate = (await makeTemplateForStorageFileGroupInitialization(input)) as Partial<StorageFileGroup>;

        // template can only define o and any StorageFileGroupContentFlagsData properties
        return {
          o: baseTemplate.o,
          z: baseTemplate.z,
          re: true // always flag for content regeneration
        };
      },
      throwErrorIfAlreadyInitialized,
      transaction,
      document: storageFileGroupDocumentInTransaction,
      data: storageFileGroup
    });
  };
}

/**
 * Factory for the `initializeStorageFileGroup` action.
 *
 * Wraps the in-transaction group initialization in a Firestore transaction
 * and follows the transform-and-validate pattern.
 *
 * @param context - the initialization context with Firestore access and template function
 * @returns a transform-and-validate function for single storage file group initialization
 */
export function initializeStorageFileGroupFactory(context: StorageFileInitServerActionsContext) {
  const { firestoreContext, firebaseServerActionTransformFunctionFactory } = context;
  const initializeStorageFileGroupInTransaction = initializeStorageFileGroupInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(initializeStorageFileModelParamsType, async (params) => {
    return async (storageFileGroupDocument: StorageFileGroupDocument) => {
      await firestoreContext.runTransaction((transaction) => initializeStorageFileGroupInTransaction(params, storageFileGroupDocument, transaction));
      return storageFileGroupDocument;
    };
  });
}

/**
 * Factory for the `initializeAllApplicableStorageFileGroups` action.
 *
 * Batch-processes all {@link StorageFileGroup} documents flagged for initialization,
 * initializing each in parallel (up to 5 concurrent tasks). Loops until no more
 * flagged groups are found.
 *
 * @param context - the initialization context with Firestore access, collection, and template function
 * @returns a transform-and-validate function for batch storage file group initialization
 */
export function initializeAllApplicableStorageFileGroupsFactory(context: StorageFileInitServerActionsContext) {
  const { firestoreContext, firebaseServerActionTransformFunctionFactory, storageFileGroupCollection } = context;
  const initializeStorageFileGroupInTransaction = initializeStorageFileGroupInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(initializeAllApplicableStorageFileGroupsParamsType, async () => {
    return async () => {
      let storageFileGroupsVisited: number = 0;
      let storageFileGroupsSucceeded: number = 0;
      let storageFileGroupsFailed: number = 0;
      let storageFileGroupsAlreadyInitialized: number = 0;

      const initializeStorageFileGroupParams: InitializeStorageFileModelParams = { key: firestoreDummyKey(), throwErrorIfAlreadyInitialized: false };

      async function initializeStorageFileGroups() {
        const query = storageFileGroupCollection.queryDocument(storageFileGroupsFlaggedForNeedsInitializationQuery());
        const storageFileGroupDocuments = await query.getDocs();

        return performAsyncTasks(
          storageFileGroupDocuments,
          async (storageFileGroupDocument) => {
            return firestoreContext.runTransaction((transaction) => initializeStorageFileGroupInTransaction(initializeStorageFileGroupParams, storageFileGroupDocument, transaction));
          },
          {
            maxParallelTasks: 5
          }
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- intentional infinite loop with break
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
