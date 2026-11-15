import { type Maybe } from '@dereekb/util';
import {
  normalizeUserExternalConnectionDataItemKey,
  type ReadUserExternalConnectionDataParams,
  type ReadUserExternalConnectionDataResult,
  type UpdateUserExternalConnectionDataParams,
  type UserExternalConnectionDataItemKey,
  type UserExternalConnectionDataItemSummary,
  type UserExternalConnectionDataItems,
  type UserExternalConnectionDataMap,
  type UserExternalConnectionDataTypeConfig,
  type UserExternalConnectionDataTypeKey,
  type UserExternalConnectionDataValue,
  type UserExternalConnectionProviderData,
  type UserExternalConnectionProviderType,
  userExternalConnectionDataTypeSummary,
  userExternalConnectionDataValueByteLength
} from '@dereekb/firebase';
import { type UserExternalConnectionStoredDataItems, type UserExternalConnectionStoredDataMap, type UserExternalConnectionStoredProviderData } from './userexternalconnection.data';
import { type UserExternalConnectionDataLimits, type UserExternalConnectionDataTypeRegistry } from './userexternalconnection.data.registry';
import { userExternalConnectionDataItemKeyInvalidError, userExternalConnectionDataTooLargeError, userExternalConnectionDataTypeNotAllowedError, userExternalConnectionDataValueInvalidError } from './userexternalconnection.data.error';

/*
 * Pure helpers over a decrypted UserExternalConnectionData map: building read results, unwrapping values, and applying
 * an update. They do no I/O. The actions that load and write the document live on UserExternalConnectionServerActions.
 */

// MARK: Provider Filter
/**
 * Decides whether the caller may see a provider's data. Used to filter a read with no provider named.
 */
export type UserExternalConnectionDataProviderAllowedFunction = (providerType: UserExternalConnectionProviderType) => boolean;

// MARK: Read
/**
 * Input for {@link readUserExternalConnectionDataResult}.
 */
export interface ReadUserExternalConnectionDataResultInput {
  readonly stored: Maybe<UserExternalConnectionStoredDataMap>;
  readonly params: ReadUserExternalConnectionDataParams;
  readonly registry: UserExternalConnectionDataTypeRegistry;
  readonly isProviderAllowed?: Maybe<UserExternalConnectionDataProviderAllowedFunction>;
}

/**
 * Builds a read result from a stored map. Only registered data types of allowed providers are returned.
 *
 * @param input - The stored map, the params, the registry and the provider filter.
 * @returns The read result.
 */
export function readUserExternalConnectionDataResult(input: ReadUserExternalConnectionDataResultInput): ReadUserExternalConnectionDataResult {
  const { stored, params, registry, isProviderAllowed } = input;
  const { providerType, dataType, itemKey, keysOnly } = params;
  const isAllowed = (p: UserExternalConnectionProviderType) => (providerType == null || p === providerType) && (isProviderAllowed == null || isProviderAllowed(p));
  const configs = registry.configs.filter((config) => isAllowed(config.providerType) && (dataType == null || config.dataType === dataType));

  const data: Record<UserExternalConnectionProviderType, Record<UserExternalConnectionDataTypeKey, Record<UserExternalConnectionDataItemKey, UserExternalConnectionDataValue>>> = {};
  const items: UserExternalConnectionDataItemSummary[] = [];

  for (const config of configs) {
    const storedItems = stored?.[config.providerType]?.[config.dataType];

    if (storedItems) {
      const wantedKey = itemKey == null ? undefined : (normalizeUserExternalConnectionDataItemKey(config, itemKey) ?? itemKey);

      for (const [key, item] of Object.entries(storedItems)) {
        if (wantedKey == null || key === wantedKey) {
          items.push(userExternalConnectionDataItemSummary(config.providerType, config.dataType, key, item));

          if (!keysOnly) {
            const providerData = (data[config.providerType] ??= {});
            const typeData = (providerData[config.dataType] ??= {});
            typeData[key] = item.v;
          }
        }
      }
    }
  }

  return {
    data: keysOnly ? undefined : (data as UserExternalConnectionDataMap),
    items: sortUserExternalConnectionDataItemSummaries(items),
    dataTypes: configs.map(userExternalConnectionDataTypeSummary)
  };
}

/**
 * Input for {@link userExternalConnectionProviderDataValues}.
 */
export interface UserExternalConnectionProviderDataValuesInput {
  readonly stored: Maybe<UserExternalConnectionStoredProviderData>;
  readonly providerType: UserExternalConnectionProviderType;
  readonly registry: UserExternalConnectionDataTypeRegistry;
}

