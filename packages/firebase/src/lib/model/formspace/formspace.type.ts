import { type ContentTypeMimeType, type Maybe, type Milliseconds, MS_IN_DAY } from '@dereekb/util';
import { type FormSpaceFileSlot, type FormSpaceType } from './formspace.id';

/**
 * @module formspace.type
 *
 * The {@link FormSpaceType} registry: the per-type upload restrictions, expiration policy, and submission
 * metadata an app declares once and both the client and the server read.
 *
 * The type and the factory live here, in the model folder rather than in `firebase-server`, so a client-side
 * pre-check rejects an oversized file with the SAME rule the server enforces authoritatively. Only the
 * service INSTANCE is constructed server-side, as a NestJS provider — the same split
 * {@link AppCalendarTypeConfigService} uses.
 */

/**
 * Who may read and remove an individual file, among the users who already reach the FormSpace itself.
 *
 * Narrows access; it never widens it. A caller that cannot read the space at all is refused before this is
 * ever consulted, so `'space'` is not "public" — it is "whoever the space already lets in".
 *
 * - `'space'` — anyone holding the corresponding role on the space. The DEFAULT, and the only sensible
 *   answer for a single-user form, where every file was uploaded by the one person who can reach it.
 * - `'uploader'` — only the user who uploaded that file, per {@link FormSpaceFile.ub}. For a SHARED space
 *   whose members contribute side by side rather than collaborating on one pile: a member adds their own
 *   photos and can take them back, and cannot read or delete anybody else's. The space's own `u` is NOT
 *   exempt — on a shared space `u` is whoever the space was opened for, not an administrator of its
 *   contents, and exempting them would quietly hand one member the whole album.
 */
export type FormSpaceFileAccess = 'space' | 'uploader';

/**
 * Default for {@link FormSpaceFileSlotConfig.fileAccess} and {@link FormSpaceTypeConfig.fileAccess}.
 *
 * `'space'`, so a type declared before per-file access existed keeps behaving exactly as it did.
 */
export const DEFAULT_FORM_SPACE_FILE_ACCESS: FormSpaceFileAccess = 'space';

/**
 * Restrictions for a single named upload slot within a {@link FormSpaceTypeConfig}.
 *
 * A slot is a LOGICAL position, not a file: uploading into an occupied slot supersedes what was there, so
 * "one current resume" needs no extra bookkeeping.
 */
export interface FormSpaceFileSlotConfig {
  /**
   * The slot this configuration applies to.
   */
  readonly slot: FormSpaceFileSlot;
  /**
   * Human-readable name of the slot, for tooling and logs.
   */
  readonly name?: Maybe<string>;
  /**
   * Whether the space may be submitted without a file in this slot. Defaults to false.
   */
  readonly required?: Maybe<boolean>;
  /**
   * Mime types accepted in this slot. Defaults to the type's {@link FormSpaceTypeConfig.allowedMimeTypes}.
   */
  readonly allowedMimeTypes?: Maybe<readonly ContentTypeMimeType[]>;
  /**
   * Size cap for a file in this slot. Defaults to the type's {@link FormSpaceTypeConfig.maxFileSizeBytes}.
   */
  readonly maxFileSizeBytes?: Maybe<number>;
  /**
   * How many files this slot may hold at once. Defaults to {@link DEFAULT_FORM_SPACE_SLOT_MAX_FILES}.
   *
   * At 1 the slot is a POSITION: a new upload supersedes whatever was there, which is the original "one
   * current resume" behaviour. Above 1 it is a FOLDER: uploads accumulate, and one is refused once the
   * folder is full rather than quietly evicting the oldest file the user put there.
   */
  readonly maxFiles?: Maybe<number>;
  /**
   * How many files this slot must hold before the space may be submitted.
   *
   * Defaults to 1 when {@link required} is true, and 0 otherwise, so `required` keeps meaning exactly what it
   * meant before folders existed.
   */
  readonly minFiles?: Maybe<number>;
  /**
   * Who may read and remove an individual file in this slot.
   *
   * Defaults to the type's {@link FormSpaceTypeConfig.fileAccess}, which itself defaults to
   * {@link DEFAULT_FORM_SPACE_FILE_ACCESS}. Narrowing it per slot is what lets one shared space hold a
   * public banner everybody sees alongside a folder of each member's own documents.
   */
  readonly fileAccess?: Maybe<FormSpaceFileAccess>;
  /**
   * Whether a file here must pass validation before the space may be submitted. Defaults to false.
   *
   * Setting it does two things: an accepted upload enters the StorageFile processing pipeline instead of
   * being stored as-is, and a file left PENDING or judged INVALID blocks submission. A type that sets this
   * MUST register a validator for the slot server-side; the wiring asserts that at boot.
   */
  readonly validationRequired?: Maybe<boolean>;
}

