import { type ContentTypeMimeType, type Maybe } from '@dereekb/util';
import { type FirebaseAuthOwnershipKey, type FirebaseAuthUserId } from '../../common/auth/auth';
import { type FirestoreModelKey } from '../../common/firestore/collection/collection';
import { type StorageFileGroupId, storageFileGroupIdForModel } from '../storagefile/storagefile.id';
import { type FormSpace, type FormSpaceData, type FormSpaceFile, FormSpaceFileValidationState, FormSpaceProcessingState, FormSpaceState } from './formspace';
import { type FormSpaceFileSlot, type FormSpaceKey, type FormSpaceType } from './formspace.id';
import { DEFAULT_FORM_SPACE_ALLOWED_MIME_TYPES, DEFAULT_FORM_SPACE_MAX_FILE_SIZE_BYTES, DEFAULT_FORM_SPACE_MAX_UPLOADS, DEFAULT_FORM_SPACE_SLOT_MAX_FILES, type FormSpaceFileSlotConfig, type FormSpaceTypeConfig } from './formspace.type';

/**
 * @module formspace.util
 *
 * Pure helpers shared by the client and the server: the write templates for each lifecycle transition, and
 * the upload predicate.
 *
 * {@link assertFormSpaceUploadAllowed} in particular is deliberately PURE and lives here rather than in
 * `firebase-server`: the client pre-checks a file with it before asking for a signed URL, and the server's
 * upload initializer enforces the very same function afterwards. One rule, two callers — a client-side copy
 * that drifted would show the user an accept for a file the server then silently discards.
 *
 * A file's NAME is not one of the rules. It used to be: two files of one name in a slot resolved to the
 * same destination object, so the second silently overwrote the first. The destination is now keyed by the
 * space's `fi` index instead, so two files of one name are two objects, and the name is free to be
 * whatever the user uploaded.
 */

/**
 * Returns the {@link StorageFileGroupId} that owns every file uploaded into a FormSpace.
 *
 * The group is keyed by the FormSpace's own model key, so the existing sync machinery creates it on the
 * first upload and the existing zip / cleanup machinery applies with no FormSpace-specific code.
 *
 * @param formSpaceKey - The FormSpace's model key.
 * @returns The group id.
 *
 * @example
 * ```ts
 * const groupId = formSpaceStorageFileGroupId('fsp/abc123'); // 'fsp_abc123'
 * ```
 */
export function formSpaceStorageFileGroupId(formSpaceKey: FormSpaceKey): StorageFileGroupId {
  return storageFileGroupIdForModel(formSpaceKey);
}

/**
 * Input for {@link resolveFormSpaceExpiresAt}.
 */
export interface ResolveFormSpaceExpiresAtInput {
  readonly config: FormSpaceTypeConfig;
  /**
   * The instant the space is being created at. Defaults to now.
   */
  readonly now?: Maybe<Date>;
}

/**
 * Returns the instant a newly created FormSpace of the given type expires at, or null when its type never
 * expires.
 *
 * Null is meaningful rather than merely absent: it is what leaves `eat` unwritten, and an unwritten `eat`
 * is what excludes the space from the sweep's inequality query.
 *
 * @param input - The type config and creation instant.
 * @returns The expiration instant, or null when the type does not expire.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function resolveFormSpaceExpiresAt(input: ResolveFormSpaceExpiresAtInput): Maybe<Date> {
  const { config, now } = input;
  const expiresIn = config.expiresIn;
  return expiresIn == null ? null : new Date((now ?? new Date()).getTime() + expiresIn);
}

/**
 * Input for {@link formSpaceTemplate}.
 */
export interface FormSpaceTemplateInput<T extends FormSpaceData = FormSpaceData> {
  readonly formSpaceType: FormSpaceType;
  readonly uid: FirebaseAuthUserId;
  readonly ownerKey?: Maybe<FirebaseAuthOwnershipKey>;
  readonly targetModelKey?: Maybe<FirestoreModelKey>;
  readonly displayName?: Maybe<string>;
  readonly data?: Maybe<T>;
  readonly expiresAt?: Maybe<Date>;
  /**
   * The creation instant. Defaults to now.
   */
  readonly now?: Maybe<Date>;
}

