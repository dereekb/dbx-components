import { GrantedSysAdminRole } from '@dereekb/model';
import { AbstractFirestoreDocument } from '../../common/firestore/accessor/document';
import { FirestoreCollection, firestoreModelIdentity } from '../../common/firestore/collection/collection';
import { FirestoreContext } from '../../common/firestore/context';
import { snapshotConverterFunctions } from '../../common/firestore/snapshot/snapshot';
import { CollectionReference } from '../../common/firestore/types';
import { firestorePassThroughField } from '../../common/firestore/snapshot/snapshot.field';
import { mapObjectMap, ModelFieldMapFunctionsConfig, cachedGetter } from '@dereekb/util';

// MARK: Collection
export abstract class SystemStateFirestoreCollections {
  abstract readonly systemStateCollection: SystemStateFirestoreCollection;
}

export type SystemStateTypes = typeof systemStateIdentity;

// MARK: Mock Item
export const systemStateIdentity = firestoreModelIdentity('systemState', 'sys');

/**
 * Used to identify a SystemStateId.
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
 * A collection used for recording the current state of system subcomponents. System states for a given identifier are treated as a system-wide singleton/state/setting.
 *
 * For example, a SystemState with a specific SystemStateId may be relied on for information about the previous update, etc.
 */
export interface SystemState<T extends SystemStateStoredData = SystemStateStoredData> {
  data: T;
}

export type SystemStateRoles = GrantedSysAdminRole;

/**
 * Refers to a singleton SystemState based on this model's identifier.
 */
export class SystemStateDocument<T extends SystemStateStoredData = SystemStateStoredData> extends AbstractFirestoreDocument<SystemState<T>, SystemStateDocument<T>, typeof systemStateIdentity> {
  get modelIdentity() {
    return systemStateIdentity;
  }
}

export const systemStateConverter = snapshotConverterFunctions<SystemState>({
  fields: {
    data: firestorePassThroughField()
  }
});

export function systemStateCollectionReference(context: FirestoreContext): CollectionReference<SystemState> {
  return context.collection(systemStateIdentity.collectionName);
}

export type SystemStateFirestoreCollection<T extends SystemStateStoredData = SystemStateStoredData> = FirestoreCollection<SystemState<T>, SystemStateDocument<T>>;

/**
 * A ModelFieldMapFunctionsConfig used for data conversion.
 */
export type SystemStateStoredDataFieldConverterConfig<T extends SystemStateStoredData = SystemStateStoredData> = ModelFieldMapFunctionsConfig<T, any>;

export type SystemStateStoredDataConverterMap = {
  [key: string]: SystemStateStoredDataFieldConverterConfig<any>;
};

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
