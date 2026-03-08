import { BehaviorSubject, first, of } from 'rxjs';
import { type Maybe } from '@dereekb/util';
import { type LoadingContext, type LoadingContextEvent } from './loading.context';
import { switchMapMaybeLoadingContextStream } from './loading.context.rxjs';
import { SimpleLoadingContext } from './loading.context.simple';
import { callbackTest } from '@dereekb/util/test';

describe('switchMapMaybeLoadingContextStream()', () => {
  it(
    'should emit the stream events from a non-null LoadingContext',
    callbackTest((done) => {
      const context = new SimpleLoadingContext(true);
      const context$ = new BehaviorSubject<Maybe<LoadingContext>>(context);

      context$.pipe(switchMapMaybeLoadingContextStream(), first()).subscribe((event) => {
        expect(event).toBeDefined();
        expect(event!.loading).toBe(true);
        context.destroy();
        context$.complete();
        done();
      });
    })
  );

  it(
    'should emit undefined when the LoadingContext is null',
    callbackTest((done) => {
      const context$ = new BehaviorSubject<Maybe<LoadingContext>>(null);

      context$.pipe(switchMapMaybeLoadingContextStream(), first()).subscribe((event) => {
        expect(event).toBeUndefined();
        context$.complete();
        done();
      });
    })
  );

  it(
    'should switch to the new context stream when the context changes',
    callbackTest((done) => {
      const contextA = new SimpleLoadingContext(true);
      const contextB = new SimpleLoadingContext(false);
      const context$ = new BehaviorSubject<Maybe<LoadingContext>>(contextA);

      let counter = 0;

      context$.pipe(switchMapMaybeLoadingContextStream()).subscribe((event) => {
        const c = counter;
        counter += 1;

        switch (c) {
          case 0:
            expect(event).toBeDefined();
            expect(event!.loading).toBe(true);
            context$.next(contextB);
            break;
          case 1:
            expect(event).toBeDefined();
            expect(event!.loading).toBe(false);
            contextA.destroy();
            contextB.destroy();
            context$.complete();
            done();
            break;
        }
      });
    })
  );
});
