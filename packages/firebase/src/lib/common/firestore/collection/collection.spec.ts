import { firestoreModelIdsFromKey, firestoreModelKeyPartPairs } from '.';
import { childFirestoreModelKeyPath, firestoreModelId, isFirestoreModelId, isFirestoreModelKey, firestoreModelKeys, firestoreModelIdentity, firestoreModelKey, firestoreModelKeyPath } from './collection';

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

describe('firestoreModelId', () => {
  const identity = firestoreModelIdentity('identity', 'i');

  it('should return the id from model key', () => {
    const id = 'test';
    const key = firestoreModelKey(identity, id);
    const result = firestoreModelId(key);
    expect(result).toBe(id);
  });

  it('should return the id from a FirestoreModelIdRef', () => {
    const id = 'test';
    const result = firestoreModelId({
      id
    });
    expect(result).toBe(id);
  });

  it('should return the id from a FirestoreModelKeyRef', () => {
    const id = 'test';
    const key = firestoreModelKey(identity, id);
    const result = firestoreModelId({
      key
    });
    expect(result).toBe(id);
  });

  it('should return the id from model id', () => {
    const id = 'test';
    const result = firestoreModelId(id);
    expect(result).toBe(id);
  });
});

describe('firestoreModelKey', () => {
  const identity = firestoreModelIdentity('identity', 'i');

  it('should create a FirestoreModelKey for the input identity and FirestoreModelKey', () => {
    const id = 'hello';
    const result = firestoreModelKey(identity, id);

    expect(result).toBe(`i/${id}`);
  });
});

describe('firestoreModelKeys', () => {
  const identity = firestoreModelIdentity('identity', 'i');

  it('should create an array of model keys', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const result = firestoreModelKeys(identity, ids);

    expect(result.length).toBe(ids.length);
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

describe('firestoreModelIdsFromKey', () => {
  it('should return the model ids', () => {
    const modelKey = 'a/b/c/d';
    const pairs = firestoreModelIdsFromKey(modelKey);
    expect(pairs).toBeDefined();
    expect(pairs?.length).toBe(2);
    expect(pairs?.[0]).toBe('b');
    expect(pairs?.[1]).toBe('d');
  });
});

describe('isFirestoreModelId', () => {
  it('should pass firestore model ids', () => {
    expect(isFirestoreModelId('a')).toBe(true);
  });

  it('should fail on firestore model keys', () => {
    expect(isFirestoreModelId('a/b')).toBe(false);
  });
});

describe('isFirestoreModelKey', () => {
  it('should pass root firestore model keys', () => {
    expect(isFirestoreModelKey('a/b')).toBe(true);
  });

  it('should pass child firestore model keys', () => {
    expect(isFirestoreModelKey('a/b/c/d')).toBe(true);
  });

  it('should fail on firestore model ids', () => {
    expect(isFirestoreModelKey('a')).toBe(false);
  });

  it('should fail on firestore model ids that end with a slash', () => {
    expect(isFirestoreModelKey('a/')).toBe(false);
  });

  it('should fail on firestore model keys that point to a collection and end with a slash', () => {
    expect(isFirestoreModelKey('a/b/c/')).toBe(false);
  });

  it('should fail on firestore model keys that point to a collection', () => {
    expect(isFirestoreModelKey('a/b/c')).toBe(false);
  });
});

describe('firestoreModelKeyPartPairs', () => {
  it('should return the pairs for the model key', () => {
    const modelKey = 'a/b/c/d';
    const pairs = firestoreModelKeyPartPairs(modelKey);
    expect(pairs).toBeDefined();
    expect(pairs?.length).toBe(2);
    expect(pairs?.[0].collectionName).toBe('a');
    expect(pairs?.[0].id).toBe('b');
  });
});
