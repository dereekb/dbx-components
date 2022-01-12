import { first } from 'rxjs/operators';
import { ValuesLoadingContext } from './loading';

describe('ValuesLoadingContext', () => {

  it('should start in a loading state if nothing is specified', (done) => {
    const context = new ValuesLoadingContext();

    context.stream$.pipe(first()).subscribe((isLoading) => {
      expect(isLoading).toBe(true);
      done();
    });
  });

  it('should not start in a loading state if loading not specified.', (done) => {
    const context = new ValuesLoadingContext({ isLoading: false });

    context.stream$.pipe(first()).subscribe((isLoading) => {
      expect(isLoading).toBe(false);
      done();
    });
  });

});
