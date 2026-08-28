import {
  type AppFormSpaceTypeConfigService,
  FORM_SPACE_PURPOSE,
  FORM_SPACE_PURPOSE_REGISTER_SUBTASK,
  FORM_SPACE_PURPOSE_VALIDATE_SUBTASK,
  type FormSpace,
  type FormSpaceDocument,
  type FormSpaceFile,
  type FormSpaceFileSlot,
  type FormSpaceFileSlotConfig,
  formSpaceFileSlotConfig,
  formSpaceFilesInSlot,
  formSpaceSlotMaxFiles,
  type FormSpaceFileValidationFailureReason,
  type FormSpaceFileValidationStorageFileMetadata,
  type FormSpaceFileValidationSubtask,
  type FormSpaceFileValidationSubtaskMetadata,
  FormSpaceFileValidationState,
  type FormSpaceFirestoreCollections,
  type FormSpaceType,
  type StorageFileDocument,
  storageFileDisplayFileName,
  type StorageFileFirestoreCollections,
  type StorageFileMetadata,
  type StoredFileReader,
  StorageFileProcessingState,
  delayCompletion,
  inferStorageFileGroupRelatedModelKey
} from '@dereekb/firebase';
import { filterUndefinedValues, type Getter, type Maybe, type Milliseconds, MS_IN_MINUTE, type SlashPathFile } from '@dereekb/util';
import { type NotificationTaskSubtaskResult } from '../notification/notification.task.subtask.handler';
import { type StorageFileProcessingPurposeSubtaskCleanupOutput, type StorageFileProcessingPurposeSubtaskProcessorConfigWithTarget } from '../storagefile/storagefile.task.service.handler';
import { markStorageFileForDeleteTemplate } from '../storagefile/storagefile.util';

/**
 * @module formspace.validation
 *
 * SERVER-ONLY registration of what a FormSpace slot's uploaded file must actually contain.
 *
 * The split mirrors the one the type registry already uses. Pure data — which mime types, how large, how
 * many, whether validation is required at all — lives in `@dereekb/firebase` so the client pre-checks with
 * the same rules the server enforces. The CHECK itself is a function, so it lives here: a validator may read
 * the file's bytes, call out to a model, or consult another collection, none of which belongs in a bundle
 * shipped to a browser.
 *
 * Registration is keyed by `(FormSpaceType, slot)` and consumed by one processor targeting the single
 * `form_space` StorageFilePurpose, because the subtask framework dispatches on one target and that target is
 * already spent on the purpose.
 */

/**
 * How long a `pending` verdict waits before the validator is asked again, when it names no delay itself.
 */
export const DEFAULT_FORM_SPACE_FILE_VALIDATION_RETRY_DELAY: Milliseconds = MS_IN_MINUTE;

/**
 * How many times a validator may answer `pending` before the file is failed.
 *
 * Bounds a validator whose external dependency never resolves. A validator that legitimately needs longer
 * should return a longer `retryIn` rather than more attempts.
 */
export const DEFAULT_FORM_SPACE_FILE_VALIDATION_MAX_ATTEMPTS = 10;

/**
 * What a {@link FormSpaceFileValidator} is handed.
 */
export interface FormSpaceFileValidatorInput {
  /**
   * The FormSpace the file was uploaded into.
   */
  readonly formSpaceDocument: FormSpaceDocument;
  /**
   * Loads the FormSpace, memoized for the duration of one task run.
   */
  readonly loadFormSpace: Getter<Promise<FormSpace>>;
  /**
   * The StorageFile holding the bytes.
   */
  readonly storageFileDocument: StorageFileDocument;
  /**
   * Reads the stored file's bytes, stream, and metadata.
   */
  readonly fileDetailsAccessor: StoredFileReader;
  /**
   * The entry on the FormSpace this validation is for.
   */
  readonly formSpaceFile: FormSpaceFile;
  /**
   * The slot the file fills.
   */
  readonly slot: FormSpaceFileSlot;
  /**
   * The slot's configuration, when its type declares one.
   */
  readonly slotConfig: Maybe<FormSpaceFileSlotConfig>;
  /**
   * How many times the validator has already been asked about this file, starting at 0.
   */
  readonly attempt: number;
}

