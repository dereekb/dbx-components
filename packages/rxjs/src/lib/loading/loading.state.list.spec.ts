import { of } from 'rxjs';
import { beginLoading, successResult } from './loading.state';
import { mapIsListLoadingStateWithEmptyValue, isListLoadingStateWithEmptyValue, arrayValueFromFinishedLoadingState } from './loading.state.list';

describe('isListLoadingStateWithEmptyValue()', () => {
  it('should return true for an in-progress loading that has no value', () => {
    expect(isListLoadingStateWithEmptyValue(beginLoading<[]>())).toBe(true);
  });

  it('should return true for an empty array.', () => {
    expect(isListLoadingStateWithEmptyValue(successResult([]))).toBe(true);
  });

  it('should return false for a non-empty array.', () => {
    expect(isListLoadingStateWithEmptyValue(successResult([0, 1, 2]))).toBe(false);
  });

  it('should return false for a non-empty array that is loading.', () => {
    expect(isListLoadingStateWithEmptyValue({ ...successResult([0, 1, 2]), ...beginLoading<[]>() })).toBe(false);
  });
});

describe('mapIsListLoadingStateWithEmptyValue()', () => {
  it('should emit true for an empty array.', (done) => {
    const obs = of(successResult([])).pipe(mapIsListLoadingStateWithEmptyValue());

    obs.subscribe((x) => {
      expect(x).toBe(true);
      done();
    });
  });

  it('should emit false for a non-empty array.', (done) => {
    const obs = of(successResult([0, 1, 2])).pipe(mapIsListLoadingStateWithEmptyValue());

    obs.subscribe((x) => {
      expect(x).toBe(false);
      done();
    });
  });
});

describe('arrayValueFromFinishedLoadingState()', () => {
  it('should emit an empty array for an empty array.', (done) => {
    const obs = of(successResult(null)).pipe(arrayValueFromFinishedLoadingState());

    obs.subscribe((x) => {
      expect(x).toBeDefined();
      expect(x).toHaveLength(0);
      done();
    });
  });

  it('should emit an array for a non-empty array.', (done) => {
    const resultValue = [0, 1, 2];
    const obs = of(successResult(resultValue)).pipe(arrayValueFromFinishedLoadingState());

    obs.subscribe((x) => {
      expect(x).toBeDefined();
      expect(x).toHaveLength(resultValue.length);
      expect(x).toBe(resultValue);
      done();
    });
  });
});
