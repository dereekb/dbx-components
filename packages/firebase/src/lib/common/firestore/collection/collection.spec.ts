import { firestoreModelIdentity } from './collection';

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
});
