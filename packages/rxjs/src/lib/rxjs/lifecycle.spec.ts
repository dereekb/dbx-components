import { SubscriptionObject } from './../subscription';
import { BehaviorSubject } from 'rxjs';
import { cleanup } from './lifecycle';
import { makePromiseFullRef, PromiseFullRef, waitForMs } from '@dereekb/util';

describe('cleanup()', () => {

  let sub: SubscriptionObject;

  beforeEach(() => {
    sub = new SubscriptionObject();
  });

  afterEach(() => {
    sub.destroy();
  });

  it('should call the destroy function when a new value is presented.', (done) => {

    let destroyed = false;

    const initialValue = 1;

    const subject = new BehaviorSubject<number>(initialValue);

    const obs = subject.pipe(cleanup((x) => {
      expect(x).toBe(initialValue);
      destroyed = true;
    }));

    sub.subscription = obs.subscribe();

    expect(destroyed).toBe(false);

    subject.next(2);

    setTimeout(() => {

      expect(destroyed).toBe(true);

      done();
    });
  });

  it('should wait for the destroy function to finish before the next value is passed.', (done) => {


    const initialValue = 1;
    const secondValue = 2;

    const wait = true;
    let destroyed = false;
    let isDone = false;

    const subject = new BehaviorSubject<number>(initialValue);
    let promiseRef: PromiseFullRef;

    const obs = subject.pipe(cleanup(() => {

      // this promise will not resolve until we call resolve externally.
      promiseRef = makePromiseFullRef(() => 0);

      return promiseRef.promise.then(() => {
        destroyed = true;
      });
    }, wait));

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
      done();
    });
  });

});
