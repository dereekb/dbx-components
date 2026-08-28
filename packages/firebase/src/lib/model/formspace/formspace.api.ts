import { type, type Type } from 'arktype';
import { clearable } from '@dereekb/model';
import { type Maybe, type Milliseconds } from '@dereekb/util';
import { type FirestoreModelKey, type OnCallCreateModelResult, type TargetModelParams } from '../../common';
import { firestoreModelKeyType } from '../../common/model/model/model.validator';
import { targetModelParamsType } from '../../common/model/model/model.param';
import { callModelFirebaseFunctionMapFactory, type FirebaseFunctionTypeConfigMap, type ModelFirebaseCreateFunction, type ModelFirebaseCrudFunction, type ModelFirebaseCrudFunctionConfigMap, type ModelFirebaseFunctionMap } from '../../client';
import { type StorageFileId } from '../storagefile/storagefile.id';
import { type FormSpaceData, type FormSpaceTypes } from './formspace';
import { type FormSpaceFileSlot, type FormSpaceType } from './formspace.id';

/**
 * @module formspace.api
 *
 * ARKTYPE PARAM/RESULT TYPES plus the callable CRUD map for the FormSpace model.
 *
 * Unlike Calendar — which is driven entirely internally — a FormSpace is a CLIENT-FACING container: the
 * user creates it, edits it, and submits it, so every one of those is a callable.
 */

// MARK: Create
/**
 * Parameters for creating a FormSpace.
 *
 * @dbxModelApiParams
 */
export interface CreateFormSpaceParams<T extends FormSpaceData = FormSpaceData> {
  /**
   * The registered {@link FormSpaceType} to create. Creation of an unregistered type is rejected.
   */
  readonly formSpaceType: FormSpaceType;
  /**
   * Display name for the space.
   */
  readonly displayName?: Maybe<string>;
  /**
   * The model this space is being opened against, if any.
   */
  readonly targetModelKey?: Maybe<FirestoreModelKey>;
  /**
   * Initial form data.
   */
  readonly data?: Maybe<T>;
}

export const createFormSpaceParamsType = /* @__PURE__ */ type({
  formSpaceType: 'string > 0',
  'displayName?': clearable('string'),
  'targetModelKey?': clearable(firestoreModelKeyType),
  'data?': clearable('object')
}) as Type<CreateFormSpaceParams>;

// MARK: Update
/**
 * Parameters for updating a draft FormSpace's content.
 *
 * `data` REPLACES the stored JSON rather than merging into it. The client owns the whole form; a merge
 * would make clearing a field impossible to express.
 *
 * @dbxModelApiParams
 */
export interface UpdateFormSpaceParams<T extends FormSpaceData = FormSpaceData> extends TargetModelParams {
  readonly displayName?: Maybe<string>;
  readonly data?: Maybe<T>;
}

export const updateFormSpaceParamsType = targetModelParamsType.merge({
  'displayName?': clearable('string'),
  'data?': clearable('object')
}) as Type<UpdateFormSpaceParams>;

/**
 * Parameters for submitting a FormSpace.
 *
 * @dbxModelApiParams
 */
export interface SubmitFormSpaceParams extends TargetModelParams {
  /**
   * Whether to run the submission's processing task immediately rather than waiting for the queue.
   */
  readonly runImmediately?: Maybe<boolean>;
}

export const submitFormSpaceParamsType = targetModelParamsType.merge({
  'runImmediately?': clearable('boolean')
}) as Type<SubmitFormSpaceParams>;

/**
 * Result of submitting a FormSpace.
 */
export interface SubmitFormSpaceResult {
  /**
   * The key of the NotificationTask processing the submission.
   */
  readonly processingNotificationKey: string;
  /**
   * True if the processing task was newly created by this call.
   */
  readonly processingTaskCreated: boolean;
}

// MARK: Remove File
/**
 * Parameters for removing one uploaded file from a FormSpace slot.
 *
 * The file is dropped from the space's `f` array and its StorageFile is FLAGGED for deletion, never deleted
 * inline — the StorageFile delete sweep owns removing the object, and a second code path that removed it
 * here is how an orphaned object gets left behind.
 *
 * @dbxModelApiParams
 */
export interface RemoveFormSpaceFileParams extends TargetModelParams {
  /**
   * The slot holding the file.
   */
  readonly slot: FormSpaceFileSlot;
  /**
   * The StorageFile to remove.
   *
   * Optional only when the slot holds exactly one file: a folder slot with several files has no unambiguous
   * "the" file, so omitting it there is an error rather than a guess.
   */
  readonly storageFileId?: Maybe<StorageFileId>;
}

export const removeFormSpaceFileParamsType = targetModelParamsType.merge({
  slot: 'string > 0',
  'storageFileId?': clearable('string > 0')
}) as Type<RemoveFormSpaceFileParams>;

// MARK: Delete
/**
 * Parameters for deleting a FormSpace and flagging its uploaded files for deletion.
 *
 * @dbxModelApiParams
 */
export interface DeleteFormSpaceParams extends TargetModelParams {}