/**
 * Builds the complete document template for a newly created FormSpace.
 *
 * @param input - The type, owner, and initial content of the space.
 * @returns The FormSpace template.
 *
 * @example
 * ```ts
 * const template = formSpaceTemplate({ formSpaceType: 'demo_example', uid: 'user123' });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function formSpaceTemplate<T extends FormSpaceData = FormSpaceData>(input: FormSpaceTemplateInput<T>): FormSpace<T> {
  const now = input.now ?? new Date();

  return {
    t: input.formSpaceType,
    n: input.displayName,
    s: FormSpaceState.DRAFT,
    ps: FormSpaceProcessingState.INIT_OR_NONE,
    d: input.data,
    u: input.uid,
    o: input.ownerKey,
    m: input.targetModelKey,
    uc: 0,
    fi: 0,
    f: [],
    cat: now,
    uat: now,
    eat: input.expiresAt
  };
}

/**
 * Builds the update template that submits a FormSpace.
 *
 * Clearing `eat` is not tidiness: a submitted space that kept its expiration instant would still match the
 * expiration sweep and be retired out from under the processing task.
 *
 * @param now - The submission instant. Defaults to now.
 * @returns The update template.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function submitFormSpaceTemplate(now?: Maybe<Date>): Partial<FormSpace> {
  const submittedAt = now ?? new Date();

  return {
    s: FormSpaceState.SUBMITTED,
    ps: FormSpaceProcessingState.QUEUED_FOR_PROCESSING,
    sat: submittedAt,
    uat: submittedAt,
    eat: null
  };
}

/**
 * Builds the update template that expires a FormSpace.
 *
 * @param now - The expiration instant. Defaults to now.
 * @returns The update template.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function expireFormSpaceTemplate(now?: Maybe<Date>): Partial<FormSpace> {
  const expiredAt = now ?? new Date();

  return {
    s: FormSpaceState.EXPIRED,
    ps: FormSpaceProcessingState.DO_NOT_PROCESS,
    uat: expiredAt,
    eat: null // removes the space from the sweep's query, so a retry cannot re-expire it
  };
}

/**
 * Input for {@link isFormSpaceEditable}.
 */
export interface IsFormSpaceEditableInput {
  readonly formSpace: Pick<FormSpace, 's' | 'sat' | 'eat'>;
  /**
   * The instant to judge against. Defaults to now.
   */
  readonly now?: Maybe<Date>;
}