/**
 * A validator's answer about one file.
 *
 * `pending` is the third outcome rather than an error: a validator waiting on something external has not
 * failed, and reporting it as a failure would consume the file's retry budget on a check still in flight.
 */
export type FormSpaceFileValidationVerdict = 'valid' | 'invalid' | 'pending';

/**
 * The result of validating one file.
 */
export interface FormSpaceFileValidationResult {
  readonly verdict: FormSpaceFileValidationVerdict;
  /**
   * Why the file was judged invalid, written for the OWNER to read and act on.
   *
   * Free text rather than a code because a content rejection cannot be enumerated in advance — "the document
   * expired in 2019" and "this is a photo of a receipt" are both correct answers from the same validator.
   */
  readonly reason?: Maybe<string>;
  /**
   * How long to wait before asking again. `pending` only; defaults to
   * {@link DEFAULT_FORM_SPACE_FILE_VALIDATION_RETRY_DELAY}.
   */
  readonly retryIn?: Maybe<Milliseconds>;
  /**
   * Metadata to write onto the StorageFile's `d`, REPLACING the default verdict metadata.
   */
  readonly metadata?: Maybe<StorageFileMetadata>;
}

/**
 * Decides whether one uploaded file satisfies one FormSpace slot.
 */
export type FormSpaceFileValidator = (input: FormSpaceFileValidatorInput) => Promise<FormSpaceFileValidationResult>;

/**
 * Registers a {@link FormSpaceFileValidator} for one {@link FormSpaceType}.
 */
export interface FormSpaceFileValidatorConfig {
  /**
   * The type this validator applies to.
   */
  readonly formSpaceType: FormSpaceType;
  /**
   * The slot this validator applies to. When absent it applies to every slot of the type that does not
   * declare a validator of its own.
   */
  readonly slot?: Maybe<FormSpaceFileSlot>;
  /**
   * The check.
   */
  readonly validate: FormSpaceFileValidator;
}

/**
 * Input for the validate subtask's `settle` step: everything one concluded check has to record.
 */
interface SettleFormSpaceFileValidationInput {
  /**
   * The space to write the entry change onto. Absent when the file no longer belongs to one.
   */
  readonly formSpaceDocument?: Maybe<FormSpaceDocument>;
  /**
   * What to write onto the file's entry. Absent when there is nothing to tell the owner.
   */
  readonly changes?: Maybe<Pick<FormSpaceFile, 'v' | 'r' | 'fr'>>;
  /**
   * Whether the check judged the file's content acceptable.
   */
  readonly verdictValid: boolean;
  /**
   * Why no content verdict was reached, when none was.
   */
  readonly failureReason?: Maybe<FormSpaceFileValidationFailureReason>;
  /**
   * Metadata to write onto the StorageFile's `d`.
   */
  readonly metadata?: Maybe<StorageFileMetadata>;
}

/**
 * Configuration for {@link formSpaceFileValidationStorageFileProcessor}.
 */
export interface FormSpaceFileValidationStorageFileProcessorConfig {
  readonly formSpaceFirestoreCollections: FormSpaceFirestoreCollections;
  /**
   * Accessor for the StorageFile collection, used to flag a file the register step supersedes.
   */
  readonly storageFileFirestoreCollections: StorageFileFirestoreCollections;
  /**
   * The registry the processor resolves each file's slot rules from.
   */
  readonly appFormSpaceTypeConfigService: AppFormSpaceTypeConfigService;
  /**
   * The registered validators.
   */
  readonly validators: FormSpaceFileValidatorConfig[];
  /**
   * How many `pending` verdicts a file may collect before it is failed. Defaults to
   * {@link DEFAULT_FORM_SPACE_FILE_VALIDATION_MAX_ATTEMPTS}.
   */
  readonly maxAttempts?: Maybe<number>;
  /**
   * When true, asserts at wiring time that every slot declaring `validationRequired` in
   * `appFormSpaceTypeConfigService` has a validator registered here.
   *
   * On by default. A slot that asks for validation and gets none would otherwise pass every file silently,
   * which is the one failure mode a validator exists to prevent.
   */
  readonly validateCoverage?: Maybe<boolean>;
}

