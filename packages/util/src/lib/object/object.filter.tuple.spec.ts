import { allKeyValueTuples, filterKeyValueTupleFunction, filterKeyValueTuplesFunction, KeyValueTypleValueFilter } from './object.filter.tuple';

describe('filterKeyValueTupleFunction()', () => {
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
  describe('config', () => {
    describe('valueFilter', () => {
      describe('empty', () => {
        const filterEmptyValues = filterKeyValueTuplesFunction<any>(KeyValueTypleValueFilter.EMPTY);

        it('should filter out empty values.', () => {
          const result = filterEmptyValues({
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