export const deleteFormSpaceParamsType = targetModelParamsType as Type<DeleteFormSpaceParams>;

// MARK: Sweeps
/**
 * Parameters for the backstop sweep over FormSpaces stuck in QUEUED_FOR_PROCESSING.
 */
export interface ProcessAllQueuedFormSpacesParams {
  /**
   * Maximum number of spaces to visit. Defaults to unbounded.
   */
  readonly limit?: Maybe<number>;
}

export const processAllQueuedFormSpacesParamsType = /* @__PURE__ */ type({
  'limit?': clearable('number > 0')
}) as Type<ProcessAllQueuedFormSpacesParams>;

/**
 * Result of the backstop processing sweep.
 */
export interface ProcessAllQueuedFormSpacesResult {
  readonly formSpacesVisited: number;
  readonly formSpacesProcessStarted: number;
  readonly formSpacesFailedStarting: number;
}

/**
 * Parameters for the expiration sweep.
 */
export interface ExpireAllExpiredFormSpacesParams {
  /**
   * Spaces whose `eat` is at or before this instant are expired. Defaults to now.
   */
  readonly before?: Maybe<Date>;
  /**
   * Spaces expired per page.
   */
  readonly pageSize?: Maybe<number>;
  /**
   * Hard wall-clock budget for the whole sweep.
   */
  readonly maxRunTimeMs?: Maybe<Milliseconds>;
  /**
   * Maximum number of pages. Defaults to unlimited, bounded by the time budget.
   */
  readonly maxPages?: Maybe<number>;
}

export const expireAllExpiredFormSpacesParamsType = /* @__PURE__ */ type({
  'before?': clearable('Date'),
  'pageSize?': clearable('number > 0'),
  'maxRunTimeMs?': clearable('number > 0'),
  'maxPages?': clearable('number > 0')
}) as Type<ExpireAllExpiredFormSpacesParams>;

/**
 * Result of the expiration sweep.
 */
export interface ExpireAllExpiredFormSpacesResult {
  readonly formSpacesExpired: number;
  readonly storageFilesFlaggedForDelete: number;
  readonly pages: number;
  /**
   * Whether the sweep stopped because its time budget ran out rather than because nothing was left.
   */
  readonly stoppedForTimeBudget: boolean;
  readonly durationMs: Milliseconds;
}

// MARK: Functions
/**
 * Custom (non-CRUD) function type map for FormSpace. Currently empty — all operations use CRUD functions.
 */
export type FormSpaceFunctionTypeMap = {};

export const FORM_SPACE_FUNCTION_TYPE_CONFIG_MAP: FirebaseFunctionTypeConfigMap<FormSpaceFunctionTypeMap> = {};

/**
 * CRUD function configuration map for the FormSpace model family.
 */
export type FormSpaceModelCrudFunctionsConfig = {
  readonly formSpace: {
    create: {
      _: CreateFormSpaceParams;
    };
    update: {
      _: UpdateFormSpaceParams;
      submit: [SubmitFormSpaceParams, SubmitFormSpaceResult];
      removeFile: RemoveFormSpaceFileParams;
    };
    delete: {
      _: DeleteFormSpaceParams;
    };
  };
};

export const FORM_SPACE_MODEL_CRUD_FUNCTIONS_CONFIG: ModelFirebaseCrudFunctionConfigMap<FormSpaceModelCrudFunctionsConfig, FormSpaceTypes> = {
  formSpace: ['create:_', 'update:_,submit,removeFile' as any, 'delete:_']
};

/**
 * Abstract class defining all callable FormSpace cloud functions.
 *
 * Implement this in your app module to wire up the function endpoints.
 * Use {@link formSpaceFunctionMap} to create a client-side callable map.
 */
export abstract class FormSpaceFunctions implements ModelFirebaseFunctionMap<FormSpaceFunctionTypeMap, FormSpaceModelCrudFunctionsConfig> {
  abstract formSpace: {
    createFormSpace: {
      create: ModelFirebaseCreateFunction<CreateFormSpaceParams, OnCallCreateModelResult>;
    };
    updateFormSpace: {
      update: ModelFirebaseCrudFunction<UpdateFormSpaceParams>;
      submit: ModelFirebaseCrudFunction<SubmitFormSpaceParams, SubmitFormSpaceResult>;
      removeFile: ModelFirebaseCrudFunction<RemoveFormSpaceFileParams>;
    };
    deleteFormSpace: {
      delete: ModelFirebaseCrudFunction<DeleteFormSpaceParams>;
    };
  };
}

/**
 * Client-side callable function map factory for all FormSpace CRUD operations.
 *
 * @example
 * ```ts
 * const functions = formSpaceFunctionMap(callableFactory);
 * const result = await functions.formSpace.createFormSpace.create({ formSpaceType: 'demo_example' });
 * ```
 */
export const formSpaceFunctionMap = callModelFirebaseFunctionMapFactory(FORM_SPACE_FUNCTION_TYPE_CONFIG_MAP, FORM_SPACE_MODEL_CRUD_FUNCTIONS_CONFIG);
