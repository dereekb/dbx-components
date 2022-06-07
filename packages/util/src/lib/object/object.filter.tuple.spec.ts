import { allKeyValueTuples, filterKeyValueTupleFunction, KeyValueTypleValueFilter } from './object.filter.tuple';

describe('filterKeyValueTuplesFn()', () => {
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
  });
});
