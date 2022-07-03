import { Storage as FirebaseAdminStorage } from 'firebase-admin/lib/storage/storage';
import { Storage as GoogleCloudStorage } from '@google-cloud/storage';
import { TestFirebaseStorageContext, TestFirebaseStorageInstance, TestFirebaseStorageContextFixture, TestingFirebaseStorageDrivers, makeTestingFirebaseStorageDrivers } from '@dereekb/firebase/test';
import { jestTestContextBuilder } from '@dereekb/util/test';
import { googleCloudFirebaseStorageDrivers } from '@dereekb/firebase-server';
import { FirebaseStorage, firebaseStorageContextFactory } from '@dereekb/firebase';

export interface GoogleCloudTestFirebaseStorageConfig {
  host: string;
  port: number;
}

export type GoogleCloudTestFirebaseStorageContext = TestFirebaseStorageContext;

export function makeGoogleFirebaseStorageContext(drivers: TestingFirebaseStorageDrivers, firebaseStorage: FirebaseStorage, defaultBucketId?: string): TestFirebaseStorageContext {
  const context = firebaseStorageContextFactory(drivers)(firebaseStorage, { defaultBucketId }) as GoogleCloudTestFirebaseStorageContext;
  context.drivers = drivers;
  return context;
}

export class GoogleCloudTestFirebaseStorageInstance extends TestFirebaseStorageInstance {
  constructor(drivers: TestingFirebaseStorageDrivers, firebaseStorage: FirebaseStorage, defaultBucketId?: string) {
    super(makeGoogleFirebaseStorageContext(drivers, firebaseStorage, defaultBucketId));
  }
}

export class GoogleCloudTestFirebaseStorageContextFixture extends TestFirebaseStorageContextFixture<GoogleCloudTestFirebaseStorageInstance> {}

let COUNTER = 0;

/**
 * A JestTestContextBuilderFunction for building firebase storage test context factories using @google-cloud/storage. This means SERVER TESTING ONLY. For client testing, look at @dereekb/firestore.
 *
 * This is used to build a @google-cloud/storage FirebaseStorage instance for testing and point it to the emulators.
 *
 * If you need all of Firebase (firebase-admin library), look at adminFirebaseAdminTestBuilder() instead.
 */
export const googleCloudTestFirebaseStorageBuilder = jestTestContextBuilder<GoogleCloudTestFirebaseStorageInstance, GoogleCloudTestFirebaseStorageContextFixture, GoogleCloudTestFirebaseStorageConfig>({
  buildConfig: (input?: Partial<GoogleCloudTestFirebaseStorageConfig>) => {
    const config: GoogleCloudTestFirebaseStorageConfig = {
      host: input?.host ?? 'localhost',
      port: input?.port ?? 0
    };

    if (!config.port) {
      throw new Error('Port for host is required.');
    }

    return config;
  },
  buildFixture: () => new GoogleCloudTestFirebaseStorageContextFixture(),
  setupInstance: async (config) => {
    const drivers = makeTestingFirebaseStorageDrivers(googleCloudFirebaseStorageDrivers());

    const projectId = `firebase-storage-server-test-${new Date().getTime()}-${COUNTER++}`;
    const firebaseStorage = new GoogleCloudStorage({
      projectId,
      // ensure http:// is provided so the library doesn't default to/try https://
      apiEndpoint: `http://${config.host}:${config.port}`
    });

    const defaultBucketId = projectId;
    return new GoogleCloudTestFirebaseStorageInstance(drivers, firebaseStorage, defaultBucketId);
  },
  teardownInstance: async (instance, config) => {
    // nothing to teardown
  }
});