/**
 * Upload, expiration, and submission configuration for a single {@link FormSpaceType}.
 *
 * This is the contract a FormSpace of the type is held to. It is pure data and is shared by the client and
 * the server; the server-side PROCESSING of a submission is registered separately, as a
 * `FormSpaceSubmissionProcessorConfig` keyed by the same type string.
 */
export interface FormSpaceTypeConfig {
  /**
   * The type this configuration applies to.
   */
  readonly formSpaceType: FormSpaceType;
  /**
   * Human-readable name of the type, for tooling and logs.
   */
  readonly name?: Maybe<string>;
  /**
   * Longer description of what the type collects.
   */
  readonly description?: Maybe<string>;
  // MARK: uploads
  /**
   * The upload slots this type declares.
   *
   * When empty, the type accepts no uploads at all — a FormSpace can be a pure JSON container.
   */
  readonly slots?: Maybe<readonly FormSpaceFileSlotConfig[]>;
  /**
   * Whether a slot NOT declared in {@link slots} may be uploaded into. Defaults to false.
   *
   * False is the safe default: an undeclared slot has no size or mime restriction of its own, so allowing
   * one silently widens the type's contract to the global defaults.
   */
  readonly allowUndeclaredSlots?: Maybe<boolean>;
  /**
   * Maximum number of uploads a single FormSpace of this type may ACCEPT over its whole lifetime.
   *
   * Counted against the space's monotonic `uc` counter, which is why superseding a slot still consumes one:
   * the cap bounds work done, not files retained. Defaults to {@link DEFAULT_FORM_SPACE_MAX_UPLOADS}.
   */
  readonly maxUploads?: Maybe<number>;
  /**
   * Mime types accepted by any slot that does not narrow them further.
   * Defaults to {@link DEFAULT_FORM_SPACE_ALLOWED_MIME_TYPES}.
   */
  readonly allowedMimeTypes?: Maybe<readonly ContentTypeMimeType[]>;
  /**
   * Size cap for any slot that does not narrow it further.
   * Defaults to {@link DEFAULT_FORM_SPACE_MAX_FILE_SIZE_BYTES}.
   */
  readonly maxFileSizeBytes?: Maybe<number>;
  /**
   * Who may read and remove an individual file in any slot that does not narrow it further.
   * Defaults to {@link DEFAULT_FORM_SPACE_FILE_ACCESS}.
   */
  readonly fileAccess?: Maybe<FormSpaceFileAccess>;
  // MARK: lifecycle
  /**
   * How long a newly created FormSpace of this type stays editable before the expiration sweep retires it.
   *
   * When absent the space never expires and `eat` is never written, which is exactly what keeps it out of
   * the sweep's inequality query.
   */
  readonly expiresIn?: Maybe<Milliseconds>;
  // MARK: reopen
  /**
   * How long after EACH submission a space of this type may be reopened, returning it to an editable draft.
   *
   * THE MASTER SWITCH. When absent the type is never reopenable and submission stays the one-way door it
   * has always been — which is what makes the whole reopen feature opt-in, and why no existing type can
   * acquire resubmit semantics by accident.
   *
   * Distinct from {@link expiresIn}, which bounds the lifetime of the DRAFT. This bounds the lifetime of
   * the SUBMISSION's mutability.
   *
   * Rolling by default: absent {@link reopenableUntil}, every submission grants a fresh window measured
   * from its own `sat`.
   */
  readonly reopenableFor?: Maybe<Milliseconds>;
  /**
   * A hard ceiling on reopening, measured from the FIRST submission rather than the current one.
   *
   * Materialized onto the space as `lat` on its first submit and never moved, so repeated reopen/resubmit
   * rounds cannot walk the deadline forward the way a purely rolling {@link reopenableFor} lets them. Use
   * it when "this submission is final N hours after it was first made" has to be a wall-clock guarantee.
   *
   * Absent leaves {@link reopenableFor} rolling. Meaningless on its own: {@link reopenableFor} is what
   * permits a reopen at all, and this only narrows it.
   */
  readonly reopenableUntil?: Maybe<Milliseconds>;
  /**
   * How many times a space of this type may be reopened. Counted against the space's monotonic `rc`.
   *
   * Absent leaves the count unbounded and the windows above the only limit — which is fine for a
   * {@link reopenableUntil} ceiling, and worth setting deliberately for a purely rolling window, where a
   * resubmit keeps earning a new one.
   */
  readonly maxReopens?: Maybe<number>;
}

