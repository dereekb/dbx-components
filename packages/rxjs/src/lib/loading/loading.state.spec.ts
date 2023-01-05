import { beginLoading, errorResult, loadingStateHasFinishedLoading, loadingStateIsLoading, mapLoadingStateResults, successResult } from './loading.state';

describe('beginLoading()', () => {
  it('should return a loading state that is loading.', () => {
    const state = beginLoading();
    expect(loadingStateIsLoading(state)).toBe(true);
  });
});

describe('successResult()', () => {
  it('should return a loading state that has the value.', () => {
    const value = {};
    const state = successResult(value);
    expect(state.value).toBe(value);
  });

  it('should return a loading state that is not loading.', () => {
    const state = successResult({});
    expect(loadingStateIsLoading(state)).toBe(false);
  });

  it('should return a loading state that is not loading even if the value is undefined.', () => {
    const state = successResult(undefined);
    expect(loadingStateIsLoading(state)).toBe(false);
  });
});

describe('errorResult()', () => {
  it('should return a loading state that has the error.', () => {
    const error = { message: '' };
    const state = errorResult(error);
    expect(state.error).toBeDefined();
    expect(state.error?._error).toBe(error);
  });

  it('should return a loading state that is not loading.', () => {
    const state = errorResult({ message: '' });
    expect(loadingStateIsLoading(state)).toBe(false);
  });

  it('should return a loading state that is not loading even if the error is undefined.', () => {
    const state = errorResult(undefined);
    expect(loadingStateIsLoading(state)).toBe(false);
  });
});

describe('loadingStateIsLoading()', () => {
  it('should return true if a loading state has loading = true.', () => {
    const result = loadingStateIsLoading({ loading: true });
    expect(result).toBe(true);
  });

  it('should return true if a loading state has loading = true even if a value is present.', () => {
    const result = loadingStateIsLoading({ loading: true, value: 'value' });
    expect(result).toBe(true);
  });

  it('should return false if a loading state has loading = false.', () => {
    const result = loadingStateIsLoading({ loading: false });
    expect(result).toBe(false);
  });

  it('should return false if a loading state has loading=undefined, and value is set.', () => {
    const result = loadingStateIsLoading({ loading: undefined, value: 'value' });
    expect(result).toBe(false);
  });

  it('should return true if a loading state has value=undefined', () => {
    const result = loadingStateIsLoading({ value: undefined });
    expect(result).toBe(true);
  });

  it('should return false if a loading state has value=null', () => {
    const result = loadingStateIsLoading({ value: null });
    expect(result).toBe(true);
  });

  it('should return false if a loading state has loading=undefined, and error is set.', () => {
    const result = loadingStateIsLoading({ loading: undefined, error: { message: '' } });
    expect(result).toBe(false);
  });

  it('should return true if a loading state is an empty object.', () => {
    const result = loadingStateIsLoading({ loading: undefined });
    expect(result).toBe(true);
  });

  it('should return true if a loading state has loading=undefined, and value=undefined.', () => {
    const result = loadingStateIsLoading({ loading: undefined, value: undefined });
    expect(result).toBe(true);
  });

  it('should return true if a loading state has loading=undefined, and error=undefined.', () => {
    const result = loadingStateIsLoading({ loading: undefined, error: undefined });
    expect(result).toBe(true);
  });
});

describe('loadingStateHasFinishedLoading()', () => {
  it('should return false if a loading state has loading = true.', () => {
    const result = loadingStateHasFinishedLoading({ loading: true });
    expect(result).toBe(false);
  });

  it('should return false if a loading state has loading = true even if a value is present.', () => {
    const result = loadingStateHasFinishedLoading({ loading: true, value: 'value' });
    expect(result).toBe(false);
  });

  it('should return false if a loading state has loading = true even if an error is present.', () => {
    const result = loadingStateHasFinishedLoading({ loading: true, error: { message: '' } });
    expect(result).toBe(false);
  });

  it('should return true if a loading state has loading = false.', () => {
    const result = loadingStateHasFinishedLoading({ loading: false });
    expect(result).toBe(true);
  });

  it('should return true if a loading state has loading=undefined, and value is set.', () => {
    const result = loadingStateHasFinishedLoading({ loading: undefined, value: 'value' });
    expect(result).toBe(true);
  });

  it('should return true if a loading state has loading=undefined, and error is set.', () => {
    const result = loadingStateHasFinishedLoading({ loading: undefined, error: { message: '' } });
    expect(result).toBe(true);
  });

  it('should return false if a loading state is an empty object.', () => {
    const result = loadingStateHasFinishedLoading({ loading: undefined });
    expect(result).toBe(false);
  });

  it('should return false if a loading state has loading=undefined, and value=undefined.', () => {
    const result = loadingStateHasFinishedLoading({ loading: undefined, value: undefined });
    expect(result).toBe(false);
  });

  it('should return false if a loading state has loading=undefined, and error=undefined.', () => {
    const result = loadingStateHasFinishedLoading({ loading: undefined, error: undefined });
    expect(result).toBe(false);
  });
});

describe('mapLoadingStateResults()', () => {
  it('should map the value of 0 and other non-null falsy values', () => {
    const mappedValue = `MAPPED`;

    const result = mapLoadingStateResults(successResult(0), {
      mapValue: () => mappedValue
    });

    expect(result.value).toBe(mappedValue);
  });
});