/**
 * Unwraps one provider's stored items into plain values, keeping only registered data types.
 *
 * @param input - The provider's stored data and the registry.
 * @returns The provider data values; an empty object when there are none.
 */
export function userExternalConnectionProviderDataValues(input: UserExternalConnectionProviderDataValuesInput): UserExternalConnectionProviderData {
  const { stored, providerType, registry } = input;
  const result: Record<UserExternalConnectionDataTypeKey, UserExternalConnectionDataItems> = {};

  if (stored) {
    for (const [dataType, storedItems] of Object.entries(stored)) {
      if (registry.configFor(providerType, dataType)) {
        const values = Object.fromEntries(Object.entries(storedItems).map(([key, item]) => [key, item.v]));

        if (Object.keys(values).length > 0) {
          result[dataType] = values;
        }
      }
    }
  }

  return result;
}

// MARK: Summaries
/**
 * Builds the summary of one stored item.
 *
 * @param providerType - The provider.
 * @param dataType - The data type.
 * @param itemKey - The item key.
 * @param item - The stored item.
 * @returns The summary.
 */
export function userExternalConnectionDataItemSummary(providerType: UserExternalConnectionProviderType, dataType: UserExternalConnectionDataTypeKey, itemKey: UserExternalConnectionDataItemKey, item: { readonly v: unknown; readonly uat: string }): UserExternalConnectionDataItemSummary {
  return { providerType, dataType, itemKey, bytes: userExternalConnectionDataValueByteLength(item.v), updatedAt: item.uat };
}

function sortUserExternalConnectionDataItemSummaries(items: UserExternalConnectionDataItemSummary[]): UserExternalConnectionDataItemSummary[] {
  return items.sort((a, b) => a.providerType.localeCompare(b.providerType) || a.dataType.localeCompare(b.dataType) || a.itemKey.localeCompare(b.itemKey));
}

/**
 * Input for {@link userExternalConnectionDataItemSummaries}.
 */
export interface UserExternalConnectionDataItemSummariesInput {
  readonly stored: Maybe<UserExternalConnectionStoredDataMap>;
  readonly providerType: UserExternalConnectionProviderType;
  readonly registry: UserExternalConnectionDataTypeRegistry;
}

/**
 * Lists the summaries of one provider's registered items.
 *
 * @param input - The stored map, the provider and the registry.
 * @returns The sorted summaries.
 */
export function userExternalConnectionDataItemSummaries(input: UserExternalConnectionDataItemSummariesInput): UserExternalConnectionDataItemSummary[] {
  const { stored, providerType, registry } = input;
  return readUserExternalConnectionDataResult({ stored, params: { providerType, keysOnly: true }, registry }).items as UserExternalConnectionDataItemSummary[];
}

// MARK: Update
/**
 * Refuses an update with more operations than the limit allows.
 *
 * @param count - The number of set + unset operations.
 * @param limits - The limits.
 * @throws {HttpsError} `USER_EXTERNAL_CONNECTION_DATA_TOO_LARGE_ERROR` with scope `operations`.
 */
export function assertUserExternalConnectionDataOperationCount(count: number, limits: UserExternalConnectionDataLimits): void {
  if (count > limits.maxOperations) {
    throw userExternalConnectionDataTooLargeError({ scope: 'operations', limit: limits.maxOperations, count });
  }
}

/**
 * Input for {@link applyUserExternalConnectionDataUpdate}.
 */
export interface ApplyUserExternalConnectionDataUpdateInput {
  /**
   * The current stored map. Pass `{}` for an unreadable document being cleared.
   */
  readonly current: Maybe<UserExternalConnectionStoredDataMap>;
  readonly params: Pick<UpdateUserExternalConnectionDataParams, 'providerType' | 'set' | 'unset' | 'clear'>;
  readonly registry: UserExternalConnectionDataTypeRegistry;
  readonly limits: UserExternalConnectionDataLimits;
  readonly now: Date;
}

function requireDataTypeConfig(registry: UserExternalConnectionDataTypeRegistry, providerType: UserExternalConnectionProviderType, dataType: UserExternalConnectionDataTypeKey): UserExternalConnectionDataTypeConfig {
  const config = typeof dataType === 'string' ? registry.configFor(providerType, dataType) : undefined;

  if (!config) {
    throw userExternalConnectionDataTypeNotAllowedError(providerType, String(dataType));
  }

  return config;
}

