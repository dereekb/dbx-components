import { beginLoading, errorResult, loadingStateHasFinishedLoading, loadingStateIsLoading, successResult } from '.';

describe('beginLoading()', () => {

  it('should return a loading state that is loading.', () => {
    const state = beginLoading();
    expect(loadingStateIsLoading(state)).toBe(true);
  });

});

describe('successResult()', () => {

  it('should return a loading state that has the model.', () => {
    const model = {};
    const state = successResult(model);
    expect(state.model).toBe(model);
  });

  it('should return a loading state that is not loading.', () => {
    const state = successResult({});
    expect(loadingStateIsLoading(state)).toBe(false);
  });

  it('should return a loading state that is not loading even if the model is undefined.', () => {
    const state = successResult(undefined);
    expect(loadingStateIsLoading(state)).toBe(false);
  });

});

describe('errorResult()', () => {

  it('should return a loading state that has the error.', () => {
    const error = { message: '' };
    const state = errorResult(error);
    expect(state.error).toBe(error);
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

  it('should return false if a loading state has loading = false.', () => {
    const result = loadingStateIsLoading({ loading: false });
    expect(result).toBe(false);
  });

  it('should return false if a loading state has loading=undefined, and model is set.', () => {
    const result = loadingStateIsLoading({ loading: undefined, model: 'model' });
    expect(result).toBe(false);
  });

  it('should return false if a loading state has loading=undefined, and error is set.', () => {
    const result = loadingStateIsLoading({ loading: undefined, error: { message: '' } });
    expect(result).toBe(false);
  });

  it('should return true if a loading state is an empty object.', () => {
    const result = loadingStateIsLoading({ loading: undefined });
    expect(result).toBe(true);
  });

  it('should return true if a loading state has loading=undefined, and model=undefined.', () => {
    const result = loadingStateIsLoading({ loading: undefined, model: undefined });
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

  it('should return true if a loading state has loading = false.', () => {
    const result = loadingStateHasFinishedLoading({ loading: false });
    expect(result).toBe(true);
  });

  it('should return true if a loading state has loading=undefined, and model is set.', () => {
    const result = loadingStateHasFinishedLoading({ loading: undefined, model: 'model' });
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

  it('should return false if a loading state has loading=undefined, and model=undefined.', () => {
    const result = loadingStateHasFinishedLoading({ loading: undefined, model: undefined });
    expect(result).toBe(false);
  });

  it('should return false if a loading state has loading=undefined, and error=undefined.', () => {
    const result = loadingStateHasFinishedLoading({ loading: undefined, error: undefined });
    expect(result).toBe(false);
  });

});
