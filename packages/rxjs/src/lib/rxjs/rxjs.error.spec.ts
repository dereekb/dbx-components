import { Subject } from 'rxjs';
import { SubscriptionObject } from '../subscription';
import { errorOnEmissionsInPeriod } from './rxjs.error';
import { callbackTest } from '@dereekb/util/test';

describe('errorOnEmissionsInPeriod', () => {
  let subject: Subject<number>;
  let sub: SubscriptionObject;

  beforeEach(() => {
    subject = new Subject<number>();
    sub = new SubscriptionObject();
  });

  afterEach(() => {
    sub.destroy();
    subject.complete();
  });

  it(
    'should allow emissions under the limit',
    callbackTest((done) => {
      const results: number[] = [];

      sub.subscription = subject.pipe(errorOnEmissionsInPeriod({ maxEmissionsPerPeriod: 5, period: 10000 })).subscribe((value) => results.push(value));

      subject.next(1);
      subject.next(2);
      subject.next(3);

      expect(results).toEqual([1, 2, 3]);
      done();
    })
  );

  it(
    'should throw an error when emissions exceed the limit',
    callbackTest((done) => {
      let caughtError: unknown;

      sub.subscription = subject.pipe(errorOnEmissionsInPeriod({ maxEmissionsPerPeriod: 2, period: 10000 })).subscribe({
        next: () => {},
        error: (err) => {
          caughtError = err;
          expect((caughtError as Error).message).toContain('Too many emissions');
          done();
        }
      });

      // counter: call1=0, call2=1, call3=2, call4=3 (3 > 2 triggers error)
      subject.next(1);
      subject.next(2);
      subject.next(3);
      subject.next(4);
    })
  );

  it(
    'should call onError before throwing',
    callbackTest((done) => {
      const onError = vi.fn();

      sub.subscription = subject.pipe(errorOnEmissionsInPeriod({ maxEmissionsPerPeriod: 1, period: 10000, onError })).subscribe({
        error: () => {
          expect(onError).toHaveBeenCalled();
          done();
        }
      });

      // counter: call1=0, call2=1, call3=2 (2 > 1 triggers error)
      subject.next(1);
      subject.next(2);
      subject.next(3);
    })
  );

  it(
    'should use custom error message',
    callbackTest((done) => {
      sub.subscription = subject.pipe(errorOnEmissionsInPeriod({ maxEmissionsPerPeriod: 1, period: 10000, errorMessage: 'custom error' })).subscribe({
        error: (err) => {
          expect((err as Error).message).toBe('custom error');
          done();
        }
      });

      subject.next(1);
      subject.next(2);
      subject.next(3);
    })
  );
});
