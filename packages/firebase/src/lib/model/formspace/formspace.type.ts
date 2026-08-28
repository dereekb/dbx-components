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
  // MARK: lifecycle
  /**
   * How long a newly created FormSpace of this type stays editable before the expiration sweep retires it.
   *
   * When absent the space never expires and `eat` is never written, which is exactly what keeps it out of
   * the sweep's inequality query.
   */
  readonly expiresIn?: Maybe<Milliseconds>;
}

/**
 * Default for {@link FormSpaceTypeConfig.maxUploads}.
 */
export const DEFAULT_FORM_SPACE_MAX_UPLOADS = 20;

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