/**
 * Default for {@link FormSpaceTypeConfig.maxUploads}.
 */
export const DEFAULT_FORM_SPACE_MAX_UPLOADS = 20;

/**
 * Default for {@link FormSpaceFileSlotConfig.maxFiles}.
 *
 * One, so a slot declared before folders existed keeps superseding rather than silently accumulating.
 */
export const DEFAULT_FORM_SPACE_SLOT_MAX_FILES = 1;

/**
 * Default for {@link FormSpaceTypeConfig.maxFileSizeBytes}: 10 MiB.
 */
export const DEFAULT_FORM_SPACE_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Default for {@link FormSpaceTypeConfig.allowedMimeTypes}.
 *
 * Deliberately narrow: a form attachment is a document or an image, and an open list on the DEFAULT path is
 * how an upload endpoint becomes a general-purpose file host.
 */
export const DEFAULT_FORM_SPACE_ALLOWED_MIME_TYPES: readonly ContentTypeMimeType[] = ['application/pdf', 'image/jpeg', 'image/png', 'text/plain'];

/**
 * Default expiration applied to {@link DEFAULT_FORM_SPACE_TYPE_CONFIG}-shaped types that opt in: seven days.
 */
export const DEFAULT_FORM_SPACE_EXPIRES_IN: Milliseconds = 7 * MS_IN_DAY;

/**
 * The {@link FormSpaceType} of {@link DEFAULT_FORM_SPACE_TYPE_CONFIG}, used for a type the app never registered.
 */
export const UNKNOWN_FORM_SPACE_TYPE: FormSpaceType = 'unknown';

/**
 * The configuration applied to a FormSpace whose type the app did not register.
 *
 * An unregistered type falls back rather than throwing on purpose: a scheduled sweep over every FormSpace in
 * the app must not be taken down by one badly-typed document. CREATION is the opposite — `createFormSpace`
 * rejects an unregistered type outright, so this fallback only ever governs a document that already exists.
 *
 * It declares no slots and does not allow undeclared ones, so an unregistered space accepts no uploads.
 */
export const DEFAULT_FORM_SPACE_TYPE_CONFIG: FormSpaceTypeConfig = {
  formSpaceType: UNKNOWN_FORM_SPACE_TYPE
};

/**
 * Record of {@link FormSpaceTypeConfig} keyed by {@link FormSpaceType}.
 */
export type FormSpaceTypeConfigRecord = Record<FormSpaceType, FormSpaceTypeConfig>;

/**
 * Creates a {@link FormSpaceTypeConfigRecord} from an array of configs.
 *
 * @param configs - The configs to index.
 * @returns A record keyed by form space type.
 * @throws {Error} When two configs declare the same {@link FormSpaceType}.
 *
 * @example
 * ```ts
 * const record = formSpaceTypeConfigRecord([{ formSpaceType: 'demo_example' }]);
 * ```
 */
