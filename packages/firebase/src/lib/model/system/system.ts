import { type GrantedSysAdminRole } from '@dereekb/model';
import { AbstractFirestoreDocument, type FirestoreDocument } from '../../common/firestore/accessor/document';
import { type InterceptFirestoreDataConverterFactory } from '../../common/firestore/accessor/converter';
import { type FirestoreCollection, firestoreModelIdentity } from '../../common/firestore/collection/collection';
import { type FirestoreContext } from '../../common/firestore/context';
import { snapshotConverterFunctions } from '../../common/firestore/snapshot/snapshot';
import { type CollectionReference } from '../../common/firestore/types';
import { firestorePassThroughField } from '../../common/firestore/snapshot/snapshot.field';
import { mapObjectMap, type Maybe, type ModelFieldMapFunctionsConfig, cachedGetter } from '@dereekb/util';

/**
 * @module system
 *
 * Defines the SystemState Firestore model for storing system-wide singleton state and settings.
 *
 * Each {@link SystemState} document is identified by a {@link SystemStateTypeIdentifier} and acts
 * as a singleton for that type — storing arbitrary key-value data about the state of a system
 * subcomponent (e.g., last migration timestamp, feature flags, processing checkpoints).
 *
 * Supports per-type data conversion via the `converterFactory` pattern in
 * {@link systemStateFirestoreCollection}.
 */

// MARK: Collection
/**
 * Abstract base providing access to the SystemState Firestore collection.
 *
 * Implement this in your app module to wire up dependency injection.
 *
 * @dbxModelGroup SystemState
 */
export abstract class SystemStateFirestoreCollections {
  abstract readonly systemStateCollection: SystemStateFirestoreCollection;
}

/**
 * Union of all SystemState-related model identity types.
 */
export type SystemStateTypes = typeof systemStateIdentity;

// MARK: SystemState
/**
 * Model identity for the SystemState collection.
 *
 * NOTE: the second argument of `firestoreModelIdentity()` is the COLLECTION NAME, so this is model
 * type `systemState` stored at the Firestore path `sys/<docId>` — not the other way around.
 * `systemStateCollectionReference()` resolves `identity.collectionName`, and `firestore.rules` match
 * blocks are written against `/sys`.
 */
export const systemStateIdentity = firestoreModelIdentity('systemState', 'sys');

/**
 * Used to identify a SystemStateId.
 *
 * @semanticType
 * @semanticTopic identifier
 * @semanticTopic string
 * @semanticTopic dereekb-firebase:system-state
 */
export type SystemStateTypeIdentifier = string;

/**
 * Used to identify a SystemStateId.
 */
export type SystemStateId = SystemStateTypeIdentifier;

/**
 * Arbitrary data stored within a SystemState. Stored values should always be either a string, number, or boolean.
 */
export type SystemStateStoredData = Record<string, any>;

/**
 * A singleton Firestore document storing the current state of a system subcomponent.
 *
 * Each document is identified by a {@link SystemStateTypeIdentifier} and stores arbitrary
 * key-value data. Used for tracking migration progress, feature flags, processing checkpoints,
 * or any system-wide state that needs persistence.
 *
 * @template T - shape of the stored data record
 * @dbxModel
 * @dbxModelRead system
 * @dbxModelArchetype system-state-singleton
 */
export interface SystemState<T extends SystemStateStoredData = SystemStateStoredData> {
  /**
   * Arbitrary persisted data for this system state singleton.
   *
   * @dbxModelVariable data
   */
  data: T;
}

/**
 * Permission roles for SystemState operations. Restricted to system administrators.
 */
export type SystemStateRoles = GrantedSysAdminRole;

/**
 * Firestore document wrapper for a {@link SystemState} singleton.
 *
 * The document ID serves as the {@link SystemStateTypeIdentifier}, making each
 * SystemState a singleton keyed by its type.
 *
 * @template T - shape of the stored data record
 */
export class SystemStateDocument<T extends SystemStateStoredData = SystemStateStoredData> extends AbstractFirestoreDocument<SystemState<T>, SystemStateDocument<T>, typeof systemStateIdentity> {
  get modelIdentity() {
    return systemStateIdentity;
  }
}

/**
 * Default snapshot converter for {@link SystemState} documents.
 *
 * Uses pass-through conversion for the `data` field. Per-type converters can be
 * supplied via the `converterFactory` in {@link systemStateFirestoreCollection}.
 */
export const systemStateConverter = snapshotConverterFunctions<SystemState>({
  fields: {
    data: firestorePassThroughField()
  }
});

/**
 * Returns the raw Firestore CollectionReference for the SystemState collection.
 *
 * @param context - The Firestore context to use.
 * @returns The CollectionReference for SystemState documents.
 *
 * @example
 * ```ts
 * const colRef = systemStateCollectionReference(firestoreContext);
 * ```
 */
export function systemStateCollectionReference(context: FirestoreContext): CollectionReference<SystemState> {
  return context.collection(systemStateIdentity.collectionName);
}

export type SystemStateFirestoreCollection<T extends SystemStateStoredData = SystemStateStoredData> = FirestoreCollection<SystemState<T>, SystemStateDocument<T>>;

/**
 * A {@link SystemState} collection with any document type.
 *
 * Use this where a consumer only needs to read/write SystemState documents and should accept either
 * the client-shared {@link SystemStateFirestoreCollection} or a server-only variant that uses its own
 * document class (e.g. `SystemStatePrivateFirestoreCollection` in `@dereekb/firebase-server/model`).
 */
