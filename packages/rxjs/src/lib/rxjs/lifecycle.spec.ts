import { SubscriptionObject } from './../subscription';
import { BehaviorSubject, type MonoTypeOperatorFunction } from 'rxjs';
import { cleanup, cleanupDestroyable } from './lifecycle';
import { type Destroyable, type Maybe, promiseReference, type PromiseReference } from '@dereekb/util';
import { callbackTest } from '@dereekb/util/test';

describe('cleanup()', () => {
  let sub: SubscriptionObject;

  beforeEach(() => {
    sub = new SubscriptionObject();
  });

  afterEach(() => {
    sub.destroy();
  });

  it(
    'should call the destroy function when a new value is presented.',
    callbackTest((done) => {
      let destroyed = false;

      const initialValue = 1;

      const subject = new BehaviorSubject<number>(initialValue);

      const obs = subject.pipe(
        cleanup((x) => {
          expect(x).toBe(initialValue);
          destroyed = true;
        })
      );

      sub.subscription = obs.subscribe();

      expect(destroyed).toBe(false);

      subject.next(2);

      setTimeout(() => {
        expect(destroyed).toBe(true);
        subject.complete();
        done();
      });
    })
  );

  it(
    'should call the destroy function when the observable finishes.',
    callbackTest((done) => {
      let destroyed = false;

      const initialValue = 1;

      const subject = new BehaviorSubject<number>(initialValue);

      const obs = subject.pipe(
        cleanup((x) => {
          expect(x).toBe(initialValue);
          destroyed = true;
        })
      );

      sub.subscription = obs.subscribe();

      expect(destroyed).toBe(false);

      subject.complete();

      setTimeout(() => {
        expect(destroyed).toBe(true);
        subject.complete();
        done();
      });
    })
  );

  it(
    'should wait for the destroy function to finish before the next value is passed.',
    callbackTest((done) => {
      const initialValue = 1;
      const secondValue = 2;

      const wait = true;
      let destroyed = false;
      let isDone = false;

      const subject = new BehaviorSubject<number>(initialValue);
      let promiseRef: PromiseReference;

      const obs = subject.pipe(
        cleanup(() => {
          // this promise will not resolve until we call resolve externally.
          promiseRef = promiseReference(() => 0);

          return promiseRef.promise.then(() => {
            destroyed = true;
          });
        }, wait)
      );

      // subscribe
      sub.subscription = obs.subscribe((x) => {
        if (!isDone) {
          expect(x).not.toBe(secondValue);
          expect(destroyed).toBe(false);
        }
      });

      // push the second value. if we're not done, the above should not execute with the secondValue
      subject.next(secondValue);

      setTimeout(() => {
        // still should not be destroyed since we have not resolved. Should not have recieved secondValue either
        expect(destroyed).toBe(false);

        // cleanup
        isDone = true;
        promiseRef.resolve(0);
        subject.complete();
        done();
      });
    })
  );
});

describe('cleanupDestroyable()', () => {
  let sub: SubscriptionObject;

  beforeEach(() => {
    sub = new SubscriptionObject();
  });

  afterEach(() => {
    sub.destroy();
  });

  function makeDestroyable(onDestroy?: () => void): Destroyable {
    return {
      destroy: () => {
        onDestroy?.();
      }
    };
  }

  describe('type signatures', () => {
    it('should accept Observable<Destroyable> and return MonoTypeOperatorFunction<Destroyable>', () => {
      const op: MonoTypeOperatorFunction<Destroyable> = cleanupDestroyable();
      expect(op).toBeDefined();
    });

    it('should accept Observable<Maybe<Destroyable>> and return MonoTypeOperatorFunction<Maybe<Destroyable>>', () => {
      const op: MonoTypeOperatorFunction<Maybe<Destroyable>> = cleanupDestroyable();
      expect(op).toBeDefined();
    });

    it('should work in a pipe with Observable<Destroyable>', () => {
      const subject = new BehaviorSubject<Destroyable>(makeDestroyable());
      const obs = subject.pipe(cleanupDestroyable());
      sub.subscription = obs.subscribe();
      subject.complete();
    });

    it('should work in a pipe with Observable<Maybe<Destroyable>>', () => {
      const subject = new BehaviorSubject<Maybe<Destroyable>>(null);
      const obs = subject.pipe(cleanupDestroyable());
      sub.subscription = obs.subscribe();
      subject.complete();
    });
  });

  it(
    'should call destroy on the previous value when a new value is emitted.',
    callbackTest((done) => {
      let destroyed = false;

      const first = makeDestroyable(() => {
        destroyed = true;
      });

      const subject = new BehaviorSubject<Destroyable>(first);
      const obs = subject.pipe(cleanupDestroyable());

      sub.subscription = obs.subscribe();

      expect(destroyed).toBe(false);

      subject.next(makeDestroyable());

      setTimeout(() => {
        expect(destroyed).toBe(true);
        subject.complete();
        done();
      });
    })
  );

  it(
    'should handle Maybe values and skip destroy for nullish emissions.',
    callbackTest((done) => {
      let destroyed = false;

      const first = makeDestroyable(() => {
        destroyed = true;
      });

      const subject = new BehaviorSubject<Maybe<Destroyable>>(first);
      const obs = subject.pipe(cleanupDestroyable());

      sub.subscription = obs.subscribe();

      expect(destroyed).toBe(false);

      // emit null — should destroy the previous instance
      subject.next(null);

      setTimeout(() => {
        expect(destroyed).toBe(true);

        // emit another null — should not throw since previous was null
        subject.next(undefined);

        setTimeout(() => {
          subject.complete();
          done();
        });
      });
    })
  );

  it(
    'should not throw when destroying after a nullish value.',
    callbackTest((done) => {
      const subject = new BehaviorSubject<Maybe<Destroyable>>(null);
      const obs = subject.pipe(cleanupDestroyable());

      sub.subscription = obs.subscribe();

      subject.next(makeDestroyable());
      subject.next(null);
      subject.next(undefined);
      subject.next(makeDestroyable());

      setTimeout(() => {
        subject.complete();
        done();
      });
    })
  );
});
