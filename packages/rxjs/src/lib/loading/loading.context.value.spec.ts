import { first } from 'rxjs';
import { ValuesLoadingContext } from './loading.context.value';
import { callbackTest } from '@dereekb/util/test';

describe('ValuesLoadingContext', () => {
  let context: ValuesLoadingContext;

  afterEach(() => {
    context?.destroy();
  });

  it(
    'should start in a loading state if nothing is specified',
    callbackTest((done) => {
      context = new ValuesLoadingContext();

      context.stream$.pipe(first()).subscribe(({ loading }) => {
        expect(loading).toBe(true);
        done();
      });
    })
  );

  it(
    'should not start in a loading state if loading not specified.',
    callbackTest((done) => {
      context = new ValuesLoadingContext({ loading: false });

      context.stream$.pipe(first()).subscribe(({ loading }) => {
        expect(loading).toBe(false);
        done();
      });
    })
  );
});
