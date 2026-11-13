import { type Type } from 'arktype';
import { type ISO8601DateString, type Maybe } from '@dereekb/util';
import { type UserExternalConnectionProviderType } from './userexternalconnection.id';

// MARK: Keys and Values
/**
 * Key of one kind of stored connection data within a provider, e.g. `mail_signature`.
 *
 * Lowercase letters, digits and underscores, starting with a letter, at most 64 characters.
 */
export type UserExternalConnectionDataTypeKey = string;

/**
 * Key of one item within a data type, e.g. a mailbox address, or {@link USER_EXTERNAL_CONNECTION_DATA_SELF_ITEM_KEY}.
 *
 * 1–256 characters, no control characters. Each data type may normalize it further (e.g. lowercasing an address).
 */
export type UserExternalConnectionDataItemKey = string;

/**
 * Reserved item key for the connection's own account (e.g. Graph's `/me` mailbox).
 *
 * Never collides with an email address, so a data type can key the user's own item and shared items side by side.
 */
export const USER_EXTERNAL_CONNECTION_DATA_SELF_ITEM_KEY: UserExternalConnectionDataItemKey = 'me';

/**
 * One stored value: a plain JSON object (no Dates, no class instances).
 */
export type UserExternalConnectionDataValue = Readonly<Record<string, unknown>>;

/**
 * Items of one data type, keyed by item key.
 */
export type UserExternalConnectionDataItems<V extends object = UserExternalConnectionDataValue> = Readonly<Record<UserExternalConnectionDataItemKey, V>>;

/**
 * Data of one provider, keyed by data type.
 */
export type UserExternalConnectionProviderData = Readonly<Record<UserExternalConnectionDataTypeKey, UserExternalConnectionDataItems>>;

/**
 * Data of every provider, keyed by provider type.
 */
export type UserExternalConnectionDataMap = Readonly<Record<UserExternalConnectionProviderType, UserExternalConnectionProviderData>>;

/**
 * Pattern every {@link UserExternalConnectionDataTypeKey} must match.
 */
export const USER_EXTERNAL_CONNECTION_DATA_TYPE_KEY_REGEX = /^[a-z][a-z0-9_]{0,63}$/;

/**
 * Maximum length of an item key.
 */
export const USER_EXTERNAL_CONNECTION_DATA_ITEM_KEY_MAX_LENGTH = 256;

// MARK: Limits
/**
 * Default maximum number of items per data type.
 */
export const DEFAULT_USER_EXTERNAL_CONNECTION_DATA_MAX_ITEMS = 50;

/**
 * Default maximum size of one value, in bytes of its UTF-8 JSON encoding.
 */
export const DEFAULT_USER_EXTERNAL_CONNECTION_DATA_MAX_VALUE_BYTES = 32 * 1024;

/**
 * Maximum size of a user's whole stored data map, in bytes of its UTF-8 plaintext JSON encoding.
 *
 * Encrypted and base64-encoded this is roughly 342 KiB, well under Firestore's 1 MiB document limit.
 */
export const USER_EXTERNAL_CONNECTION_DATA_MAX_DOCUMENT_BYTES = 256 * 1024;

/**
 * Maximum number of set/unset operations one update may carry.
 */
export const USER_EXTERNAL_CONNECTION_DATA_MAX_OPERATIONS = 50;

// MARK: Typing Hook
/**
 * The value shapes of one provider's data types, keyed by data type.
 */
export type UserExternalConnectionDataTypeValues = { readonly [dataType: string]: object };

/**
 * An app's typings for its connection data: provider type → data type → value shape.
 *
 * Apps declare an interface extending this next to their data type registry list, e.g.
 *
 * ```ts
 * export interface DemoUserExternalConnectionDataTypings extends UserExternalConnectionDataTypings {
 *   readonly microsoft: MicrosoftUserExternalConnectionDataTypes;
 * }
 * ```
 */
export type UserExternalConnectionDataTypings = { readonly [providerType: string]: UserExternalConnectionDataTypeValues };

/**
 * Typed view of one provider's data.
 */
export type TypedUserExternalConnectionProviderData<D extends UserExternalConnectionDataTypeValues> = { readonly [K in keyof D]?: UserExternalConnectionDataItems<D[K] & object> };

/**
 * Typed view of every provider's data.
 */
export type TypedUserExternalConnectionDataMap<T extends UserExternalConnectionDataTypings> = { readonly [P in keyof T]?: TypedUserExternalConnectionProviderData<T[P]> };