/**
 * Returns true when a FormSpace may still be edited or uploaded into.
 *
 * Checks the expiration instant as well as the state, so a space whose sweep has not run yet is already
 * closed. The sweep is what RETIRES the document; it is not what makes it un-editable.
 *
 * @param input - The space and the instant to judge against.
 * @returns True when the space is editable.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function isFormSpaceEditable(input: IsFormSpaceEditableInput): boolean {
  const { formSpace, now } = input;
  const at = now ?? new Date();
  return formSpace.s === FormSpaceState.DRAFT && formSpace.sat == null && (formSpace.eat == null || formSpace.eat.getTime() > at.getTime());
}

/**
 * Returns the slot config a type declares for the given slot, or null when it declares none.
 *
 * @param config - The type config.
 * @param slot - The slot to look up.
 * @returns The slot config, or null.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function formSpaceFileSlotConfig(config: FormSpaceTypeConfig, slot: FormSpaceFileSlot): Maybe<FormSpaceFileSlotConfig> {
  return config.slots?.find((x) => x.slot === slot);
}

/**
 * Returns how many files a slot may hold at once.
 *
 * @param slotConfig - The slot config, or null for an undeclared slot.
 * @returns The slot's file capacity.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function formSpaceSlotMaxFiles(slotConfig: Maybe<FormSpaceFileSlotConfig>): number {
  return slotConfig?.maxFiles ?? DEFAULT_FORM_SPACE_SLOT_MAX_FILES;
}

/**
 * Returns how many files a slot must hold before the space may be submitted.
 *
 * `required` is the older, coarser spelling of the same idea, so it resolves to 1 when `minFiles` is absent.
 *
 * @param slotConfig - The slot config, or null for an undeclared slot.
 * @returns The slot's minimum file count.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function formSpaceSlotMinFiles(slotConfig: Maybe<FormSpaceFileSlotConfig>): number {
  return slotConfig?.minFiles ?? (slotConfig?.required === true ? 1 : 0);
}

/**
 * Returns the files a FormSpace currently holds in one slot.
 *
 * @param formSpace - The space to read.
 * @param slot - The slot to filter by.
 * @returns The slot's files, in the order the space stores them.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function formSpaceFilesInSlot(formSpace: Pick<FormSpace, 'f'>, slot: FormSpaceFileSlot): FormSpaceFile[] {
  return formSpace.f.filter((x) => x.sl === slot);
}

/**
 * Every slot a type requires be filled before its spaces may be submitted.
 *
 * A CLIENT-side convenience for labelling a form's required slots. The submit gate itself uses
 * {@link formSpaceSubmitBlockers}, which also understands `minFiles` and validation state.
 *
 * @param config - The type config.
 * @returns The required slots.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function requiredFormSpaceFileSlots(config: FormSpaceTypeConfig): FormSpaceFileSlot[] {
  return (config.slots ?? []).filter((x) => x.required === true).map((x) => x.slot);
}

/**
 * Why {@link assertFormSpaceUploadAllowed} rejected an upload.
 *
 * A discriminated reason rather than a bare false: the caller turns it into an error code, and a client
 * pre-check turns it into a message the user can act on.
 */
export type FormSpaceUploadRejectionReason = 'not_editable' | 'unknown_slot' | 'max_uploads_reached' | 'slot_full' | 'invalid_mime_type' | 'file_too_large';

/**
 * Result of {@link assertFormSpaceUploadAllowed}.
 */
export interface FormSpaceUploadAllowedResult {
  readonly allowed: boolean;
  readonly reason?: Maybe<FormSpaceUploadRejectionReason>;
}

/**
 * Input for {@link assertFormSpaceUploadAllowed}.
 */
export interface AssertFormSpaceUploadAllowedInput {
  readonly formSpace: Pick<FormSpace, 's' | 'sat' | 'eat' | 'uc' | 'f'>;
  readonly config: FormSpaceTypeConfig;
  readonly slot: FormSpaceFileSlot;
  readonly mimeType: ContentTypeMimeType;
  readonly sizeBytes: number;
  /**
   * The instant to judge editability against. Defaults to now.
   */
  readonly now?: Maybe<Date>;
}

