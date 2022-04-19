import { filterMaybe } from '@dereekb/rxjs';
import { SubscriptionObject } from './../subscription';
import { of, timeout } from 'rxjs';
import { Subject } from 'rxjs';
import { first, tap } from 'rxjs/operators';
import { onMatchDelta } from './delta';

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
      sub.subscription = subject.pipe(
        onMatchDelta({
          from,
          to,
          requireConsecutive: true
        }),
        first()
      ).subscribe((value) => {
        expect(value).toBe(to);
        done();
      });

      subject.next(from);
      subject.next(to);
    });

    it('should not emit if the prevous value is not equal to "from" and the current value is equal to "to".', (done) => {
      sub.subscription = subject.pipe(
        onMatchDelta({
          from,
          to,
          requireConsecutive: true
        }),
        first(),
        timeout({
          first: 1000,
          with: () => of(null as any as number).pipe(
            tap(() => done()),
            filterMaybe()
          )
        })
      ).subscribe(() => {
        fail();
      });

      subject.next(from);
      subject.next(2);
      subject.next(to);
    });

  });

  describe('requireConsecutive=false', () => {

    it('should should emit once the target "from" value has been seen once.', () => {
      sub.subscription = subject.pipe(
        onMatchDelta({
          from,
          to,
          requireConsecutive: true
        }),
        first(),
        timeout({
          first: 1000,
          with: () => of(null as any as number).pipe(
            tap(() => fail()),
            filterMaybe()
          )
        })
      ).subscribe((value) => {
        expect(value).toBe(to);
      });

      subject.next(from);
      subject.next(2);
      subject.next(to);
    });

  });

});