/**
 * Reads one item from a typed data map.
 *
 * @param data - The data map.
 * @param providerType - The provider type.
 * @param dataType - The data type.
 * @param itemKey - The item key.
 * @returns The item's value, if present.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function readUserExternalConnectionDataItem<T extends UserExternalConnectionDataTypings, P extends keyof T & string, D extends keyof T[P] & string>(data: Maybe<TypedUserExternalConnectionDataMap<T>>, providerType: P, dataType: D, itemKey: UserExternalConnectionDataItemKey): Maybe<T[P][D]> {
  const providerData = data?.[providerType] as Maybe<Record<string, Maybe<Record<string, T[P][D]>>>>;
  return providerData?.[dataType]?.[itemKey];
}

// MARK: Registration
/**
 * Input to a data type's {@link UserExternalConnectionDataTypeConfig.packFile}.
 */
export interface UserExternalConnectionDataPackFileInput {
  /**
   * The file's name (or path), used to pick the format, e.g. `.html`.
   */
  readonly fileName: string;
  /**
   * The file's UTF-8 content.
   */
  readonly content: string;
}

/**
 * Declares one kind of connection data an app allows for one of its provider types.
 *
 * Shared by the server (which validates every write against it) and the app CLI (which uses it to pack files and
 * normalize keys before sending).
 */
export interface UserExternalConnectionDataTypeConfig<V extends object = object> {
  /**
   * The provider type the data type is stored under.
   */
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * The data type key. Must match {@link USER_EXTERNAL_CONNECTION_DATA_TYPE_KEY_REGEX}.
   */
  readonly dataType: UserExternalConnectionDataTypeKey;
  /**
   * Short human-readable label, e.g. `Mail signature`.
   */
  readonly label: string;
  /**
   * Longer description of what the data is used for.
   */
  readonly description?: Maybe<string>;
  /**
   * Validates a value. Server-side errors report only the failing path, never the value or arktype's summary.
   */
  readonly valueType: Type<V>;
  /**
   * Normalizes an item key, or returns undefined when the key is invalid.
   *
   * The default trims the key and checks its length and characters. A custom normalizer replaces the default
   * entirely; {@link normalizeUserExternalConnectionDataItemKey} still enforces the base length/character rules.
   */
  readonly normalizeItemKey?: Maybe<(key: string) => Maybe<UserExternalConnectionDataItemKey>>;
  /**
   * Human text describing valid item keys, e.g. "`me`, or a sending email address".
   */
  readonly itemKeyDescription?: Maybe<string>;
  /**
   * Turns a file into a value (a CLI's `connection-data set … --file`). When absent, values must be given as JSON.
   */
  readonly packFile?: Maybe<(input: UserExternalConnectionDataPackFileInput) => V>;
  /**
   * Maximum number of items. Defaults to {@link DEFAULT_USER_EXTERNAL_CONNECTION_DATA_MAX_ITEMS}.
   */
  readonly maxItems?: Maybe<number>;
  /**
   * Maximum size of one value in bytes of UTF-8 JSON. Defaults to {@link DEFAULT_USER_EXTERNAL_CONNECTION_DATA_MAX_VALUE_BYTES}.
   */
  readonly maxValueBytes?: Maybe<number>;
}

/**
 * Typed identity builder for a {@link UserExternalConnectionDataTypeConfig}.
 *
 * @param config - The config.
 * @returns The same config.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function userExternalConnectionDataTypeConfig<V extends object>(config: UserExternalConnectionDataTypeConfig<V>): UserExternalConnectionDataTypeConfig<V> {
  return config;
}

/**
 * Lookup over an app's registered data types.
 */
export interface UserExternalConnectionDataTypeConfigLookup {
  /**
   * Every registered config.
   */
  readonly configs: readonly UserExternalConnectionDataTypeConfig[];
  /**
   * Returns the config for a provider's data type, if registered.
   */
  configFor(providerType: UserExternalConnectionProviderType, dataType: UserExternalConnectionDataTypeKey): Maybe<UserExternalConnectionDataTypeConfig>;
  /**
   * Returns every config registered for a provider.
   */
  configsFor(providerType: UserExternalConnectionProviderType): readonly UserExternalConnectionDataTypeConfig[];
}

/**
 * Creates a {@link UserExternalConnectionDataTypeConfigLookup}.
 *
 * @param configs - The app's registered data types.
 * @returns The lookup.
 * @throws {Error} When a data type key is invalid, or a (providerType, dataType) pair is registered twice.
 */
