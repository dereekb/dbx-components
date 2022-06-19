import { childFirestoreModelKeyPath } from '.';
import { firestoreModelKeys, firestoreModelIdentity, firestoreModelKey, firestoreModelKeyPath } from './collection';

describe('firestoreModelIdentity()', () => {
  const testName = 'testNameWithPieces';

  describe('with only a model name', () => {
    it('should generate a default collection name', () => {
      const identity = firestoreModelIdentity(testName);
      expect(identity.collectionName).toBe(testName.toLowerCase());
    });

    it('should compile', () => {
      const identity = firestoreModelIdentity(testName);
      expect(identity.collectionName === 'testnamewithpieces').toBe(true);
    });
  });

  describe('with a model and collection name', () => {
    const testCollectionName = 'tnwp';

    it('should generate a default collection name', () => {
      const identity = firestoreModelIdentity(testName, testCollectionName);
      expect(identity.collectionName).toBe(testCollectionName);
    });

    it('should compile', () => {
      const identity = firestoreModelIdentity(testName, testCollectionName);
      expect(identity.collectionName === testCollectionName).toBe(true);
    });
  });

  describe('with a parent', () => {
    const parent = firestoreModelIdentity('parent');

    describe('with only a model name', () => {
      it('should generate a default collection name', () => {
        const identity = firestoreModelIdentity(parent, testName);
        expect(identity.collectionName).toBe(testName.toLowerCase());
        expect(identity.parent).toBe(parent);
      });

      it('should compile', () => {
        const identity = firestoreModelIdentity(parent, testName);
        expect(identity.collectionName === 'testnamewithpieces').toBe(true);
        expect(identity.parent).toBe(parent);
      });
    });

    describe('with a model and collection name', () => {
      const testCollectionName = 'tnwp';

      it('should generate a default collection name', () => {
        const identity = firestoreModelIdentity(parent, testName, testCollectionName);
        expect(identity.collectionName).toBe(testCollectionName);
        expect(identity.parent).toBe(parent);
      });

      it('should compile', () => {
        const identity = firestoreModelIdentity(parent, testName, testCollectionName);
        expect(identity.collectionName === testCollectionName).toBe(true);
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

describe('firestoreModelKeys', () => {
  const identity = firestoreModelIdentity('identity', 'i');

  it('should create an array of model keys', () => {
    const keys = ['a', 'b', 'c', 'd'];
    const result = firestoreModelKeys(identity, keys);

    expect(result.length).toBe(keys.length);
  });
});

describe('firestoreModelKeyPath', () => {
  const identity = firestoreModelIdentity('identity', 'i');

  it('should join the input paths', () => {
    const key = 'hello';
    const result = firestoreModelKeyPath(firestoreModelKey(identity, key), firestoreModelKey(identity, key));

    expect(result).toBeDefined();
    expect(result).toBe([`i/${key}`, `i/${key}`].join('/'));
  });
});

describe('childFirestoreModelKeyPath', () => {
  const identity = firestoreModelIdentity('identity', 'i');

  it('should create a child path', () => {
    const key = 'hello';
    const parent = firestoreModelKey(identity, key);
    const child = firestoreModelKey(identity, key);
    const result = childFirestoreModelKeyPath(parent, child);

    expect(result.length).toBe(1);
    expect(result[0]).toBe([`i/${key}`, `i/${key}`].join('/'));
  });

  describe('with array input', () => {
    it('should create a child path', () => {
      const key = 'hello';
      const parent = firestoreModelKey(identity, key);
      const children = [firestoreModelKey(identity, key)];
      const result = childFirestoreModelKeyPath(parent, children);

      expect(result.length).toBe(1);
      expect(result[0]).toBe([`i/${key}`, `i/${key}`].join('/'));
    });
  });
});
