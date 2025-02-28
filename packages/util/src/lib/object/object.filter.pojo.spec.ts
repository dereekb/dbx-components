import { filterUndefinedValues, type Maybe, mergeObjects } from '@dereekb/util';
import { objectHasKey } from './object';
import { filterFromPOJO, allNonUndefinedKeys, allMaybeSoKeys, countPOJOKeys, findPOJOKeys, overrideInObject, assignValuesToPOJOFunction, filterKeysOnPOJOFunction } from './object.filter.pojo';
import { KeyValueTypleValueFilter } from './object.filter.tuple';

describe('overrideInObject', () => {
  it('should override all non-undefined values.', () => {
    const target = {
      override: false,
      c: 3
    };

    const otherValues = [
      {
        override: true,
        a: 1,
        c: undefined as unknown as number // undefined values are ignored by default
      },
      {
        a: 2,
        b: null // null values are not ignored
      }
    ];

    const result = overrideInObject(target, { from: otherValues });

    expect(target).toBe(result);
    expect(target.override).toBe(otherValues[0].override);
    expect((target as typeof otherValues[1]).a).toBe(otherValues[1].a);
    expect((target as typeof otherValues[1]).b).toBe(otherValues[1].b);
    expect(target.c).toBe(3);
  });

  describe('with config', () => {
    describe('copy=true', () => {
      it('should return a copy.', () => {
        const target = {
          override: false
        };

        const otherValues = [
          {
            override: true,
            a: 1
          },
          {
            a: 2,
            b: 2
          }
        ];

        const result = overrideInObject(target, { copy: true, from: otherValues });

        expect(result).not.toBe(target);
        expect(target.override).toBe(false);
        expect(result.override).toBe(otherValues[0].override);
        expect((result as typeof otherValues[1]).a).toBe(otherValues[1].a);
        expect((result as typeof otherValues[1]).b).toBe(otherValues[1].b);
      });
    });
  });
});

describe('mergeObjects', () => {
  it('should merge the input objects into one', () => {
    const otherValues = [
      {
        override: true,
        a: 1,
        b: null as unknown as number
      },
      {
        override: undefined,
        a: 2,
        b: 2
      }
    ];

    const result = mergeObjects(otherValues);

    expect(result).toBeDefined();
    expect(result.override).toBe(otherValues[0].override);
    expect(result.a).toBe(otherValues[1].a);
    expect(result.b).toBe(otherValues[1].b);
  });

  it('should merge the input objects with number keys into one', () => {
    const otherValues = [
      {
        1: true,
        2: 1,
        3: null as unknown as number
      },
      {
        1: undefined,
        2: 2,
        3: 2
      }
    ];

    const result = mergeObjects(otherValues);

    expect(result).toBeDefined();
    expect(result[1]).toBe(otherValues[0][1]);
    expect(result[2]).toBe(otherValues[1][2]);
    expect(result[3]).toBe(otherValues[1][3]);
  });

  it('should filter number keys properly', () => {
    const otherValues = [
      {
        1: true,
        2: 1,
        3: null as unknown as number
      },
      {
        1: undefined,
        2: 2,
        3: 2
      }
    ];

    // keys filter can be either the string or number form
    const result = mergeObjects<typeof otherValues[0]>(otherValues, { keysFilter: ['1', 2] });
    expect(result).toBeDefined();

    // javascript handles the strings and numbers all the same
    expect(result['1']).toBeDefined();
    expect(result['1']).toBe(true);
    expect(result[2]).toBeDefined();
    expect(result[2]).toBe(2);
  });
});

describe('findPOJOKeys()', () => {
  describe('with config', () => {
    describe('valueFilter = null', () => {
      it('should return keys of all non-null/undefined values', () => {
        const result = findPOJOKeys({ x: undefined, y: 'test', z: null }, KeyValueTypleValueFilter.NULL);
        expect(result.length).toBe(1);
        expect(result[0]).toBe('y');
      });
    });
    describe('valueFilter = undefined', () => {
      it('should return keys of all non-null/undefined values', () => {
        const result = findPOJOKeys({ x: undefined, y: 'test', z: null }, KeyValueTypleValueFilter.UNDEFINED);
        expect(result.length).toBe(2);
        expect(result[0]).toBe('y');
        expect(result[1]).toBe('z');
      });
    });
  });
});