export function userExternalConnectionDataTypeConfigLookup(configs: Maybe<readonly UserExternalConnectionDataTypeConfig[]>): UserExternalConnectionDataTypeConfigLookup {
  const allConfigs = configs ?? [];
  const byProvider = new Map<UserExternalConnectionProviderType, Map<UserExternalConnectionDataTypeKey, UserExternalConnectionDataTypeConfig>>();

  for (const config of allConfigs) {
    if (!USER_EXTERNAL_CONNECTION_DATA_TYPE_KEY_REGEX.test(config.dataType)) {
      throw new Error(`userExternalConnectionDataTypeConfigLookup: invalid data type key "${config.dataType}".`);
    }

    if (!config.providerType) {
      throw new Error(`userExternalConnectionDataTypeConfigLookup: data type "${config.dataType}" has no provider type.`);
    }

    let providerMap = byProvider.get(config.providerType);

    if (!providerMap) {
      providerMap = new Map();
      byProvider.set(config.providerType, providerMap);
    }

    if (providerMap.has(config.dataType)) {
      throw new Error(`userExternalConnectionDataTypeConfigLookup: data type "${config.dataType}" is registered twice for provider "${config.providerType}".`);
    }

    providerMap.set(config.dataType, config);
  }

  return {
    configs: allConfigs,
    configFor: (providerType, dataType) => byProvider.get(providerType)?.get(dataType),
    configsFor: (providerType) => [...(byProvider.get(providerType)?.values() ?? [])]
  };
}

// eslint-disable-next-line no-control-regex
const ITEM_KEY_CONTROL_CHARACTER_REGEX = /[\u0000-\u001f\u007f]/;

/**
 * Normalizes an item key for a data type.
 *
 * Applies the data type's {@link UserExternalConnectionDataTypeConfig.normalizeItemKey} (or a trim), then enforces the
 * base rules: 1–256 characters, no control characters.
 *
 * @param config - The data type config.
 * @param key - The raw key.
 * @returns The normalized key, or undefined when invalid.
 */
export function normalizeUserExternalConnectionDataItemKey(config: Pick<UserExternalConnectionDataTypeConfig, 'normalizeItemKey'>, key: string): Maybe<UserExternalConnectionDataItemKey> {
  let result: Maybe<UserExternalConnectionDataItemKey>;

  if (typeof key === 'string') {
    const normalized = config.normalizeItemKey ? config.normalizeItemKey(key) : key.trim();

    if (normalized && normalized.length <= USER_EXTERNAL_CONNECTION_DATA_ITEM_KEY_MAX_LENGTH && !ITEM_KEY_CONTROL_CHARACTER_REGEX.test(normalized)) {
      result = normalized;
    }
  }

  return result;
}

/**
 * Returns the size of a value's UTF-8 JSON encoding, in bytes.
 *
 * @param value - The value.
 * @returns The byte length (0 when the value does not serialize).
 */
export function userExternalConnectionDataValueByteLength(value: unknown): number {
  const json = JSON.stringify(value);
  return json == null ? 0 : new TextEncoder().encode(json).length;
}

// MARK: Summaries
/**
 * Summary of one stored item, without its value.
 */
export interface UserExternalConnectionDataItemSummary {
  readonly providerType: UserExternalConnectionProviderType;
  readonly dataType: UserExternalConnectionDataTypeKey;
  readonly itemKey: UserExternalConnectionDataItemKey;
  /**
   * Size of the value's UTF-8 JSON encoding.
   */
  readonly bytes: number;
  /**
   * When the item was last set.
   */
  readonly updatedAt: ISO8601DateString;
}

/**
 * Summary of a data type the caller may store.
 */
export interface UserExternalConnectionDataTypeSummary {
  readonly providerType: UserExternalConnectionProviderType;
  readonly dataType: UserExternalConnectionDataTypeKey;
  readonly label: string;
  readonly description?: Maybe<string>;
  readonly itemKeyDescription?: Maybe<string>;
  /**
   * Whether a CLI can build a value from a file (`connection-data set … --file`).
   */
  readonly acceptsFile: boolean;
  readonly maxItems: number;
  readonly maxValueBytes: number;
}

/**
 * Builds the {@link UserExternalConnectionDataTypeSummary} of a config.
 *
 * @param config - The data type config.
 * @returns The summary.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function userExternalConnectionDataTypeSummary(config: UserExternalConnectionDataTypeConfig): UserExternalConnectionDataTypeSummary {
  return {
    providerType: config.providerType,
    dataType: config.dataType,
    label: config.label,
    description: config.description,
    itemKeyDescription: config.itemKeyDescription,
    acceptsFile: Boolean(config.packFile),
    maxItems: config.maxItems ?? DEFAULT_USER_EXTERNAL_CONNECTION_DATA_MAX_ITEMS,
    maxValueBytes: config.maxValueBytes ?? DEFAULT_USER_EXTERNAL_CONNECTION_DATA_MAX_VALUE_BYTES
  };
}