/**
 * Decides whether one file may be uploaded into one slot of one FormSpace.
 *
 * THE single upload rule. The client calls it to pre-check before requesting a signed URL, and the server's
 * upload initializer calls it again — authoritatively, after loading the space — before creating any
 * StorageFile. The client call is a courtesy; only the server call is a control.
 *
 * @param input - The space, its type config, and the candidate file.
 * @returns Whether the upload is allowed, and why not when it is not.
 *
 * @example
 * ```ts
 * const result = assertFormSpaceUploadAllowed({ formSpace, config, slot: 'resume', mimeType: 'application/pdf', sizeBytes: 4096 });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function assertFormSpaceUploadAllowed(input: AssertFormSpaceUploadAllowedInput): FormSpaceUploadAllowedResult {
  const { formSpace, config, slot, mimeType, sizeBytes, now } = input;
  let reason: Maybe<FormSpaceUploadRejectionReason>;

  const slotConfig = formSpaceFileSlotConfig(config, slot);
  const allowedMimeTypes: readonly ContentTypeMimeType[] = slotConfig?.allowedMimeTypes ?? config.allowedMimeTypes ?? DEFAULT_FORM_SPACE_ALLOWED_MIME_TYPES;
  const maxFileSizeBytes = slotConfig?.maxFileSizeBytes ?? config.maxFileSizeBytes ?? DEFAULT_FORM_SPACE_MAX_FILE_SIZE_BYTES;
  const maxUploads = config.maxUploads ?? DEFAULT_FORM_SPACE_MAX_UPLOADS;
  const maxFiles = formSpaceSlotMaxFiles(slotConfig);
  const filesInSlot = formSpaceFilesInSlot(formSpace, slot);

  if (!isFormSpaceEditable({ formSpace, now })) {
    reason = 'not_editable';
  } else if (slotConfig == null && config.allowUndeclaredSlots !== true) {
    reason = 'unknown_slot';
  } else if (formSpace.uc >= maxUploads) {
    reason = 'max_uploads_reached';
    // a full folder is refused rather than evicting its oldest file. A POSITION slot (maxFiles === 1) is
    // excluded because it supersedes what it holds rather than filling up.
  } else if (maxFiles > 1 && filesInSlot.length >= maxFiles) {
    reason = 'slot_full';
  } else if (!allowedMimeTypes.includes(mimeType)) {
    reason = 'invalid_mime_type';
  } else if (sizeBytes > maxFileSizeBytes) {
    reason = 'file_too_large';
  }

  return { allowed: reason == null, reason };
}

/**
 * Why a FormSpace cannot be submitted yet.
 *
 * Per-slot rather than a bare list of slot names, because "you have not uploaded a second document" and "the
 * document you uploaded was rejected" want different words in front of the user.
 */
export interface FormSpaceSubmitBlocker {
  readonly slot: FormSpaceFileSlot;
  /**
   * `missing_files` — the slot holds fewer than its `minFiles`.
   * `invalid_file` — the slot holds a file validation judged INVALID.
   * `pending_validation` — the slot holds a file whose validation has not concluded.
   */
  readonly reason: 'missing_files' | 'invalid_file' | 'pending_validation';
  /**
   * The offending files, for `invalid_file` and `pending_validation`.
   */
  readonly files?: Maybe<FormSpaceFile[]>;
}

/**
 * Returns every reason a FormSpace may not be submitted yet, or an empty array when it may.
 *
 * Reads the space's own `f` array rather than querying its StorageFiles. That array is written in the
 * accept transaction, so unlike a query it is correct immediately after an upload — and unlike a query it
 * can be read inside the transaction that takes the submit lock.
 *
 * @param formSpace - The space to check.
 * @param config - Its type config.
 * @returns The blockers, empty when the space may be submitted.
 *
 * @example
 * ```ts
 * const blockers = formSpaceSubmitBlockers(formSpace, config);
 *
 * if (blockers.length > 0) {
 *   throw formSpaceRequiredSlotMissingError(blockers.map((x) => x.slot));
 * }
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function formSpaceSubmitBlockers(formSpace: Pick<FormSpace, 'f'>, config: FormSpaceTypeConfig): FormSpaceSubmitBlocker[] {
  const blockers: FormSpaceSubmitBlocker[] = [];

  (config.slots ?? []).forEach((slotConfig) => {
    const { slot } = slotConfig;
    const files = formSpaceFilesInSlot(formSpace, slot);

    if (files.length < formSpaceSlotMinFiles(slotConfig)) {
      blockers.push({ slot, reason: 'missing_files' });
    } else if (slotConfig.validationRequired === true) {
      const invalid = files.filter((x) => x.v === FormSpaceFileValidationState.INVALID);
      const pending = files.filter((x) => x.v === FormSpaceFileValidationState.PENDING);

      // invalid outranks pending: a slot holding one rejected and one still-checking file needs the rejected
      // one dealt with either way, and reporting "still checking" would invite a pointless wait.
      if (invalid.length > 0) {
        blockers.push({ slot, reason: 'invalid_file', files: invalid });
      } else if (pending.length > 0) {
        blockers.push({ slot, reason: 'pending_validation', files: pending });
      }
    }
  });

  return blockers;
}
