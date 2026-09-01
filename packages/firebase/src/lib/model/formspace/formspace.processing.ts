import { type Maybe } from '@dereekb/util';
import { type StorageFileMetadata } from '../storagefile/storagefile.id';
import { type StorageFileProcessingSubtask, type StorageFileProcessingSubtaskMetadata } from '../storagefile/storagefile.task';
import { type FormSpaceFileValidationFailureReason } from './formspace';
import { type FormSpaceFileSlot } from './formspace.id';

/**
 * @module formspace.processing
 *
 * The subtask vocabulary and StorageFile metadata for validating a file uploaded into a FormSpace.
 *
 * FormSpace validation rides the EXISTING `SFP` storage-file processing task rather than a task type of its
 * own: a validated attachment is a StorageFile being processed, and the retry, stuck-detection, delay, and
 * cleanup behaviour it inherits is the whole reason the purpose-processor mechanism exists. The processor
 * that consumes these lives server-side, in `@dereekb/firebase-server/model`.
 */

/**
 * The first checkpoint: make sure the FormSpace knows this file exists.
 *
 * The upload initializer already writes the entry, in the same transaction that increments `uc` — that is
 * what makes `maxFiles` enforceable and what gives the owner an entry the moment the upload is accepted.
 * This step RECONCILES: it re-adds an entry for a StorageFile that carries this purpose but is missing from
 * its space, which is the case for a file created by any path other than that initializer.
 *
 * It runs before validation so a reconciled file is validated in the same task rather than waiting for the
 * next sweep to notice it.
 */
export const FORM_SPACE_PURPOSE_REGISTER_SUBTASK: StorageFileProcessingSubtask = 'register';

/**
 * The second checkpoint: run the slot's registered validator.
 *
 * One checkpoint rather than a `send`/`retrieve` pair like the resume check: a validator that needs to wait
 * on something returns a `pending` verdict with a retry delay, which re-enters this same checkpoint. A
 * second checkpoint would only add a state the validator cannot see.
 */
export const FORM_SPACE_PURPOSE_VALIDATE_SUBTASK: StorageFileProcessingSubtask = 'validate';

/**
 * Type alias for the FormSpace file processing checkpoints.
 */
export type FormSpaceFileValidationSubtask = typeof FORM_SPACE_PURPOSE_REGISTER_SUBTASK | typeof FORM_SPACE_PURPOSE_VALIDATE_SUBTASK;

/**
 * Metadata carried between runs of the FormSpace file validation subtask.
 *
 * The verdict is recorded here as well as on the FormSpace because the cleanup step — which is what writes
 * the StorageFile's final processing state — runs after the flow and can only see the persisted metadata.
 */
export interface FormSpaceFileValidationSubtaskMetadata extends StorageFileProcessingSubtaskMetadata {
  /**
   * The slot the file fills, copied from the StorageFile on the first run.
   */
  readonly slot?: Maybe<FormSpaceFileSlot>;
  /**
   * Whether the concluded verdict judged the file valid.
   */
  readonly valid?: Maybe<boolean>;
  /**
   * Free-text reason the file was judged invalid.
   */
  readonly reason?: Maybe<string>;
  /**
   * Reason no content verdict was reached.
   */
  readonly failureReason?: Maybe<FormSpaceFileValidationFailureReason>;
  /**
   * How many times the validator has been asked for a verdict.
   */
  readonly attempts?: Maybe<number>;
  /**
   * Whether the register step had to add the file back to its FormSpace.
   *
   * Normally false — the upload initializer already registered it. A true here means the file reached
   * processing without its space knowing about it, which is worth being able to see after the fact.
   */
  readonly reconciled?: Maybe<boolean>;
}

/**
 * Metadata written onto a validated FormSpace file's StorageFile.
 *
 * Mirrors what lands on the FormSpace, so a StorageFile inspected on its own still explains itself. A
 * validator that wants to record more (extracted dates, a page count) returns its own metadata, which
 * REPLACES this rather than merging — the validator owns the shape it needs downstream.
 */
export interface FormSpaceFileValidationStorageFileMetadata extends StorageFileMetadata {
  readonly valid: boolean;
  readonly reason?: Maybe<string>;
  readonly checkedAt: Date;
}