/**
 * Builds the `form_space` purpose's subtask processor: the thing that actually runs a slot's validator.
 *
 * ONE processor covers every form type and every slot, the same way one upload initializer does — the
 * per-slot rules come from the registry keyed off the loaded space, not from the processor's registration.
 *
 * The verdict is written to BOTH the FormSpace's `f` entry and the StorageFile. The FormSpace copy is the
 * one that matters: the owner can read their own space (and list it), but cannot list StorageFiles, so a
 * verdict that never reaches `f` is a verdict the user never sees.
 *
 * @param config - The FormSpace collection, type registry, and registered validators.
 * @returns The processor config, for the `processors` array of the storage-file processing handler.
 *
 * @example
 * ```ts
 * const processors = [
 *   formSpaceFileValidationStorageFileProcessor({
 *     formSpaceFirestoreCollections: context,
 *     storageFileFirestoreCollections: context,
 *     appFormSpaceTypeConfigService: appFormSpaceTypeConfigService(formSpaceTypeConfigRecord(APP_FORM_SPACE_TYPE_CONFIGS)),
 *     validators: [MY_RESUME_VALIDATOR]
 *   })
 * ];
 * ```
 */
export function formSpaceFileValidationStorageFileProcessor(config: FormSpaceFileValidationStorageFileProcessorConfig): StorageFileProcessingPurposeSubtaskProcessorConfigWithTarget<FormSpaceFileValidationSubtaskMetadata, FormSpaceFileValidationSubtask> {
  const { formSpaceFirestoreCollections, storageFileFirestoreCollections, appFormSpaceTypeConfigService, validators, validateCoverage } = config;
  const storageFileDocumentAccessor = storageFileFirestoreCollections.storageFileCollection.documentAccessor();
  const maxAttempts = config.maxAttempts ?? DEFAULT_FORM_SPACE_FILE_VALIDATION_MAX_ATTEMPTS;

  const validatorMap = new Map<string, FormSpaceFileValidator>();

  validators.forEach((x) => {
    const key = _formSpaceValidatorKey(x.formSpaceType, x.slot);

    if (validatorMap.has(key)) {
      throw new Error(`formSpaceFileValidationStorageFileProcessor(): duplicate validator registered for "${key}".`);
    }

    validatorMap.set(key, x.validate);
  });

  if (validateCoverage !== false) {
    _assertFormSpaceValidatorCoverage(appFormSpaceTypeConfigService, validatorMap);
  }

  /**
   * Returns the validator registered for a slot, preferring a slot-specific one over the type-wide one.
   *
   * @param formSpaceType - The type the file's space is.
   * @param slot - The slot the file fills.
   * @returns The validator to run, or null when the slot has none.
   */
  function validatorFor(formSpaceType: FormSpaceType, slot: FormSpaceFileSlot): Maybe<FormSpaceFileValidator> {
    return validatorMap.get(_formSpaceValidatorKey(formSpaceType, slot)) ?? validatorMap.get(_formSpaceValidatorKey(formSpaceType, null));
  }

  return {
    target: FORM_SPACE_PURPOSE,
    // register and validate run in the SAME pass. That is what makes an expedited upload — the client
    // calling `storageFile.create:fromUpload` with `expediteProcessing`, or the uploads sweep with the same
    // flag — come back with a verdict immediately instead of over consecutive scheduling ticks.
    allowRunMultipleParts: true,
    cleanup: (input): StorageFileProcessingPurposeSubtaskCleanupOutput => {
      // The flow already wrote the verdict; cleanup can only see the persisted metadata, which is why the
      // subtask records it there as well.
      //
      // `ps` answers "did processing do its job", NOT "is the file good". A slot with no validator and a
      // file that was superseded mid-check both processed fine and are SUCCESS; only a content rejection or
      // a check that could not run are FAILED, which is what makes a FAILED file worth re-queueing.
      const { valid, failureReason } = input.subtaskData ?? {};
      const settled = valid === true || failureReason === 'no_validator' || failureReason === 'replaced';

      return {
        cleanupSuccess: true,
        nextProcessingState: settled ? StorageFileProcessingState.SUCCESS : StorageFileProcessingState.FAILED,
        queueForDelete: false // an invalid file is kept, flagged, and left for the owner to remove or replace
      };
    },
    flow: [
      {
        subtask: FORM_SPACE_PURPOSE_REGISTER_SUBTASK,
        fn: async (input) => {
          const { storageFileDocument } = input;
          const storageFile = await input.loadStorageFile();
          const slot = storageFile.pg as Maybe<FormSpaceFileSlot>;

          const formSpaceDocument = _formSpaceDocumentForStorageFile(formSpaceFirestoreCollections, storageFile.g[0]);
          const formSpace = formSpaceDocument == null ? undefined : await formSpaceDocument.snapshotData();

          let reconciled = false;

          // A file already flagged for delete is one the owner removed or a newer upload superseded. Adding
          // it back is the one thing this step must never do — the whole point of removing a file is that it
          // stops counting toward the slot.
          const removed = storageFile.sdat != null;

          if (slot != null && formSpace != null && formSpaceDocument != null && !removed) {
            const alreadyRegistered = formSpace.f.some((x) => x.sf === storageFileDocument.id);

            if (!alreadyRegistered) {
              const config = appFormSpaceTypeConfigService.configForFormSpaceType(formSpace.t);
              const slotConfig = formSpaceFileSlotConfig(config, slot);
              const maxFiles = formSpaceSlotMaxFiles(slotConfig);
              const filesInSlot = formSpaceFilesInSlot(formSpace, slot);

              // a POSITION slot supersedes; a FOLDER with room accumulates. A FOLDER with no room is left
              // alone: the file exists but the slot is full, and the validate step then reports it as
              // 'replaced' rather than this step evicting a file the owner chose to keep.
              if (maxFiles === 1 || filesInSlot.length < maxFiles) {
                const supersededIds = new Set(maxFiles === 1 ? filesInSlot.map((x) => x.sf) : []);

                const entry: FormSpaceFile = {
                  sl: slot,
                  sf: storageFileDocument.id,
                  // recomposed from the StorageFile's own display name, NOT the object's leaf: the
                  // destination is keyed by index (`.../{index}.{ext}`), so the leaf would reconcile the
                  // entry as `0.pdf` instead of the name its uploader gave it
                  n: (storageFileDisplayFileName({ displayName: storageFile.n, pathString: storageFile.pathString }) ?? storageFileDocument.id) as SlashPathFile,
                  v: slotConfig?.validationRequired === true ? FormSpaceFileValidationState.PENDING : FormSpaceFileValidationState.NONE,
                  at: storageFile.cat
                };

                await formSpaceDocument.update({
                  f: [...formSpace.f.filter((x) => !supersededIds.has(x.sf)), entry],
                  uat: new Date()
                });

                // a superseded entry dropped from `f` without its StorageFile being flagged would leave a
                // live object nothing points at, which the delete sweep would never collect
                await Promise.all(Array.from(supersededIds).map((x) => storageFileDocumentAccessor.loadDocumentForId(x).update(markStorageFileForDeleteTemplate())));

                reconciled = true;
              }
            }
          }

          return {
            completion: FORM_SPACE_PURPOSE_REGISTER_SUBTASK,
            canRunNextCheckpoint: true, // validate in the same run, so a reconciled file is not left PENDING until the next sweep
            updateMetadata: { slot, reconciled }
          } as NotificationTaskSubtaskResult<FormSpaceFileValidationSubtaskMetadata, FormSpaceFileValidationSubtask>;
        }
      },
      {
        subtask: FORM_SPACE_PURPOSE_VALIDATE_SUBTASK,
        fn: async (input) => {
          const { storageFileDocument, fileDetailsAccessor } = input;
          const storageFile = await input.loadStorageFile();
          const slot = storageFile.pg as Maybe<FormSpaceFileSlot>;
          const attempts = input.subtaskData?.attempts ?? 0;

          let result: NotificationTaskSubtaskResult<FormSpaceFileValidationSubtaskMetadata, FormSpaceFileValidationSubtask>;

          /**
           * Records the outcome and completes the subtask.
           *
           * `changes` is what to write onto the file's FormSpace entry, and is OMITTED when there is nothing
           * to say to the owner — a slot that never asked for validation should not carry a `no_validator`
           * reason on every file it holds.
           *
           * The entry is re-read before it is written: the file may have been superseded or removed while
           * the check was in flight, and writing this verdict would resurrect one the owner already replaced.
           *
           * @param settleInput - The space to write to, the entry changes, the recorded outcome, and any
           *   metadata for the StorageFile.
           * @returns The completed subtask result.
           */
          async function settle(settleInput: SettleFormSpaceFileValidationInput) {
            const { formSpaceDocument, changes, verdictValid, failureReason, metadata } = settleInput;
            const vat = new Date();

            if (formSpaceDocument != null && changes != null) {
              const formSpace = await formSpaceDocument.snapshotData();
              const stillPresent = formSpace?.f.some((x) => x.sf === storageFileDocument.id) === true;

              if (stillPresent && formSpace != null) {
                await formSpaceDocument.update({
                  f: formSpace.f.map((x) => (x.sf === storageFileDocument.id ? { ...x, ...changes, vat } : x))
                });
              }
            }

            if (metadata != null) {
              // `d` is a pass-through field, so an undefined property reaches Firestore verbatim and is
              // rejected outright — which would abort the whole subtask AFTER the verdict was written to the
              // FormSpace, leaving the checkpoint unrecorded and the task looping.
              await storageFileDocument.update({ d: filterUndefinedValues(metadata) });
            }

            return {
              completion: FORM_SPACE_PURPOSE_VALIDATE_SUBTASK,
              // updateMetadata REPLACES rather than merges, so the register step's own record is carried
              // forward explicitly. Dropping it would lose the one signal that a file had to be reconciled.
              updateMetadata: {
                ...input.subtaskData,
                slot,
                attempts: attempts + 1,
                valid: verdictValid,
                reason: changes?.r ?? null,
                failureReason: failureReason ?? null
              }
            } as NotificationTaskSubtaskResult<FormSpaceFileValidationSubtaskMetadata, FormSpaceFileValidationSubtask>;
          }

          const formSpaceDocument = _formSpaceDocumentForStorageFile(formSpaceFirestoreCollections, storageFile.g[0]);
          const formSpace = formSpaceDocument == null ? undefined : await formSpaceDocument.snapshotData();
          const formSpaceFile = formSpace?.f.find((x) => x.sf === storageFileDocument.id);

          if (slot == null || formSpace == null || formSpaceFile == null) {
            // the space is gone, or this file is no longer one of its files. Either way there is nothing to
            // write a verdict onto, and a retry would find the same thing.
            result = await settle({ verdictValid: false, failureReason: 'replaced' });
          } else {
            const typeConfig = appFormSpaceTypeConfigService.configForFormSpaceType(formSpace.t);
            const slotConfig = formSpaceFileSlotConfig(typeConfig, slot);
            const validate = validatorFor(formSpace.t, slot);

            if (validate == null) {
              // A slot that never asked for validation is the common case, and stamping a reason onto every
              // one of its files would be noise. The entry is only corrected when something left it PENDING.
              const changes = formSpaceFile.v === FormSpaceFileValidationState.PENDING ? { v: FormSpaceFileValidationState.NONE, r: null, fr: 'no_validator' as const } : null;

              result = await settle({ formSpaceDocument, changes, verdictValid: false, failureReason: 'no_validator' });
            } else {
              let validation: Maybe<FormSpaceFileValidationResult>;
              let failed = false;

              try {
                validation = await validate({
                  formSpaceDocument: formSpaceDocument as FormSpaceDocument,
                  loadFormSpace: async () => formSpace,
                  storageFileDocument,
                  fileDetailsAccessor,
                  formSpaceFile,
                  slot,
                  slotConfig,
                  attempt: attempts
                });
              } catch (e) {
                console.error(`formSpaceFileValidationStorageFileProcessor(): validator for FormSpaceType "${formSpace.t}" slot "${slot}" threw for StorageFile "${storageFileDocument.id}": `, e);
                failed = true;
              }

              if (failed) {
                result = await settle({ formSpaceDocument, changes: { v: FormSpaceFileValidationState.INVALID, r: null, fr: 'error' }, verdictValid: false, failureReason: 'error' });
              } else if (validation?.verdict === 'pending' && attempts + 1 < maxAttempts) {
                // still in flight. Neither a verdict nor a failure — come back later, without touching the
                // entry, so the owner keeps seeing PENDING rather than a flicker through some other state.
                result = {
                  completion: delayCompletion(),
                  delayUntil: validation.retryIn ?? DEFAULT_FORM_SPACE_FILE_VALIDATION_RETRY_DELAY,
                  updateMetadata: { ...input.subtaskData, slot, attempts: attempts + 1 }
                };
              } else if (validation?.verdict === 'pending') {
                // the attempt budget is spent on a check that never concluded
                result = await settle({ formSpaceDocument, changes: { v: FormSpaceFileValidationState.INVALID, r: null, fr: 'error' }, verdictValid: false, failureReason: 'error' });
              } else {
                const valid = validation?.verdict === 'valid';

                const defaultMetadata: FormSpaceFileValidationStorageFileMetadata = {
                  valid,
                  reason: validation?.reason ?? null,
                  checkedAt: new Date()
                };

                result = await settle({ formSpaceDocument, changes: { v: valid ? FormSpaceFileValidationState.VALID : FormSpaceFileValidationState.INVALID, r: valid ? null : (validation?.reason ?? null), fr: null }, verdictValid: valid, metadata: validation?.metadata ?? defaultMetadata });
              }
            }
          }

          return result;
        }
      }
    ]
  };
}