interface TestObject {
  v: number;
  ms?: Maybe<string>;
}

describe('assignValuesToPOJOFunction()', () => {
  describe('function', () => {
    describe('filter=NULL', () => {
      const assignFunction = assignValuesToPOJOFunction<TestObject>({ keysFilter: ['v', 'ms'], valueFilter: KeyValueTypleValueFilter.NULL });

      it('should not copy null values to the target object.', () => {
        const result = assignFunction({ v: 0 }, { v: 1, ms: null });

        expect(result.v).toBe(1);
        expect(objectHasKey(result, 'ms')).toBe(false);
      });

      it('should not copy undefined values to the target object.', () => {
        const result = assignFunction({ v: 0 }, { v: 1, ms: undefined });

        expect(result.v).toBe(1);
        expect(objectHasKey(result, 'ms')).toBe(false);
      });
    });

    describe('copy override', () => {
      const assignFunction = assignValuesToPOJOFunction<TestObject>({ keysFilter: ['v', 'ms'], valueFilter: KeyValueTypleValueFilter.NULL });

      it('should return the input value if copy=false', () => {
        const a: TestObject & { x: number } = { v: 100, ms: '100', x: 100 };
        const result = assignFunction(a, { v: 0 }, false);
        expect(a).toBe(result);
      });

      it('should return a new object if copy=true', () => {
        const a: TestObject & { x: number } = { v: 100, ms: '100', x: 100 };
        const result = assignFunction(a, { v: 0 }, true);
        expect(a).not.toBe(result);
      });
    });
  });
});

describe('countPOJOKeys()', () => {
  it('should count all undefined keys be default.', () => {
    const result = countPOJOKeys({ x: undefined, y: 'test', z: null });
    expect(result).toBe(2);
  });
});

describe('filterUndefinedValues', () => {
  it('should return a copy of the input object with all undefined values removed.', () => {
    const result = filterUndefinedValues({ x: undefined, y: 'test', z: null });
    expect(result).toBeDefined();
    expect(objectHasKey(result, 'y'));
    expect(objectHasKey(result, 'z'));
  });

  describe('filterNull=true', () => {
    it('should return a copy of the input object with all null and undefined values removed.', () => {
      const result = filterUndefinedValues({ x: undefined, y: 'test', z: null }, true);
      expect(result).toBeDefined();
      expect(objectHasKey(result, 'y'));
    });
  });
});

