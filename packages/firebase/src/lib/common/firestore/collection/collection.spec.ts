import { firestoreModelIdentity, firestoreModelKey } from './collection';

describe('firestoreModelIdentity()', () => {
  const testName = 'testNameWithPieces';

  describe('with only a model name', () => {
    it('should generate a default collection name', () => {
      const identity = firestoreModelIdentity(testName);
      expect(identity.collection).toBe(testName.toLowerCase());
    });

    it('should compile', () => {
      const identity = firestoreModelIdentity(testName);
      expect(identity.collection === 'testnamewithpieces').toBe(true);
    });
  });

  describe('with a model and collection name', () => {
    const testCollectionName = 'tnwp';

    it('should generate a default collection name', () => {
      const identity = firestoreModelIdentity(testName, testCollectionName);
      expect(identity.collection).toBe(testCollectionName);
    });

    it('should compile', () => {
      const identity = firestoreModelIdentity(testName, testCollectionName);
      expect(identity.collection === testCollectionName).toBe(true);
    });
  });

  describe('with a parent', () => {
    const parent = firestoreModelIdentity('parent');

    describe('with only a model name', () => {
      it('should generate a default collection name', () => {
        const identity = firestoreModelIdentity(parent, testName);
        expect(identity.collection).toBe(testName.toLowerCase());
        expect(identity.parent).toBe(parent);
      });

      it('should compile', () => {
        const identity = firestoreModelIdentity(parent, testName);
        expect(identity.collection === 'testnamewithpieces').toBe(true);
        expect(identity.parent).toBe(parent);
      });
    });

    describe('with a model and collection name', () => {
      const testCollectionName = 'tnwp';

      it('should generate a default collection name', () => {
        const identity = firestoreModelIdentity(parent, testName, testCollectionName);
        expect(identity.collection).toBe(testCollectionName);
        expect(identity.parent).toBe(parent);
      });

      it('should compile', () => {
        const identity = firestoreModelIdentity(parent, testName, testCollectionName);
        expect(identity.collection === testCollectionName).toBe(true);
        expect(identity.parent).toBe(parent);
      });
    });
  });
});

describe('firestoreModelKey', () => {
  const identity = firestoreModelIdentity('identity', 'i');

  it('should create a FirestoreModelKey for the input identity and FirestoreModelKey', () => {
    const key = 'hello';
    const result = firestoreModelKey(identity, key);

    expect(result).toBe(`i/${key}`);
  });
});