export type SystemStateFirestoreCollectionLike<T extends SystemStateStoredData = SystemStateStoredData, D extends FirestoreDocument<SystemState<T>> = FirestoreDocument<SystemState<T>>> = FirestoreCollection<SystemState<T>, D>;

/**
 * Field conversion config for a specific SystemState data type.
 *
 * Maps the typed `data` field to/from Firestore using {@link ModelFieldMapFunctionsConfig}.
 *
 * @template T - shape of the stored data
 */
export type SystemStateStoredDataFieldConverterConfig<T extends SystemStateStoredData = SystemStateStoredData> = ModelFieldMapFunctionsConfig<T, any>;

/**
 * Map of {@link SystemStateTypeIdentifier} to their data field converters.
 *
 * Each entry defines how a specific SystemState type's `data` field is serialized/deserialized.
 */
export type SystemStateStoredDataConverterMap = {
  [key: string]: SystemStateStoredDataFieldConverterConfig<any>;
};

/**
 * What a SystemState collection does when a document's type has no registered converter.
 *
 * - `passthrough`: fall back to the default pass-through converter. Historical behavior, and what
 *   {@link systemStateFirestoreCollection} uses.
 * - `error`: throw. Appropriate for a collection whose types are all known up front — notably a
 *   server-only collection, where silently reading a secret-bearing document through a pass-through
 *   converter would skip its field mapping (dates come back as raw `Timestamp`s, encrypted fields as
 *   raw ciphertext) with nothing to signal it.
 */
export type SystemStateUnknownTypeBehavior = 'passthrough' | 'error';

/**
 * Configuration for {@link systemStateStoredDataConverterFactory}.
 */
export interface SystemStateStoredDataConverterFactoryConfig {
  /**
   * Map of type identifiers to their data field converters.
   */
  readonly converters: SystemStateStoredDataConverterMap;
  /**
   * Behavior when a document's type has no registered converter. Defaults to `passthrough`.
   */
  readonly unknownTypeBehavior?: Maybe<SystemStateUnknownTypeBehavior>;
  /**
   * Collection name used only to make the `error` message actionable.
   */
  readonly collectionName?: Maybe<string>;
}

/**
 * Creates the `converterFactory` for a SystemState collection, selecting a converter by document id
 * (which is the {@link SystemStateTypeIdentifier}).
 *
 * Returning `undefined` is what produces the pass-through fallback — the accessor resolves
 * `converterFactory(ref) ?? defaultConverter`.
 *
 * NOTE for `error`: the factory runs in `loadDocument` / `documentRefForKey`, so an unregistered type
 * throws at document *load*, including while hydrating query results. That is intended for a
 * server-only collection, but it does mean you cannot generically iterate such a collection unless
 * every type it contains is registered.
 *
 * @param config - The converter map and unknown-type behavior.
 * @returns A converter factory suitable for a Firestore collection's `converterFactory`.
 */
export function systemStateStoredDataConverterFactory(config: SystemStateStoredDataConverterFactoryConfig): InterceptFirestoreDataConverterFactory<SystemState> {
  const { converters, unknownTypeBehavior, collectionName } = config;
  const behavior: SystemStateUnknownTypeBehavior = unknownTypeBehavior ?? 'passthrough';

  const mappedConvertersGetter = cachedGetter(() =>
    mapObjectMap(converters, (dataConverter) => {
      return snapshotConverterFunctions<SystemState>({
        fields: {
          data: dataConverter
        }
      });
    })
  );

  return (ref) => {
    const type: SystemStateTypeIdentifier = ref.id;
    const converter = mappedConvertersGetter()[type];

    if (converter == null && behavior === 'error') {
      throw new Error(`systemStateStoredDataConverterFactory: no converter registered for SystemState type "${type}"${collectionName ? ` in collection "${collectionName}"` : ''}. Register it, or use unknownTypeBehavior: 'passthrough'.`);
    }

    return converter;
  };
}

/**
 * Creates a {@link SystemStateFirestoreCollection} with per-type data converters.
 *
 * The `converters` map is used via a `converterFactory` that selects the appropriate
 * converter based on the document ID (which is the {@link SystemStateTypeIdentifier}).
 * Documents with no matching converter use the default pass-through converter.
 *
 * @param firestoreContext - The Firestore context.
 * @param converters - Map of type identifiers to their data field converters.
 * @returns A configured SystemStateFirestoreCollection with per-type data converters.
 *
 * @example
 * ```ts
 * const collection = systemStateFirestoreCollection(firestoreContext, {
 *   'migration_v2': { fields: { lastRun: firestoreDate() } }
 * });
 * const doc = collection.documentAccessor().loadDocumentForId('migration_v2');
 * ```
 */
export function systemStateFirestoreCollection(firestoreContext: FirestoreContext, converters: SystemStateStoredDataConverterMap): SystemStateFirestoreCollection {
  return firestoreContext.firestoreCollection({
    converter: systemStateConverter,
    // 'passthrough' preserves the historical behavior: an unregistered type silently falls back to
    // the default pass-through converter rather than throwing.
    converterFactory: systemStateStoredDataConverterFactory({ converters, unknownTypeBehavior: 'passthrough', collectionName: systemStateIdentity.collectionName }),
    modelIdentity: systemStateIdentity,
    collection: systemStateCollectionReference(firestoreContext),
    makeDocument: (a, d) => {
      return new SystemStateDocument(a, d);
    },
    firestoreContext
  });
}
