import { Maybe, PromiseUtility } from '@dereekb/util';
import { DocumentReference, Firestore, FirestoreAccessorDriver, FirestoreContext, FirestoreDrivers } from '@dereekb/firebase';

// MARK: Test Accessor
/**
 * Used to override/extend a FirestoreAccessorDriver to provide better isolation between tests.
 */
export interface TestingFirestoreAccessorDriver extends FirestoreAccessorDriver {
  /**
   * Gets the fuzzed path names map.
   */
  getFuzzedCollectionsNameMap(): Map<string, string>;
  /**
   * Initializes fuzzed path names for the input collections. Returns the result of getFuzzedCollectionsNameMap().
   *
   * This initialization step is useful for the client, where the rules file needs to be updated to reflect the collection names properly in order to ensure rules are correct.
   * @param collectionNames
   */
  initWithCollectionNames(collectionNames: string[]): Map<string, string>;
}

export function makeTestingFirestoreAccesorDriver(driver: FirestoreAccessorDriver): TestingFirestoreAccessorDriver {
  let fuzzerKey = 0;
  const time = new Date().getTime();
  const fuzzedMap = new Map<string, string>();
  const { collection, subcollection, collectionGroup } = driver;

  const fuzzedPathForPath = (path: string) => {
    let fuzzedPath: Maybe<string> = fuzzedMap.get(path);

    if (!fuzzedPath) {
      const random = Math.ceil(Math.random() * 9999) % 9999;
      fuzzedPath = `${time}_${random}_${path}_${(fuzzerKey += 1)}`;
      fuzzedMap.set(path, fuzzedPath);
    }

    return fuzzedPath;
  };

  const fuzzedCollection = <T>(f: Firestore, path: string) => {
    const fuzzedPath = fuzzedPathForPath(path);
    return collection<T>(f, fuzzedPath);
  };

  const fuzzedSubcollection = <T>(document: DocumentReference, path: string, ...pathSegments: string[]) => {
    const fuzzedPath = fuzzedPathForPath(path);
    const fuzzedPathSegments = pathSegments.map((x) => fuzzedPathForPath(x));
    return subcollection<T>(document, fuzzedPath, ...fuzzedPathSegments);
  };

  const fuzzedCollectionGroup = <T>(f: Firestore, collectionId: string) => {
    const fuzzedPath = fuzzedPathForPath(collectionId);
    return collectionGroup<T>(f, fuzzedPath);
  };

  const initWithCollectionNames = (collectionNames: string[]) => {
    collectionNames.forEach((x) => fuzzedPathForPath(x));
    return fuzzedMap;
  };

  const injectedDriver: TestingFirestoreAccessorDriver = {
    ...driver,
    collection: fuzzedCollection,
    collectionGroup: fuzzedCollectionGroup,
    subcollection: fuzzedSubcollection,
    getFuzzedCollectionsNameMap: () => fuzzedMap,
    initWithCollectionNames
  };

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
export type ClearTestFirestoreCollectionFunction = (collectionName: string, realCollectionName: string) => Promise<void>;

export async function clearTestFirestoreContextCollections(context: TestFirestoreContext, clearCollection: ClearTestFirestoreCollectionFunction): Promise<void> {
  const names = context.drivers.firestoreAccessorDriver.getFuzzedCollectionsNameMap();
  const tuples = Array.from(names.entries());
  await PromiseUtility.performTasks(tuples, ([name, fuzzyPath]) => clearCollection(name, fuzzyPath));
}
