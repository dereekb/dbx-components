import { shareReplay, Subject } from 'rxjs';
import { SubscriptionObject } from './../subscription';
import { of } from 'rxjs';
import { mapKeysIntersectionToArray } from './map';

describe('mapKeysIntersectionToArray()', () => {

  let sub: SubscriptionObject;

  beforeEach(() => {
    sub = new SubscriptionObject();
  });

  afterEach(() => {
    sub.destroy();
  });

  it('should merge the arrays if both values are present.', (done) => {

    const subject = new Subject<string[]>();

    const numbersA = [1, 2, 3];
    const numbersB = [4, 5, 6];

    const obs = of({
      'a': numbersA,
      'b': numbersB,
    }).pipe(
      mapKeysIntersectionToArray(subject),
      shareReplay(1)
    );

    sub.subscription = obs.subscribe({
      next: (value) => {
        expect(value.length).toBe(6);
        expect(numbersA).toContain(value[0]);
        expect(numbersA).toContain(value[1]);
        expect(numbersA).toContain(value[2]);
        expect(numbersB).toContain(value[3]);
        expect(numbersB).toContain(value[4]);
        expect(numbersB).toContain(value[5]);
        done();
      },
      complete: () => {
        subject.complete();
      }
    });

    subject.next(['a', 'b']);
  });

});