export function formSpaceTypeConfigRecord(configs: FormSpaceTypeConfig[]): FormSpaceTypeConfigRecord {
  const record: FormSpaceTypeConfigRecord = {};

  configs.forEach((x) => {
    const { formSpaceType } = x;

    if (record[formSpaceType]) {
      throw new Error(`formSpaceTypeConfigRecord(): duplicate FormSpaceType in record: ${formSpaceType}`);
    }

    record[formSpaceType] = x;
  });

  return record;
}

/**
 * Runtime service for resolving a {@link FormSpaceTypeConfig} from a {@link FormSpaceType}.
 *
 * Built from a {@link FormSpaceTypeConfigRecord} via {@link appFormSpaceTypeConfigService}.
 */
export abstract class AppFormSpaceTypeConfigService {
  /**
   * All registered configs for this app.
   */
  abstract readonly appFormSpaceTypeConfigRecord: FormSpaceTypeConfigRecord;

  /**
   * Returns the config for the given type, falling back to the service's default when it is not registered.
   *
   * @param formSpaceType - The type to look up.
   */
  abstract configForFormSpaceType(formSpaceType: FormSpaceType): FormSpaceTypeConfig;

  /**
   * Returns the config for the given type, or null when it is not registered.
   *
   * This is what `createFormSpace` gates on: a space may only be CREATED for a type the app declared.
   *
   * @param formSpaceType - The type to look up.
   */
  abstract registeredConfigForFormSpaceType(formSpaceType: FormSpaceType): Maybe<FormSpaceTypeConfig>;

  /**
   * Returns every registered {@link FormSpaceType}.
   */
  abstract getAllKnownFormSpaceTypes(): FormSpaceType[];

  /**
   * Returns every registered {@link FormSpaceTypeConfig}.
   */
  abstract getAllKnownFormSpaceTypeConfigs(): FormSpaceTypeConfig[];
}

/**
 * Reference to an {@link AppFormSpaceTypeConfigService} instance, for dependency injection.
 */
export interface AppFormSpaceTypeConfigServiceRef {
  readonly appFormSpaceTypeConfigService: AppFormSpaceTypeConfigService;
}

/**
 * Creates an {@link AppFormSpaceTypeConfigService} from the given record.
 *
 * @param appFormSpaceTypeConfigRecord - The complete form space type registry for the application.
 * @param defaultConfig - Config used for an unregistered type. Defaults to {@link DEFAULT_FORM_SPACE_TYPE_CONFIG}.
 * @returns The service.
 *
 * @example
 * ```ts
 * const service = appFormSpaceTypeConfigService(formSpaceTypeConfigRecord(DEMO_FORM_SPACE_TYPE_CONFIGS));
 * const config = service.configForFormSpaceType('demo_example');
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function appFormSpaceTypeConfigService(appFormSpaceTypeConfigRecord: FormSpaceTypeConfigRecord, defaultConfig: FormSpaceTypeConfig = DEFAULT_FORM_SPACE_TYPE_CONFIG): AppFormSpaceTypeConfigService {
  const allKnownFormSpaceTypes = Object.keys(appFormSpaceTypeConfigRecord);
  const allKnownFormSpaceTypeConfigs = allKnownFormSpaceTypes.map((x) => appFormSpaceTypeConfigRecord[x]);

  return {
    appFormSpaceTypeConfigRecord,
    configForFormSpaceType(formSpaceType: FormSpaceType) {
      return appFormSpaceTypeConfigRecord[formSpaceType] ?? defaultConfig;
    },
    registeredConfigForFormSpaceType(formSpaceType: FormSpaceType) {
      return appFormSpaceTypeConfigRecord[formSpaceType];
    },
    getAllKnownFormSpaceTypes() {
      return [...allKnownFormSpaceTypes];
    },
    getAllKnownFormSpaceTypeConfigs() {
      return [...allKnownFormSpaceTypeConfigs];
    }
  };
}
