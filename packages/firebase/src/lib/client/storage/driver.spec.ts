import { authorizedTestWithMockItemStorage, describeFirebaseStorageAccessorDriverTests } from '@dereekb/firebase/test';
import { getApp, getApps, initializeApp } from '@firebase/app';
import { connectStorageEmulator, getStorage, ref, getBytes, uploadString, FirebaseStorage } from '@firebase/storage';

describe('firebase storage client', () => {
  authorizedTestWithMockItemStorage((f) => {
    describeFirebaseStorageAccessorDriverTests(f);
  });
});

describe('other tests', () => {
  authorizedTestWithMockItemStorage((f) => {
    it('should test', async () => {
      const storage = f.storage as FirebaseStorage;

      const stateRef = ref(storage, `test/data`);
      await uploadString(stateRef, 'test');

      console.log('Success.');

      const result = await getBytes(stateRef);
      const decoded = Buffer.from(result).toString('utf-8');
      expect(result).toBeDefined();
      expect(decoded).toBe('test');

      console.log('Decoded: ', decoded);
    });
  });
});
