import { type Maybe } from '@dereekb/util';
import {
  DEFAULT_USER_EXTERNAL_CONNECTION_DATA_MAX_ITEMS,
  DEFAULT_USER_EXTERNAL_CONNECTION_DATA_MAX_VALUE_BYTES,
  USER_EXTERNAL_CONNECTION_DATA_MAX_DOCUMENT_BYTES,
  USER_EXTERNAL_CONNECTION_DATA_MAX_OPERATIONS,
  type UserExternalConnectionDataTypeConfig,
  type UserExternalConnectionDataTypeConfigLookup,
  type UserExternalConnectionDataTypeKey,
  type UserExternalConnectionProviderType,
  userExternalConnectionDataTypeConfigLookup
} from '@dereekb/firebase';

// MARK: Limits
/**
 * Whole-document and per-request limits on stored connection data. Per-type limits live on each
 * {@link UserExternalConnectionDataTypeConfig}.
 */
export interface UserExternalConnectionDataLimits {
  /**
   * Maximum size of the whole stored map, in bytes of plaintext UTF-8 JSON. Defaults to {@link USER_EXTERNAL_CONNECTION_DATA_MAX_DOCUMENT_BYTES}.
   */
  readonly maxDocumentBytes: number;
  /**
   * Maximum number of set + unset operations in one update. Defaults to {@link USER_EXTERNAL_CONNECTION_DATA_MAX_OPERATIONS}.
   */
  readonly maxOperations: number;
}

/**
 * The default {@link UserExternalConnectionDataLimits}.
 */
export const DEFAULT_USER_EXTERNAL_CONNECTION_DATA_LIMITS: UserExternalConnectionDataLimits = {
  maxDocumentBytes: USER_EXTERNAL_CONNECTION_DATA_MAX_DOCUMENT_BYTES,
  maxOperations: USER_EXTERNAL_CONNECTION_DATA_MAX_OPERATIONS
};

/**
 * Fills in the defaults of a partial {@link UserExternalConnectionDataLimits}.
 *
 * @param limits - The app's overrides.
 * @returns The complete limits.
 */
export function userExternalConnectionDataLimits(limits?: Maybe<Partial<UserExternalConnectionDataLimits>>): UserExternalConnectionDataLimits {
  return {
    maxDocumentBytes: limits?.maxDocumentBytes ?? DEFAULT_USER_EXTERNAL_CONNECTION_DATA_LIMITS.maxDocumentBytes,
    maxOperations: limits?.maxOperations ?? DEFAULT_USER_EXTERNAL_CONNECTION_DATA_LIMITS.maxOperations
  };
}

// MARK: Registry
/**
 * The app's registered connection data types. Also the NestJS injection token for itself.
 *
 * Fails closed: a provider or data type that is not registered is refused, and an empty registry refuses every
 * write while reads return nothing.
 */
export abstract class UserExternalConnectionDataTypeRegistry implements UserExternalConnectionDataTypeConfigLookup {
  abstract readonly configs: readonly UserExternalConnectionDataTypeConfig[];
  abstract configFor(providerType: UserExternalConnectionProviderType, dataType: UserExternalConnectionDataTypeKey): Maybe<UserExternalConnectionDataTypeConfig>;
  abstract configsFor(providerType: UserExternalConnectionProviderType): readonly UserExternalConnectionDataTypeConfig[];
  /**
   * The resolved max items of a data type.
   */
  abstract maxItemsFor(config: UserExternalConnectionDataTypeConfig): number;
  /**
   * The resolved max value bytes of a data type.
   */
  abstract maxValueBytesFor(config: UserExternalConnectionDataTypeConfig): number;
}

/**
 * Creates a {@link UserExternalConnectionDataTypeRegistry}.
 *
 * @param configs - The app's registered data types.
 * @returns The registry.
 * @throws {Error} When a data type key is invalid, or a (providerType, dataType) pair is registered twice.
 */
export function userExternalConnectionDataTypeRegistry(configs?: Maybe<readonly UserExternalConnectionDataTypeConfig[]>): UserExternalConnectionDataTypeRegistry {
  const lookup = userExternalConnectionDataTypeConfigLookup(configs);

  return {
    configs: lookup.configs,
    configFor: lookup.configFor,
    configsFor: lookup.configsFor,
    maxItemsFor: (config) => config.maxItems ?? DEFAULT_USER_EXTERNAL_CONNECTION_DATA_MAX_ITEMS,
    maxValueBytesFor: (config) => config.maxValueBytes ?? DEFAULT_USER_EXTERNAL_CONNECTION_DATA_MAX_VALUE_BYTES
  };
}
