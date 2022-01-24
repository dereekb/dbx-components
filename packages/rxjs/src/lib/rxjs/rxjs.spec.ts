import { skipFirstMaybe } from '@dereekb/rxjs';

import { Maybe } from '@dereekb/util';
import { BehaviorSubject, Subject } from 'rxjs';
import { first, tap } from 'rxjs/operators';

describe('skipFirstMaybe', () => {

  it('should not skip a first non-maybe value', (done) => {

    const subject = new BehaviorSubject<Maybe<1>>(undefined);
    const obs = subject.pipe(skipFirstMaybe());

    obs.subscribe((x) => {
      expect(x).toBe(1);
      done();
    });

    subject.next(1);

  });

  it('should skip maybe values until the first non-maybe value is provided', (done) => {

    let allowed = false;
    let count = 0;

    const subject = new Subject<Maybe<1>>();
    const obs = subject.pipe(tap(_ => count++), skipFirstMaybe());

    obs.subscribe(() => {
      expect(count).toBe(3);
      expect(allowed).toBe(true);
      done();
    });

    subject.next(undefined);
    subject.next(null);

    allowed = true;

    subject.next(1);
  });

});
