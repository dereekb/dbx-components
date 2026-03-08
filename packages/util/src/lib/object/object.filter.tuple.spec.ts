import { allKeyValueTuples, filterKeyValueTuples, filterKeyValueTupleFunction, filterKeyValueTuplesFunction, forEachKeyValue, KeyValueTypleValueFilter } from './object.filter.tuple';

describe('forEachKeyValue()', () => {
  it('should run the example successfully', () => {
    const keys: string[] = [];
    forEachKeyValue(
      { a: 1, b: undefined, c: 3 },
      {
        filter: KeyValueTypleValueFilter.UNDEFINED,
        forEach: ([key]) => keys.push(key as string)
      }
    );
    expect(keys).toEqual(['a', 'c']);
  });
});

describe('filterKeyValueTuples()', () => {
  it('should run the example successfully', () => {
    const tuples = filterKeyValueTuples({ a: 1, b: null, c: 3 }, KeyValueTypleValueFilter.NULL);
    expect(tuples).toEqual([
      ['a', 1],
      ['c', 3]
    ]);
  });
});

describe('allKeyValueTuples()', () => {
  it('should run the example successfully', () => {
    const tuples = allKeyValueTuples({ x: 10, y: 20 });
    expect(tuples).toEqual([
      ['x', 10],
      ['y', 20]
    ]);
  });
});

describe('filterKeyValueTupleFunction()', () => {
  it('should run the example successfully', () => {
    const isNotNull = filterKeyValueTupleFunction(KeyValueTypleValueFilter.NULL);
    expect(isNotNull(['a', 1], 0)).toBe(true);
    expect(isNotNull(['b', null], 0)).toBe(false);
  });

  describe('config', () => {
    describe('invertFilter', () => {
      it('should not invert the filter if invertFilter is not defined.', () => {
        const object = {
          a: 0,
          b: 1,
          c: undefined
        };

        const tuples = allKeyValueTuples(object);
        const filter = filterKeyValueTupleFunction<typeof object>({
          valueFilter: KeyValueTypleValueFilter.NONE
        });

        const result = tuples.filter(filter);

        expect(result.length).toBe(3);
      });
    });

    describe('valueFilter', () => {
      describe('empty', () => {
        const filterEmptyValues = filterKeyValueTupleFunction<any>(KeyValueTypleValueFilter.EMPTY);

        it('should filter out empty values.', () => {
          expect(filterEmptyValues(['a', ''], 0)).toBe(false);
          expect(filterEmptyValues(['b', []], 0)).toBe(false);
          expect(filterEmptyValues(['c', new Set()], 0)).toBe(false);
          expect(filterEmptyValues(['d', new Map()], 0)).toBe(false);
          expect(filterEmptyValues(['e', 1], 0)).toBe(true);
        });

        it('should not filter out the value "0"', () => {
          expect(filterEmptyValues(['e', 0], 0)).toBe(true);
        });
      });
    });
  });
});

describe('filterKeyValueTuplesFunction()', () => {
  it('should run the example successfully', () => {
    const getDefinedTuples = filterKeyValueTuplesFunction(KeyValueTypleValueFilter.UNDEFINED);
    const tuples = getDefinedTuples({ a: 1, b: undefined, c: 'hello' });
    expect(tuples).toEqual([
      ['a', 1],
      ['c', 'hello']
    ]);
  });

  describe('config', () => {
    describe('valueFilter', () => {
      describe('NULL', () => {
        const filterNullAndUndefinedValues = filterKeyValueTuplesFunction<any>(KeyValueTypleValueFilter.NULL);

        it('should filter out null values.', () => {
          const result = filterNullAndUndefinedValues({
            // filter out
            a: null,
            b: undefined,
            // keep
            e: 0,
            f: false
          });

          expect(result.length).toBe(2);
          expect(result[0][0]).toBe('e');
          expect(result[1][0]).toBe('f');
        });
      });

      describe('empty', () => {
        const filterOutEmptyValues = filterKeyValueTuplesFunction<any>(KeyValueTypleValueFilter.EMPTY);

        it('should filter out empty values.', () => {
          const result = filterOutEmptyValues({
            // filter out
            a: '',
            b: [],
            c: new Set(),
            d: new Map(),
            // keep
            e: 0,
            f: false
          });

          expect(result.length).toBe(2);
          expect(result[0][0]).toBe('e');
          expect(result[1][0]).toBe('f');
        });
      });
    });
  });
});