/**
 * Resolves the FormSpace a `form_space` StorageFile belongs to, from the StorageFileGroup it was filed into.
 *
 * The group id is the FormSpace's own model key, flat-encoded, so no extra field on the StorageFile is
 * needed to get back to the space.
 *
 * @param formSpaceFirestoreCollections - Accessor for the FormSpace collection.
 * @param storageFileGroupId - The group id carried on the StorageFile.
 * @returns The FormSpace document, or null when the file names no group.
 */
function _formSpaceDocumentForStorageFile(formSpaceFirestoreCollections: FormSpaceFirestoreCollections, storageFileGroupId: Maybe<string>): Maybe<FormSpaceDocument> {
  return storageFileGroupId == null ? undefined : formSpaceFirestoreCollections.formSpaceCollection.documentAccessor().loadDocumentForKey(inferStorageFileGroupRelatedModelKey(storageFileGroupId));
}

/**
 * Builds the map key a validator is registered under. A null slot is the type-wide entry.
 *
 * @param formSpaceType - The type the validator is registered for.
 * @param slot - The slot it narrows to, or null for the type-wide entry.
 * @returns The map key.
 */
function _formSpaceValidatorKey(formSpaceType: FormSpaceType, slot: Maybe<FormSpaceFileSlot>): string {
  return `${formSpaceType}:${slot ?? ''}`;
}

