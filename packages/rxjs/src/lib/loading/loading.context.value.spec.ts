import { first } from 'rxjs';
import { ValuesLoadingContext } from './loading.context.value';

describe('ValuesLoadingContext', () => {
  let context: ValuesLoadingContext;

  afterEach(() => {
    context?.destroy();
  });

  it('should start in a loading state if nothing is specified', (done) => {
    context = new ValuesLoadingContext();

    context.stream$.pipe(first()).subscribe(({ loading }) => {
      expect(loading).toBe(true);
      done();
    });
  });

  it('should not start in a loading state if loading not specified.', (done) => {
    context = new ValuesLoadingContext({ loading: false });

    context.stream$.pipe(first()).subscribe(({ loading }) => {
      expect(loading).toBe(false);
      done();
    });
  });
});