describe('filterFromPOJO()', () => {
  it('should remove undefined values from the object by default', () => {
    const result = filterFromPOJO({ x: undefined, y: 'test' });
    expect(objectHasKey(result, 'x')).toBe(false);
    expect(objectHasKey(result, 'y')).toBe(true);
  });

  describe('with config', () => {
    describe('valueFilter = null', () => {
      it('should remove null and undefined values from the object', () => {
        const result = filterFromPOJO({ x: undefined, y: null, z: 'test' }, { filter: { valueFilter: KeyValueTypleValueFilter.NULL } });
        expect(objectHasKey(result, 'x')).toBe(false);
        expect(objectHasKey(result, 'y')).toBe(false);
        expect(objectHasKey(result, 'z')).toBe(true);
      });
    });

    describe('valueFilter = falsy', () => {
      it('should remove falsy, null and undefined values from the object', () => {
        const result = filterFromPOJO({ a: 0, b: false, c: '', x: undefined, y: null, z: 'test' }, { filter: { valueFilter: KeyValueTypleValueFilter.FALSY } });
        expect(objectHasKey(result, 'a')).toBe(false);
        expect(objectHasKey(result, 'b')).toBe(false);
        expect(objectHasKey(result, 'c')).toBe(false);
        expect(objectHasKey(result, 'x')).toBe(false);
        expect(objectHasKey(result, 'y')).toBe(false);
        expect(objectHasKey(result, 'z')).toBe(true);
      });
    });

    describe('invertFilter = true', () => {
      describe('valueFilter = undefined', () => {
        it('should keep undefined values, and remove all others', () => {
          const result = filterFromPOJO({ x: undefined, y: null, z: 'test' }, { filter: { valueFilter: KeyValueTypleValueFilter.UNDEFINED, invertFilter: true } });
          expect(objectHasKey(result, 'x')).toBe(true);
          expect(objectHasKey(result, 'y')).toBe(false);
          expect(objectHasKey(result, 'z')).toBe(false);
        });
      });
      describe('valueFilter = null', () => {
        it('should keep null and undefined values, and remove all others', () => {
          const result = filterFromPOJO({ x: undefined, y: null, z: 'test' }, { filter: { valueFilter: KeyValueTypleValueFilter.NULL, invertFilter: true } });
          expect(objectHasKey(result, 'x')).toBe(true);
          expect(objectHasKey(result, 'y')).toBe(true);
          expect(objectHasKey(result, 'z')).toBe(false);
        });
      });

      describe('valueFilter = falsy', () => {
        it('should keep falsy values on the object, and remove all others', () => {
          const result = filterFromPOJO({ a: 0, b: false, c: '', x: undefined, y: null, z: 'test' }, { filter: { valueFilter: KeyValueTypleValueFilter.FALSY, invertFilter: true } });
          expect(objectHasKey(result, 'a')).toBe(true);
          expect(objectHasKey(result, 'b')).toBe(true);
          expect(objectHasKey(result, 'c')).toBe(true);
          expect(objectHasKey(result, 'x')).toBe(true);
          expect(objectHasKey(result, 'y')).toBe(true);
          expect(objectHasKey(result, 'z')).toBe(false);
        });
      });
    });
  });
});

describe('allNonUndefinedKeys()', () => {
  it('should return all the keys of values that are not undefined.', () => {
    const object = {
      a: 'test',
      b: undefined,
      c: null,
      d: 0
    };

    const result = allNonUndefinedKeys(object);

    expect(result).toBeDefined();
    expect(result.length).toBe(3);
    expect(result.findIndex((x) => x === 'a')).not.toBe(-1);
    expect(result.findIndex((x) => x === 'b')).toBe(-1);
    expect(result.findIndex((x) => x === 'c')).not.toBe(-1);
    expect(result.findIndex((x) => x === 'd')).not.toBe(-1);
  });
});

describe('allMaybeSoKeys()', () => {
  it('should return all the keys of values that are not null or undefined.', () => {
    const object = {
      a: 'test',
      b: undefined,
      c: null,
      d: 0
    };

    const result = allMaybeSoKeys(object);

    expect(result).toBeDefined();
    expect(result.length).toBe(2);
    expect(result.findIndex((x) => x === 'a')).not.toBe(-1);
    expect(result.findIndex((x) => x === 'b')).toBe(-1);
    expect(result.findIndex((x) => x === 'c')).toBe(-1);
    expect(result.findIndex((x) => x === 'd')).not.toBe(-1);
  });
});

describe('filterKeysOnPOJOFunction()', () => {
  describe('function', () => {
    it('should return a new record/object with only values from the input keys on it', () => {
      const keys = ['a', 'b'];
      const input = { a: 1, b: 2, c: 3 };

      const result = filterKeysOnPOJOFunction<typeof input>(keys, false)(input);

      expect(result).toBeDefined();
      expect(result).toEqual({ a: 1, b: 2 });
      expect(result.c).toBeUndefined();
    });

    describe('invertFilter=true', () => {
      it('should return a new record/object with out values from the input keys on it', () => {
        const keys = ['a', 'b'];
        const input = { a: 1, b: 2, c: 3 };

        const result = filterKeysOnPOJOFunction<typeof input>(keys, true)(input);

        expect(result).toBeDefined();
        expect(result).toEqual({ c: 3 });
        expect(result.a).toBeUndefined();
        expect(result.b).toBeUndefined();
      });
    });
  });
});
