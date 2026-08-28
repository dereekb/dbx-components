import { type ContentTypeMimeType, type Maybe } from '@dereekb/util';
import { type FirebaseAuthOwnershipKey, type FirebaseAuthUserId } from '../../common/auth/auth';
import { type FirestoreModelKey } from '../../common/firestore/collection/collection';
import { type StorageFileGroupId, storageFileGroupIdForModel } from '../storagefile/storagefile.id';
import { type FormSpace, type FormSpaceData, FormSpaceProcessingState, FormSpaceState } from './formspace';
import { type FormSpaceFileSlot, type FormSpaceKey, type FormSpaceType } from './formspace.id';
import { DEFAULT_FORM_SPACE_ALLOWED_MIME_TYPES, DEFAULT_FORM_SPACE_MAX_FILE_SIZE_BYTES, DEFAULT_FORM_SPACE_MAX_UPLOADS, type FormSpaceFileSlotConfig, type FormSpaceTypeConfig } from './formspace.type';

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
 * Every slot a type requires be filled before its spaces may be submitted.
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
export type FormSpaceUploadRejectionReason = 'not_editable' | 'unknown_slot' | 'max_uploads_reached' | 'invalid_mime_type' | 'file_too_large';

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
  readonly formSpace: Pick<FormSpace, 's' | 'sat' | 'eat' | 'uc'>;
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

  if (!isFormSpaceEditable({ formSpace, now })) {
    reason = 'not_editable';
  } else if (slotConfig == null && config.allowUndeclaredSlots !== true) {
    reason = 'unknown_slot';
  } else if (formSpace.uc >= maxUploads) {
    reason = 'max_uploads_reached';
  } else if (!allowedMimeTypes.includes(mimeType)) {
    reason = 'invalid_mime_type';
  } else if (sizeBytes > maxFileSizeBytes) {
    reason = 'file_too_large';
  }

  return { allowed: reason == null, reason };
}
