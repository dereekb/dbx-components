import { demoApiFunctionContextFactory, type DemoApiFunctionContextFixture } from '../fixture';

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describe('firebase firestore in tests', () => {
    it('should use the same bucket in the setup app and in the context.', () => {
      const firestoreContext = f.instance.apiNestContext.demoFirestoreCollections.profileCollection.firestoreContext;

      const firestore = firestoreContext.firestore;
      const instanceFirestore = f.instance.firestore;

      expect(firestore).toBe(instanceFirestore);
    });
  });

  describe('firebase storage in tests', () => {
    it('should use the same storage in the app and in the test context.', () => {
      const appStorageService = f.instance.apiNestContext.storageService.storageContext;

      const appStorage = appStorageService.storage;
      const instanceStorage = f.instance.storage;

      expect(appStorage).toBe(instanceStorage);
    });

    it('should refer to the same default bucket in the app and in the test context.', () => {
      const appStorageService = f.instance.apiNestContext.storageService.storageContext;

      const appDefaultBucket = appStorageService.defaultBucket();
      const instanceDefaultBucket = f.instance.storageContext.defaultBucket();

      expect(appDefaultBucket).toBe(instanceDefaultBucket);
    });
  });
});
