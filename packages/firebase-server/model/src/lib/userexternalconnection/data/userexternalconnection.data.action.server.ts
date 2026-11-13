import { Logger } from '@nestjs/common';
import { type Maybe } from '@dereekb/util';
import {
  type FirebaseAuthUserId,
  type FirestoreContextReference,
  normalizeUserExternalConnectionDataItemKey,
  type ReadUserExternalConnectionDataParams,
  type ReadUserExternalConnectionDataResult,
  type UpdateUserExternalConnectionDataParams,
  type UpdateUserExternalConnectionDataResult,
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
import { type UserExternalConnectionDataFirestoreCollectionRef, type UserExternalConnectionStoredDataItems, type UserExternalConnectionStoredDataMap, type UserExternalConnectionStoredProviderData } from './userexternalconnection.data';
import { type UserExternalConnectionDataLimits, type UserExternalConnectionDataTypeRegistry, userExternalConnectionDataLimits } from './userexternalconnection.data.registry';
import { userExternalConnectionDataItemKeyInvalidError, userExternalConnectionDataTooLargeError, userExternalConnectionDataTypeNotAllowedError, userExternalConnectionDataUnreadableError, userExternalConnectionDataValueInvalidError } from './userexternalconnection.data.error';

// MARK: Context
/**
 * Context required by {@link userExternalConnectionDataServerActions}.
 */
export interface UserExternalConnectionDataServerActionsContext extends FirestoreContextReference, UserExternalConnectionDataFirestoreCollectionRef {
  readonly userExternalConnectionDataTypeRegistry: UserExternalConnectionDataTypeRegistry;
  readonly userExternalConnectionDataLimits?: Maybe<Partial<UserExternalConnectionDataLimits>>;
}

// MARK: Inputs
/**
 * Decides whether the caller may see a provider's data. Used to filter a read with no provider named.
 */
export type UserExternalConnectionDataProviderAllowedFunction = (providerType: UserExternalConnectionProviderType) => boolean;

/**
 * Input for {@link UserExternalConnectionDataServerActions.readUserExternalConnectionData}.
 */
export interface ReadUserExternalConnectionDataInput {
  readonly uid: FirebaseAuthUserId;
  readonly params: ReadUserExternalConnectionDataParams;
  /**
   * Filters the providers whose data and data types are returned. Omitted means every provider.
   */
  readonly isProviderAllowed?: Maybe<UserExternalConnectionDataProviderAllowedFunction>;
}

/**
 * Input for {@link UserExternalConnectionDataServerActions.updateUserExternalConnectionData}.
 */
export interface UpdateUserExternalConnectionDataInput {
  readonly uid: FirebaseAuthUserId;
  readonly params: UpdateUserExternalConnectionDataParams;
}

/**
 * Input for {@link UserExternalConnectionDataServerActions.readUserExternalConnectionProviderData}.
 */
export interface ReadUserExternalConnectionProviderDataInput {
  readonly uid: FirebaseAuthUserId;
  readonly providerType: UserExternalConnectionProviderType;
}

/**
 * Input for {@link UserExternalConnectionDataServerActions.deleteUserExternalConnectionData}.
 */
export interface DeleteUserExternalConnectionDataInput {
  readonly uid: FirebaseAuthUserId;
}

// MARK: Actions
/**
 * Server actions over a user's {@link UserExternalConnectionData}. Also the NestJS injection token for itself.
 *
 * These validate; they do not authorize. The calling handler is the authorization layer (always the caller's own
 * uid, the provider's connect policy, and the `data` role on the caller's `/uec` document).
 */
export abstract class UserExternalConnectionDataServerActions {
  /**
   * Reads the user's data, filtered by the params and `isProviderAllowed`, plus the data types the user may store.
   */
  abstract readUserExternalConnectionData(input: ReadUserExternalConnectionDataInput): Promise<ReadUserExternalConnectionDataResult>;
  /**
   * Applies `clear`, then `unset`, then `set` to one provider's data in one transaction.
   */
  abstract updateUserExternalConnectionData(input: UpdateUserExternalConnectionDataInput): Promise<UpdateUserExternalConnectionDataResult>;
  /**
   * The unwrapped values of one provider — the token mint's read. An empty object when there are none.
   */
  abstract readUserExternalConnectionProviderData(input: ReadUserExternalConnectionProviderDataInput): Promise<UserExternalConnectionProviderData>;
  /**
   * Deletes the user's data document.
   */
  abstract deleteUserExternalConnectionData(input: DeleteUserExternalConnectionDataInput): Promise<void>;
}

/**
 * Reference to a {@link UserExternalConnectionDataServerActions} instance.
 */
export interface UserExternalConnectionDataServerActionsRef {
  readonly userExternalConnectionDataActions: UserExternalConnectionDataServerActions;
}

/**
 * Creates the {@link UserExternalConnectionDataServerActions}.
 *
 * @param context - The Firestore context, the data collection, the registry and the limits.
 * @returns The actions.
 */
export function userExternalConnectionDataServerActions(context: UserExternalConnectionDataServerActionsContext): UserExternalConnectionDataServerActions {
  const { firestoreContext, userExternalConnectionDataCollection, userExternalConnectionDataTypeRegistry: registry } = context;
  const limits = userExternalConnectionDataLimits(context.userExternalConnectionDataLimits);
  const logger = new Logger('UserExternalConnectionDataServerActions');

  async function loadStoredDataMap(uid: FirebaseAuthUserId): Promise<UserExternalConnectionStoredDataMap> {
    const document = userExternalConnectionDataCollection.documentAccessor().loadDocumentForId(uid);
    let data: Maybe<{ readonly d: UserExternalConnectionStoredDataMap }>;

    try {
      data = await document.snapshotData();
    } catch {
      throw userExternalConnectionDataUnreadableError();
    }

    return data?.d ?? {};
  }

  return {
    readUserExternalConnectionData: async (input) => {
      const { uid, params, isProviderAllowed } = input;
      const stored = await loadStoredDataMap(uid);
      return readUserExternalConnectionDataResult({ stored, params, registry, isProviderAllowed });
    },
    updateUserExternalConnectionData: async (input) => {
      const { uid, params } = input;
      const { providerType, clear } = params;
      const setCount = params.set?.length ?? 0;
      const unsetCount = params.unset?.length ?? 0;

      assertUserExternalConnectionDataOperationCount(setCount + unsetCount, limits);

      const result = await firestoreContext.runTransaction(async (transaction) => {
        const document = userExternalConnectionDataCollection.documentAccessorForTransaction(transaction).loadDocumentForId(uid);
        let current: Maybe<UserExternalConnectionStoredDataMap>;
        let exists = false;

        try {
          const data = await document.snapshotData();
          exists = data != null;
          current = data?.d;
        } catch {
          // an undecryptable document: only a clear may replace it, since nothing in it can be preserved
          if (!clear) {
            throw userExternalConnectionDataUnreadableError();
          }

          exists = true;
          current = {};
        }

        const isNoop = setCount === 0 && unsetCount === 0 && !clear;
        let next: UserExternalConnectionStoredDataMap = current ?? {};

        if (!isNoop) {
          next = applyUserExternalConnectionDataUpdate({ current, params, registry, limits, now: new Date() });

          if (Object.keys(next).length === 0) {
            if (exists) {
              await document.accessor.delete();
            }
          } else {
            await document.accessor.set({ uid, d: next, uat: new Date() });
          }
        }

        return { next, isNoop };
      });

      if (!result.isNoop) {
        logger.log(`Updated connection data for uid ${uid} provider "${providerType}" (set ${setCount}, unset ${unsetCount}${clear ? ', clear' : ''}; ${userExternalConnectionDataValueByteLength(result.next)} bytes).`);
      }

      return { items: userExternalConnectionDataItemSummaries({ stored: result.next, providerType, registry }) };
    },
    readUserExternalConnectionProviderData: async (input) => {
      const { uid, providerType } = input;
      const stored = await loadStoredDataMap(uid);
      return userExternalConnectionProviderDataValues({ stored: stored[providerType], providerType, registry });
    },
    deleteUserExternalConnectionData: async (input) => {
      await userExternalConnectionDataCollection.documentAccessor().loadDocumentForId(input.uid).accessor.delete();
    }
  };
}

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