/**
 * Throws unless every slot that declares `validationRequired` has a validator registered for it.
 *
 * Runs at WIRING time, so a type that asks for validation and never got a validator fails the app's boot
 * rather than silently accepting every file — the exact outcome a validator was added to prevent.
 *
 * @param appFormSpaceTypeConfigService - The registry to read the declared slots from.
 * @param validatorMap - The registered validators, keyed by {@link _formSpaceValidatorKey}.
 * @throws {Error} When a slot declaring `validationRequired` has no validator registered.
 */
function _assertFormSpaceValidatorCoverage(appFormSpaceTypeConfigService: AppFormSpaceTypeConfigService, validatorMap: Map<string, unknown>): void {
  const missing: string[] = [];

  appFormSpaceTypeConfigService.getAllKnownFormSpaceTypeConfigs().forEach((typeConfig) => {
    (typeConfig.slots ?? []).forEach((slotConfig) => {
      if (slotConfig.validationRequired === true) {
        const key = _formSpaceValidatorKey(typeConfig.formSpaceType, slotConfig.slot);

        if (!validatorMap.has(key) && !validatorMap.has(_formSpaceValidatorKey(typeConfig.formSpaceType, null))) {
          missing.push(key);
        }
      }
    });
  });

  if (missing.length > 0) {
    throw new Error(`formSpaceFileValidationStorageFileProcessor(): no validator registered for slot(s) that require validation: ${missing.join(', ')}.`);
  }
}
