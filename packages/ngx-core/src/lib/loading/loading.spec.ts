import 'jasmine-expect';
import { ValuesLoadingContext } from './loading';

describe('ValuesLoadingContext', () => {

  it('should start in a loading state if nothing is specified', () => {
    const context = new ValuesLoadingContext();
    expect(context.isLoading).toBe(true);
  });

  it('should not start in a loading state if loading not specified.', () => {
    const context = new ValuesLoadingContext({ isLoading: false });
    expect(context.isLoading).toBeFalse();
  });

});
