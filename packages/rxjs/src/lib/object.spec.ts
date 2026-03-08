import { of, lastValueFrom, toArray } from 'rxjs';
import { distinctUntilObjectValuesChanged, filterIfObjectValuesUnchanged } from './object';

describe('distinctUntilObjectValuesChanged()', () => {
  it('should filter out consecutive emissions with equal POJO values', async () => {
    const results = await lastValueFrom(of({ a: 1 }, { a: 1 }, { a: 2 }).pipe(distinctUntilObjectValuesChanged(), toArray()));
    expect(results).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('should pass through all emissions when values differ', async () => {
    const results = await lastValueFrom(of({ x: 1 }, { x: 2 }, { x: 3 }).pipe(distinctUntilObjectValuesChanged(), toArray()));
    expect(results).toEqual([{ x: 1 }, { x: 2 }, { x: 3 }]);
  });
});

describe('filterIfObjectValuesUnchanged()', () => {
  describe('with a static reference', () => {
    it('should filter out emissions equal to the reference value', async () => {
      const ref = { status: 'active' };
      const results = await lastValueFrom(of({ status: 'active' }, { status: 'inactive' }).pipe(filterIfObjectValuesUnchanged(ref), toArray()));
      expect(results).toEqual([{ status: 'inactive' }]);
    });

    it('should pass through all emissions when none match the reference', async () => {
      const ref = { status: 'pending' };
      const results = await lastValueFrom(of({ status: 'active' }, { status: 'inactive' }).pipe(filterIfObjectValuesUnchanged(ref), toArray()));
      expect(results).toEqual([{ status: 'active' }, { status: 'inactive' }]);
    });
  });
});
