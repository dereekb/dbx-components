import { failTest, callbackTest } from '@dereekb/util/test';
import { skipAllInitialMaybe } from './value';
import { type Maybe } from '@dereekb/util';
import { BehaviorSubject, of, Subject, finalize, tap } from 'rxjs';
import { preventComplete } from './rxjs';

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
