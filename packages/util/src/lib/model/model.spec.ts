import { uniqueKeys, uniqueModels, readModelKey, readModelKeyFromObject, readModelKeysFromObjects, readModelKeys, isModelKey, throwKeyIsRequired, makeModelMap, makeMultiModelKeyMap, removeModelsWithKey, removeModelsWithSameKey, symmetricDifferenceWithModels, useModelOrKey, encodeModelKeyTypePair, decodeModelKeyTypePair, modelTypeDataPairFactory, type UniqueModel } from '@dereekb/util';

interface TestModel extends UniqueModel {
  name: string;
}

describe('uniqueKeys()', () => {
  it('should return unique keys as an array', () => {
    const result = uniqueKeys(['a', 'b', 'a', 'c']);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('should return an empty array for empty input', () => {
    expect(uniqueKeys([])).toEqual([]);
  });
});

describe('uniqueModels()', () => {
  it('should deduplicate models by their id', () => {
    const models: TestModel[] = [
      { id: '1', name: 'first' },
      { id: '2', name: 'second' },
      { id: '1', name: 'duplicate' }
    ];

    const result = uniqueModels(models);
    expect(result.length).toBe(2);
    expect(result[0].name).toBe('first');
  });

  it('should use a custom read function', () => {
    const models: TestModel[] = [
      { id: '1', name: 'a' },
      { id: '2', name: 'a' },
      { id: '3', name: 'b' }
    ];

    const result = uniqueModels(models, (x) => x.name);
    expect(result.length).toBe(2);
  });
});

describe('readModelKey()', () => {
  it('should return the string key if input is a string', () => {
    expect(readModelKey('abc')).toBe('abc');
  });

  it('should read the id from a model object', () => {
    expect(readModelKey({ id: '123' })).toBe('123');
  });

  it('should return undefined for undefined input', () => {
    expect(readModelKey(undefined)).toBeUndefined();
  });

  it('should throw if required and key is missing', () => {
    expect(() => readModelKey(undefined, { required: true, read: (x: UniqueModel) => x.id })).toThrow();
  });
});

describe('readModelKeyFromObject()', () => {
  it('should read the id from a model', () => {
    expect(readModelKeyFromObject({ id: '42' })).toBe('42');
  });

  it('should return undefined if model has no id', () => {
    expect(readModelKeyFromObject({})).toBeUndefined();
  });

  it('should throw if required and no id', () => {
    expect(() => readModelKeyFromObject({}, true)).toThrow();
  });
});

describe('readModelKeysFromObjects()', () => {
  it('should read keys from an array of models', () => {
    const models: UniqueModel[] = [{ id: '1' }, { id: '2' }];
    const result = readModelKeysFromObjects(models);
    expect(result).toEqual(['1', '2']);
  });
});

describe('readModelKeys()', () => {
  it('should extract keys from a mix of models and strings', () => {
    const input: (TestModel | string | undefined)[] = [{ id: '1', name: 'a' }, '2', undefined];
    const result = readModelKeys(input);
    expect(result).toEqual(['1', '2', undefined]);
  });
});

describe('isModelKey()', () => {
  it('should return true for strings', () => {
    expect(isModelKey('abc')).toBe(true);
  });

  it('should return false for objects', () => {
    expect(isModelKey({ id: '1' })).toBe(false);
  });
});

describe('throwKeyIsRequired()', () => {
  it('should throw an error', () => {
    expect(() => throwKeyIsRequired()).toThrow('Key was required.');
  });
});

describe('removeModelsWithKey()', () => {
  it('should remove models with the specified key', () => {
    const models: TestModel[] = [
      { id: '1', name: 'a' },
      { id: '2', name: 'b' },
      { id: '3', name: 'c' }
    ];

    const result = removeModelsWithKey(models, '2');
    expect(result.length).toBe(2);
    expect(result.find((x) => x.id === '2')).toBeUndefined();
  });
});

describe('removeModelsWithSameKey()', () => {
  it('should remove models sharing the same key as the reference model', () => {
    const models: TestModel[] = [
      { id: '1', name: 'a' },
      { id: '2', name: 'b' }
    ];
    const ref: TestModel = { id: '1', name: 'ref' };

    const result = removeModelsWithSameKey(models, ref, (x) => x.id);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('2');
  });
});

describe('makeModelMap()', () => {
  it('should create a map from key to model', () => {
    const models: TestModel[] = [
      { id: '1', name: 'a' },
      { id: '2', name: 'b' }
    ];

    const map = makeModelMap(models);
    expect(map.get('1')?.name).toBe('a');
    expect(map.get('2')?.name).toBe('b');
    expect(map.size).toBe(2);
  });
});

describe('makeMultiModelKeyMap()', () => {
  it('should index a model by multiple keys', () => {
    const items = [{ id: '1', tags: ['a', 'b'] }];
    const map = makeMultiModelKeyMap(items, (x) => x.tags);

    expect(map.get('a')).toBe(items[0]);
    expect(map.get('b')).toBe(items[0]);
  });
});

describe('symmetricDifferenceWithModels()', () => {
  it('should find keys in one array but not the other', () => {
    const a: UniqueModel[] = [{ id: '1' }, { id: '2' }];
    const b: UniqueModel[] = [{ id: '2' }, { id: '3' }];

    const result = symmetricDifferenceWithModels(a, b);
    expect(result).toContain('1');
    expect(result).toContain('3');
    expect(result).not.toContain('2');
  });
});

describe('useModelOrKey()', () => {
  it('should call useKey for a string input', () => {
    const result = useModelOrKey<string, UniqueModel>('abc', {
      useKey: (key) => `key:${key}`
    });
    expect(result).toBe('key:abc');
  });

  it('should call useModel for a model input', () => {
    const model: UniqueModel = { id: '1' };
    const result = useModelOrKey<string, UniqueModel>(model, {
      useModel: (m) => `model:${m.id}`,
      useKey: (key) => `key:${key}`
    });
    expect(result).toBe('model:1');
  });

  it('should fall back to useKey with the model id if useModel is not provided', () => {
    const model: UniqueModel = { id: '1' };
    const result = useModelOrKey<string, UniqueModel>(model, {
      useKey: (key) => `key:${key}`
    });
    expect(result).toBe('key:1');
  });

  it('should return undefined for null input with required=false', () => {
    const result = useModelOrKey<string, UniqueModel>(null as any, {
      useKey: (key) => `key:${key}`,
      required: false
    });
    expect(result).toBeUndefined();
  });

  it('should return undefined for undefined input with required=false', () => {
    const result = useModelOrKey<string, UniqueModel>(undefined as any, {
      useKey: (key) => `key:${key}`,
      required: false
    });
    expect(result).toBeUndefined();
  });

  it('should throw for null input with required=true', () => {
    expect(() =>
      useModelOrKey<string, UniqueModel>(null as any, {
        useKey: (key) => `key:${key}`,
        required: true
      })
    ).toThrow('input is required');
  });
});

describe('encodeModelKeyTypePair()', () => {
  it('should encode a type/key pair into type_key format', () => {
    const encoded = encodeModelKeyTypePair({ type: 'user', key: '123' });
    expect(encoded).toBe('user_123');
  });
});

describe('decodeModelKeyTypePair()', () => {
  it('should decode a type_key string into a ModelKeyTypePair', () => {
    const pair = decodeModelKeyTypePair('user_123');
    expect(pair).toEqual({ type: 'user', key: '123' });
  });
});

describe('modelTypeDataPairFactory()', () => {
  it('should create a factory that wraps data with its type', () => {
    const factory = modelTypeDataPairFactory<{ kind: string }>((x) => x.kind);
    const result = factory({ kind: 'item' });

    expect(result.type).toBe('item');
    expect(result.data).toEqual({ kind: 'item' });
  });

  it('should use the default type when the type reader returns nullish', () => {
    const factory = modelTypeDataPairFactory<{ kind?: string }>((x) => x.kind!, 'fallback');
    const result = factory({});

    expect(result.type).toBe('fallback');
  });
});
