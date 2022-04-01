import { firestoreContextFactory } from '@dereekb/firebase';
import { Firestore } from '../../lib/common/firestore/types';
import { FirestoreAccessorDriver } from '../../lib/common/firestore/accessor/driver';
import { FirestoreContext } from '../../lib/common/firestore/context';

export function injectTestingCollectionNameFuzzerIntoDriver(driver: FirestoreAccessorDriver): FirestoreAccessorDriver {
  let fuzzerKey = 0;
  const fuzzerBase = new Date().getTime();
  const fuzzedMap = new Map<string, string>();
  const collection = driver.collection;

  const fuzzedCollection = <T>(f: Firestore, path: string) => {
    let fuzzedPath: string = fuzzedMap.get(path)!;

    if (!fuzzedPath) {
      fuzzedPath = `${fuzzerBase}_${path}_${fuzzerKey += 1}`;
      fuzzedMap.set(path, fuzzedPath);
    }

    console.log('afsdfasdf path: ', fuzzedPath);

    return collection<T>(f, fuzzedPath);
  };

  const injectedDriver = {
    ...driver,
    collection: fuzzedCollection,
    hello: 'test'
  } as any;

  console.log('Injected: ', injectedDriver);

  return injectedDriver;
}

/**
 * Injects testing-related functions into drivers, etc. into a new FirestoreContext object.
 * 
 * @param firestoreContext 
 * @returns 
 */
export function makeTestingFirestoreContext<T, C extends FirestoreContext<T>>(firestoreContext: C): C {
  const drivers = {
    ...firestoreContext.drivers,
    firestoreAccessorDriver: injectTestingCollectionNameFuzzerIntoDriver(firestoreContext.drivers.firestoreAccessorDriver)
  };

  console.log('Make testing context', drivers);

  return firestoreContextFactory<T>(drivers)(firestoreContext.firestore) as C;
}
