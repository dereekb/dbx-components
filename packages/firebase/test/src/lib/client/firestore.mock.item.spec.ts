import { isDate } from 'date-fns';
import { DocumentData, SystemState, SystemStateDocument } from '@dereekb/firebase';
import { CollectionReference, doc, getDoc, setDoc } from 'firebase/firestore';
import { MockSystemData, MOCK_SYSTEM_STATE_TYPE } from '../common/mock/mock.item';
import { MockItemCollectionFixture, testWithMockItemCollectionFixture } from '../common/mock/mock.item.collection.fixture';
import { authorizedFirebaseFactory } from './firebase.authorized';

describe('testWithMockItemFixture', () => {
  const testWrapper = testWithMockItemCollectionFixture()(authorizedFirebaseFactory);

  testWrapper((f: MockItemCollectionFixture) => {
    it('should create a document', async () => {
      const documentRef = doc(f.instance.collection as CollectionReference);

      await setDoc(documentRef, {
        test: true
      });

      const snapshot = await getDoc(documentRef);

      expect(snapshot).toBeDefined();
      expect(snapshot.exists()).toBe(true);
    });

    describe('mock item system state', () => {
      it('should save the system state type using the correct converter based off of the id type.', async () => {
        const systemStateDocument = f.instance.mockItemSystemState.documentAccessor().loadDocumentForId(MOCK_SYSTEM_STATE_TYPE) as SystemStateDocument<MockSystemData>;
        await systemStateDocument.create({ data: {} as MockSystemData });

        let result = (await systemStateDocument.snapshotData()) as SystemState<MockSystemData>;

        expect(result.data.lat).toBeDefined();
        expect(isDate(result.data.lat)).toBe(true); // should set the default date

        let rawData = (await systemStateDocument.accessor.getWithConverter(null).then((x) => x.data())) as DocumentData;
        expect(rawData.data.lat).toBeDefined();
        expect(typeof rawData.data.lat).toBe('string');

        // then update it and pass the same data
        await systemStateDocument.update({
          data: {
            ...result.data
          }
        });

        result = (await systemStateDocument.snapshotData()) as SystemState<MockSystemData>;

        expect(result.data.lat).toBeDefined();
        expect(isDate(result.data.lat)).toBe(true); // should still be a date

        // raw data should have saved a string still
        rawData = (await systemStateDocument.accessor.getWithConverter(null).then((x) => x.data())) as DocumentData;

        expect(rawData.data.lat).toBeDefined();
        expect(typeof rawData.data.lat).toBe('string');
      });
    });
  });
});
