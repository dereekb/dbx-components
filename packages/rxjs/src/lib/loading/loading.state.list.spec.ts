import { of } from 'rxjs';
import { beginLoading, successResult } from './loading.state';
import { isListLoadingStateEmpty, listLoadingStateIsEmpty } from './loading.state.list';

describe('listLoadingStateIsEmpty()', () => {
  it('should return true for an in-progress loading that has no value', () => {
    expect(listLoadingStateIsEmpty(beginLoading<[]>())).toBe(true);
  });

  it('should return true for an empty array.', () => {
    expect(listLoadingStateIsEmpty(successResult([]))).toBe(true);
  });

  it('should return false for a non-empty array.', () => {
    expect(listLoadingStateIsEmpty(successResult([0, 1, 2]))).toBe(false);
  });

  it('should return false for a non-empty array that is loading.', () => {
    expect(listLoadingStateIsEmpty({ ...successResult([0, 1, 2]), ...beginLoading<[]>() })).toBe(false);
  });
});

describe('isListLoadingStateEmpty()', () => {
  it('should emit true for an empty array.', (done) => {
    const obs = of(successResult([])).pipe(isListLoadingStateEmpty());

    obs.subscribe((x) => {
      expect(x).toBe(true);
      done();
    });
  });

  it('should emit false for a non-empty array.', (done) => {
    const obs = of(successResult([0, 1, 2])).pipe(isListLoadingStateEmpty());

    obs.subscribe((x) => {
      expect(x).toBe(false);
      done();
    });
  });
});
