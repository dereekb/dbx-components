import { type GrantedSysAdminRole } from '@dereekb/model';
import { AbstractFirestoreDocument } from '../../common/firestore/accessor/document';
import { type FirestoreCollection, firestoreModelIdentity } from '../../common/firestore/collection/collection';
import { type FirestoreContext } from '../../common/firestore/context';
import { snapshotConverterFunctions } from '../../common/firestore/snapshot/snapshot';
import { type CollectionReference } from '../../common/firestore/types';
import { firestorePassThroughField } from '../../common/firestore/snapshot/snapshot.field';
import { mapObjectMap, type ModelFieldMapFunctionsConfig, cachedGetter } from '@dereekb/util';

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
 * Model identity for the SystemState collection (collection name: `systemState`, prefix: `sys`).
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
 */
export interface SystemState<T extends SystemStateStoredData = SystemStateStoredData> {
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
 * @example
 * ```ts
 * const colRef = systemStateCollectionReference(firestoreContext);
 * ```
 *
 * @param context - the Firestore context to use
 * @returns the CollectionReference for SystemState documents
 */
export function systemStateCollectionReference(context: FirestoreContext): CollectionReference<SystemState> {
  return context.collection(systemStateIdentity.collectionName);
}

export type SystemStateFirestoreCollection<T extends SystemStateStoredData = SystemStateStoredData> = FirestoreCollection<SystemState<T>, SystemStateDocument<T>>;

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
 * Creates a {@link SystemStateFirestoreCollection} with per-type data converters.
 *
 * The `converters` map is used via a `converterFactory` that selects the appropriate
 * converter based on the document ID (which is the {@link SystemStateTypeIdentifier}).
 * Documents with no matching converter use the default pass-through converter.
 *
 * @param firestoreContext - the Firestore context
 * @param converters - map of type identifiers to their data field converters
 * @returns a configured SystemStateFirestoreCollection with per-type data converters
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
  const mappedConvertersGetter = cachedGetter(() =>
    mapObjectMap(converters, (dataConverter) => {
      return snapshotConverterFunctions<SystemState>({
        fields: {
          data: dataConverter
        }
      });
    })
  );

  return firestoreContext.firestoreCollection({
    converter: systemStateConverter,
    converterFactory: (ref) => {
      const type: SystemStateTypeIdentifier = ref.id;
      return mappedConvertersGetter()[type];
    },
    modelIdentity: systemStateIdentity,
    collection: systemStateCollectionReference(firestoreContext),
    makeDocument: (a, d) => {
      return new SystemStateDocument(a, d);
    },
    firestoreContext
  });
}
