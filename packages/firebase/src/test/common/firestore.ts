import { Firestore, FirestoreAccessorDriver, FirestoreContext, firestoreContextFactory, FirestoreDrivers } from '../../lib/common';

// MARK: Test Accessor
export interface TestingFirestoreAccessorDriver extends FirestoreAccessorDriver {
  /**
   * Gets the fuzzed path names map.
   */
  getFuzzedCollectionsNameMap(): Map<string, string>;
  /**
   * Initializes fuzzed path names for the input collections. Returns the result of getFuzzedCollectionsNameMap().
   * 
   * This initialization step is useful for the client, where the rules file needs to be updated to reflect the collection names properly in order to ensure rules are correct.
   * @param collectionPaths 
   */
  initWithCollectionNames(collectionPaths: string[]): Map<string, string>;
}

export function makeTestingFirestoreAccesorDriver(driver: FirestoreAccessorDriver): TestingFirestoreAccessorDriver {
  let fuzzerKey = 0;
  const time = new Date().getTime();
  const fuzzedMap = new Map<string, string>();
  const collection = driver.collection;

  const fuzzedCollectionName = (path: string) => {
    let fuzzedPath: string = fuzzedMap.get(path)!;

    if (!fuzzedPath) {
      fuzzedPath = `${time}_${path}_${fuzzerKey += 1}`;
      fuzzedMap.set(path, fuzzedPath);
    }

    return fuzzedPath;
  };

  const fuzzedCollection = <T>(f: Firestore, path: string) => {
    const fuzzedPath = fuzzedCollectionName(path);
    return collection<T>(f, fuzzedPath);
  };

  const initWithCollectionNames = (collectionPaths: string[]) => {
    collectionPaths.forEach((x) => fuzzedCollectionName(x));
    return fuzzedMap;
  };

  const injectedDriver = {
    ...driver,
    collection: fuzzedCollection,
    getFuzzedCollectionsNameMap: () => fuzzedMap,
    initWithCollectionNames
  } as any;

  return injectedDriver;
}

/**
 * Drivers used for testing. Provides additional functionality for controlling collection access to prevent cross-test contamination.
 */
export interface TestingFirestoreDrivers extends FirestoreDrivers {
  driverType: 'testing';
  firestoreAccessorDriver: TestingFirestoreAccessorDriver;
}

/**
 * Extends the input drivers to generate new drivers for a testing environment.
 * 
 * @param drivers 
 * @returns 
 */
export function makeTestingFirestoreDrivers(drivers: FirestoreDrivers): TestingFirestoreDrivers {
  return {
    ...drivers,
    driverType: 'testing',
    firestoreAccessorDriver: makeTestingFirestoreAccesorDriver(drivers.firestoreAccessorDriver)
  };
}

// MARK: Test Firestore Context
export interface TestingFirestoreContextExtension {
  drivers: TestingFirestoreDrivers;
}

export type TestFirestoreContext<C = FirestoreContext> = C & TestingFirestoreContextExtension;

// MARK: Cleanup
export function clearTestFirestoreContextCollections(context: TestFirestoreContext) {
  const names = context.drivers.firestoreAccessorDriver.getFuzzedCollectionsNameMap();
  const tuples = Array.from(names.entries());

  // todo: clear collections by name

}
