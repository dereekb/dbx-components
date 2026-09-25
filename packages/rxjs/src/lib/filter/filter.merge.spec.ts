import { BehaviorSubject, first, skip } from 'rxjs';
import { callbackTest } from '@dereekb/util/test';
import { combineFilters, mergeFilters } from './filter.merge';
import { type FilterWithPreset } from './filter';

interface TestMergeFilter extends FilterWithPreset<'today'> {
  date?: Date;
  name?: string;
  minPrice?: number;
}

describe('mergeFilters()', () => {
  it('should merge the fields of each filter.', () => {
    const date = new Date();
    const result = mergeFilters<TestMergeFilter>([{ date }, { minPrice: 100 }]);

    expect(result.date).toBe(date);
    expect(result.minPrice).toBe(100);
  });

  it('should use the value from the later filter when both filters set the same field.', () => {
    const result = mergeFilters<TestMergeFilter>([{ name: 'a' }, { name: 'b' }]);
    expect(result.name).toBe('b');
  });

  it('should not overwrite a value with undefined.', () => {
    const result = mergeFilters<TestMergeFilter>([{ name: 'a' }, { name: undefined, minPrice: 100 }]);
    expect(result.name).toBe('a');
    expect(result.minPrice).toBe(100);
  });

  it('should ignore null and undefined filters.', () => {
    const result = mergeFilters<TestMergeFilter>([null, { name: 'a' }, undefined]);
    expect(result).toEqual({ name: 'a' });
  });

  it('should remove the preset from the result.', () => {
    const date = new Date();
    const result = mergeFilters<TestMergeFilter>([{ date, preset: 'today' }, { minPrice: 100 }]);

    expect(result.preset).toBeUndefined();
    expect('preset' in result).toBe(false);
  });

  it('should not modify the input filters.', () => {
    const input: TestMergeFilter = { name: 'a', preset: 'today' };
    mergeFilters<TestMergeFilter>([input, { minPrice: 100 }]);

    expect(input).toEqual({ name: 'a', preset: 'today' });
  });
});

describe('combineFilters()', () => {
  it(
    'should emit the merged filter once every input has emitted.',
    callbackTest((done) => {
      const a = new BehaviorSubject<TestMergeFilter>({ name: 'a' });
      const b = new BehaviorSubject<TestMergeFilter>({ minPrice: 100 });

      combineFilters<TestMergeFilter>([a, b])
        .pipe(first())
        .subscribe((filter) => {
          expect(filter).toEqual({ name: 'a', minPrice: 100 });
          done();
        });
    })
  );

  it(
    'should emit again when either input changes, keeping the fields from the other input.',
    callbackTest((done) => {
      const a = new BehaviorSubject<TestMergeFilter>({ name: 'a' });
      const b = new BehaviorSubject<TestMergeFilter>({ minPrice: 100 });

      combineFilters<TestMergeFilter>([a, b])
        .pipe(skip(1), first())
        .subscribe((filter) => {
          expect(filter).toEqual({ name: 'a', minPrice: 200 });
          done();
        });

      b.next({ minPrice: 200 });
    })
  );

  it(
    'should use the input merge function.',
    callbackTest((done) => {
      const a = new BehaviorSubject<TestMergeFilter>({ name: 'a' });
      const b = new BehaviorSubject<TestMergeFilter>({ name: 'b' });

      combineFilters<TestMergeFilter>([a, b], (filters) => filters[0] as TestMergeFilter)
        .pipe(first())
        .subscribe((filter) => {
          expect(filter).toEqual({ name: 'a' });
          done();
        });
    })
  );
});
