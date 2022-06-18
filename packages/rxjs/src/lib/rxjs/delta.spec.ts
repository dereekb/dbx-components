import { filterMaybe } from '@dereekb/rxjs';
import { SubscriptionObject } from './../subscription';
import { of, timeout, first, tap, Subject } from 'rxjs';
import { onMatchDelta } from './delta';
import { failDueToSuccess, failDueToSuccessError, failWithDoneDueToSuccess, failWithJestDoneCallback } from '@dereekb/util/test';
import { tapAfterTimeout, throwErrorAfterTimeout } from './timeout';

describe('onMatchDelta', () => {
  const from = 0;
  const to = 1;

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

  describe('requireConsecutive=true', () => {
    it('should emit if the prevous value is equal to "from" and the current value is equal to "to".', (done) => {
      sub.subscription = subject
        .pipe(
          onMatchDelta({
            from,
            to,
            requireConsecutive: true
          }),
          first()
        )
        .subscribe((value) => {
          expect(value).toBe(to);
          done();
        });

      subject.next(from);
      subject.next(to);
    });

    it('should not emit if the prevous value is not equal to "from" and the current value is equal to "to".', (done) => {
      sub.subscription = subject
        .pipe(
          onMatchDelta({
            from,
            to,
            requireConsecutive: true
          }),
          first(),
          tapAfterTimeout(1000, () => done())
        )
        .subscribe(() => {
          failWithJestDoneCallback(done);
        });

      subject.next(from);
      subject.next(2);
      subject.next(to);
    });
  });

  describe('requireConsecutive=false', () => {
    it('should should emit once the target "from" value has been seen once followed by the "to" value at any time.', (done) => {
      sub.subscription = subject
        .pipe(
          onMatchDelta({
            from,
            to,
            requireConsecutive: false
          }),
          first(),
          tapAfterTimeout(1000, () => failWithJestDoneCallback(done))
        )
        .subscribe((value) => {
          expect(value).toBe(to);
          done();
        });

      subject.next(from);
      subject.next(2);
      subject.next(3);
      subject.next(4);
      subject.next(5);
      subject.next(6);
      subject.next(to);
    });
  });
});
