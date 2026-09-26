import { failTest, callbackTest } from '@dereekb/util/test';
import { skipAllInitialMaybe } from './value';
import { type Maybe } from '@dereekb/util';
import { BehaviorSubject, of, Subject, finalize, tap, shareReplay } from 'rxjs';
import { preventComplete, skipReplayedValues } from './rxjs';

describe('skipAllInitialMaybe()', () => {
  it(
    'should not skip a first non-maybe value',
    callbackTest((done) => {
      const subject = new BehaviorSubject<Maybe<1>>(undefined);
      const obs = subject.pipe(skipAllInitialMaybe());

      obs.subscribe((x) => {
        expect(x).toBe(1);
        subject.complete();
        done();
      });

      subject.next(1);
    })
  );

  it(
    'should skip maybe values until the first non-maybe value is provided',
    callbackTest((done) => {
      let allowed = false;
      let count = 0;

      const subject = new Subject<Maybe<1>>();
      const obs = subject.pipe(
        tap(() => count++),
        skipAllInitialMaybe()
      );

      obs.subscribe(() => {
        expect(count).toBe(3);
        expect(allowed).toBe(true);
        done();
      });

      subject.next(undefined);
      subject.next(null);

      allowed = true;

      subject.next(1);
    })
  );
});

describe('preventComplete', () => {
  it(
    'should not emit complete until unsubscribed from.',
    callbackTest((done) => {
      const x = of(true);

      const obs = preventComplete(x);

      let setComplete = false;

      const sub = obs
        .pipe(
          finalize(() => {
            // finalize will get called.
            expect(setComplete).toBe(true);
            done();
          })
        )
        .subscribe({
          complete: () => {
            failTest(); // complete never gets called here, since we unsubscribe first.
          }
        });

      // wait a timeout before marking complete
      setTimeout(() => {
        setComplete = true;
        sub.unsubscribe();
      });
    })
  );
});

describe('skipReplayedValues()', () => {
  it('should not emit the current value of a BehaviorSubject.', () => {
    const value = new BehaviorSubject(1);
    const values: number[] = [];

    value.pipe(skipReplayedValues()).subscribe((x) => values.push(x));
    expect(values).toEqual([]);

    value.next(2);
    expect(values).toEqual([2]);
  });

  it('should not emit the value replayed by shareReplay().', () => {
    const value = new Subject<number>();
    const shared = value.pipe(shareReplay(1));
    const values: number[] = [];

    shared.subscribe();
    value.next(1);

    shared.pipe(skipReplayedValues()).subscribe((x) => values.push(x));
    expect(values).toEqual([]);

    value.next(2);
    expect(values).toEqual([2]);
  });

  it('should skip every synchronous value of a synchronous observable.', () => {
    const values: number[] = [];
    let completed = false;

    of(1, 2, 3)
      .pipe(skipReplayedValues())
      .subscribe({ next: (x) => values.push(x), complete: () => (completed = true) });

    expect(values).toEqual([]);
    expect(completed).toBe(true);
  });
});
