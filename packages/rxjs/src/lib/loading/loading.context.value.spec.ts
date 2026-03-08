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

  describe('check()', () => {
    it(
      'should set loading to false when all check values are defined',
      callbackTest((done) => {
        let valueA: string | undefined = 'hello';
        let valueB: string | undefined = 'world';

        context = new ValuesLoadingContext({
          checkDone: () => [valueA, valueB]
        });

        context.check();

        context.stream$.pipe(first()).subscribe(({ loading }) => {
          expect(loading).toBe(false);
          done();
        });
      })
    );

    it(
      'should keep loading true when some check values are undefined',
      callbackTest((done) => {
        let valueA: string | undefined = 'hello';
        let valueB: string | undefined;

        context = new ValuesLoadingContext({
          checkDone: () => [valueA, valueB]
        });

        context.check();

        context.stream$.pipe(first()).subscribe(({ loading }) => {
          expect(loading).toBe(true);
          done();
        });
      })
    );

    it('should throw when no check function is configured', () => {
      context = new ValuesLoadingContext();
      expect(() => context.check()).toThrow();
    });
  });
});
