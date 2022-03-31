import { Firestore } from '../../lib/common/firestore/types';
import { FirestoreAccessorDriver } from '../../lib/common/firestore/accessor/driver';
import { FirestoreContext } from '../../lib/common/firestore/context';

let fuzzerKey = 0;

export function injectTestingCollectionNameFuzzerIntoDriver(driver: FirestoreAccessorDriver): FirestoreAccessorDriver {
  const fuzzedMap = new Map<string, string>();
  const fuzzedCollection = <T>(f: Firestore, path: string) => {
    let fuzzedPath: string = fuzzedMap.get(path)!;

    if (!fuzzedPath) {
      fuzzedPath = `${path}_${fuzzerKey += 1}`;
    }

    return driver.collection<T>(f, fuzzedPath);
  };

  return {
    ...driver,
    collection: fuzzedCollection
  };
}

/**
 * Injects testing-related functions into drivers, etc. into a new FirestoreContext object.
 * 
 * @param firestoreContext 
 * @returns 
 */
export function makeTestingFirestoreContext<T extends FirestoreContext>(firestoreContext: T): T {
  return {
    ...firestoreContext,
    drivers: {
      ...firestoreContext.drivers,
      firestoreAccessorDriver: injectTestingCollectionNameFuzzerIntoDriver(firestoreContext.drivers.firestoreAccessorDriver)
    }
  };
}
