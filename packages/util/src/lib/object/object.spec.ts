import { allMaybeSoKeys, allKeyValueTuples, allNonUndefinedKeys, filterKeyValueTupleFunction, KeyValueTypleValueFilter, filterFromPOJO, objectHasKey } from './object';

describe('filterFromPOJO()', () => {

  it('should remove undefined values from the object by default', () => {
    const result = filterFromPOJO({ x: undefined, y: 'test' });
    expect(objectHasKey(result, 'x')).toBe(false);
    expect(objectHasKey(result, 'y')).toBe(true);
  });

  describe('with config', () => {

    describe('valueFilter = null', () => {

      it('should remove null and undefined values from the object', () => {
        const result = filterFromPOJO({ x: undefined, y: null, z: 'test', }, { filter: { valueFilter: KeyValueTypleValueFilter.NULL } });
        expect(objectHasKey(result, 'x')).toBe(false);
        expect(objectHasKey(result, 'y')).toBe(false);
        expect(objectHasKey(result, 'z')).toBe(true);
      });

    });

    describe('valueFilter = falsy', () => {

      it('should remove falsy, null and undefined values from the object', () => {
        const result = filterFromPOJO({ a: 0, b: false, c: '', x: undefined, y: null, z: 'test', }, { filter: { valueFilter: KeyValueTypleValueFilter.FALSY } });
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
          const result = filterFromPOJO({ x: undefined, y: null, z: 'test', }, { filter: { valueFilter: KeyValueTypleValueFilter.UNDEFINED, invertFilter: true } });
          expect(objectHasKey(result, 'x')).toBe(true);
          expect(objectHasKey(result, 'y')).toBe(false);
          expect(objectHasKey(result, 'z')).toBe(false);
        });

      });
      describe('valueFilter = null', () => {

        it('should keep null and undefined values, and remove all others', () => {
          const result = filterFromPOJO({ x: undefined, y: null, z: 'test', }, { filter: { valueFilter: KeyValueTypleValueFilter.NULL, invertFilter: true } });
          expect(objectHasKey(result, 'x')).toBe(true);
          expect(objectHasKey(result, 'y')).toBe(true);
          expect(objectHasKey(result, 'z')).toBe(false);
        });

      });

      describe('valueFilter = falsy', () => {

        it('should keep falsy values on the object, and remove all others', () => {
          const result = filterFromPOJO({ a: 0, b: false, c: '', x: undefined, y: null, z: 'test', }, { filter: { valueFilter: KeyValueTypleValueFilter.FALSY, invertFilter: true } });
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
    expect(result.findIndex(x => x === 'a')).not.toBe(-1);
    expect(result.findIndex(x => x === 'b')).toBe(-1);
    expect(result.findIndex(x => x === 'c')).not.toBe(-1);
    expect(result.findIndex(x => x === 'd')).not.toBe(-1);
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
    expect(result.findIndex(x => x === 'a')).not.toBe(-1);
    expect(result.findIndex(x => x === 'b')).toBe(-1);
    expect(result.findIndex(x => x === 'c')).toBe(-1);
    expect(result.findIndex(x => x === 'd')).not.toBe(-1);
  });

});

describe('filterKeyValueTuplesFn()', () => {

  describe('config', () => {

    describe('invertFilter', () => {

      it('should not invert the filter if invertFilter is not defined.', () => {
        const object = {
          'a': 0,
          'b': 1,
          'c': undefined
        };

        const tuples = allKeyValueTuples(object);
        const filter = filterKeyValueTupleFunction<typeof object>({
          valueFilter: KeyValueTypleValueFilter.NONE
        });

        const result = tuples.filter(filter);

        expect(result.length).toBe(3);
      });

    });

  });

});