function requireItemKey(config: UserExternalConnectionDataTypeConfig, itemKey: string): UserExternalConnectionDataItemKey {
  const key = normalizeUserExternalConnectionDataItemKey(config, itemKey);

  if (key == null) {
    throw userExternalConnectionDataItemKeyInvalidError(config.providerType, config.dataType, config.itemKeyDescription);
  }

  return key;
}

function isPlainJsonObject(value: unknown): value is UserExternalConnectionDataValue {
  return value != null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

/**
 * Reads the first failing path off an arktype result, without the message (which can quote the value).
 *
 * @param result - The arktype call result.
 * @returns The first failing path, if any.
 */
function firstArkErrorPath(result: unknown): Maybe<string> {
  const first = Array.isArray(result) ? (result[0] as Maybe<{ readonly propString?: unknown }>) : undefined;
  const path = first?.propString;
  return typeof path === 'string' && path.length > 0 ? path : undefined;
}

/**
 * Applies one update to a stored map and returns the COMPLETE next map. Pure: validates every operation and every
 * limit, and throws on the first failure. Errors never carry a value.
 *
 * Order: `clear` (drops the provider's data), then each `unset`, then each `set`. Empty data-type and provider maps
 * are pruned.
 *
 * @param input - The current map, the update, the registry, the limits and the write instant.
 * @returns The next stored map.
 */
export function applyUserExternalConnectionDataUpdate(input: ApplyUserExternalConnectionDataUpdateInput): UserExternalConnectionStoredDataMap {
  const { current, params, registry, limits, now } = input;
  const { providerType, set, unset, clear } = params;

  assertUserExternalConnectionDataOperationCount((set?.length ?? 0) + (unset?.length ?? 0), limits);

  const providerData: UserExternalConnectionStoredProviderData = {};

  if (!clear) {
    for (const [dataType, items] of Object.entries(current?.[providerType] ?? {})) {
      providerData[dataType] = { ...items };
    }
  }

  // unset
  for (const op of unset ?? []) {
    const config = requireDataTypeConfig(registry, providerType, op.dataType);

    if (op.itemKey == null) {
      delete providerData[config.dataType];
    } else {
      const key = requireItemKey(config, op.itemKey);
      const items = providerData[config.dataType];

      if (items) {
        delete items[key];
      }
    }
  }

  // set
  const touchedDataTypes = new Set<UserExternalConnectionDataTypeConfig>();
  const uat = now.toISOString();

  for (const op of set ?? []) {
    const config = requireDataTypeConfig(registry, providerType, op.dataType);
    const key = requireItemKey(config, op.itemKey);
    const value = op.value;

    if (!isPlainJsonObject(value)) {
      throw userExternalConnectionDataValueInvalidError({ providerType, dataType: config.dataType, itemKey: key });
    }

    if (!config.valueType.allows(value)) {
      throw userExternalConnectionDataValueInvalidError({ providerType, dataType: config.dataType, itemKey: key, path: firstArkErrorPath(config.valueType(value)) });
    }

    const bytes = userExternalConnectionDataValueByteLength(value);
    const maxValueBytes = registry.maxValueBytesFor(config);

    if (bytes > maxValueBytes) {
      throw userExternalConnectionDataTooLargeError({ scope: 'value', limit: maxValueBytes, bytes, providerType, dataType: config.dataType });
    }

    const items: UserExternalConnectionStoredDataItems = (providerData[config.dataType] ??= {});
    items[key] = { v: value, uat };
    touchedDataTypes.add(config);
  }

  for (const config of touchedDataTypes) {
    const count = Object.keys(providerData[config.dataType] ?? {}).length;
    const maxItems = registry.maxItemsFor(config);

    if (count > maxItems) {
      throw userExternalConnectionDataTooLargeError({ scope: 'items', limit: maxItems, count, providerType, dataType: config.dataType });
    }
  }

  // prune
  for (const [dataType, items] of Object.entries(providerData)) {
    if (Object.keys(items).length === 0) {
      delete providerData[dataType];
    }
  }

  const next: UserExternalConnectionStoredDataMap = { ...current };

  if (Object.keys(providerData).length === 0) {
    delete next[providerType];
  } else {
    next[providerType] = providerData;
  }

  const documentBytes = userExternalConnectionDataValueByteLength(next);

  if (documentBytes > limits.maxDocumentBytes) {
    throw userExternalConnectionDataTooLargeError({ scope: 'document', limit: limits.maxDocumentBytes, bytes: documentBytes });
  }

  return next;
}
