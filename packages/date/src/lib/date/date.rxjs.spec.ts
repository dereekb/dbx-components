import { timeoutStartWith } from '@dereekb/rxjs';
import { MS_IN_DAY } from '@dereekb/util';
import { delay } from 'rxjs';
import { dateInterval } from './date.rxjs';

describe('dateInterval', () => {
  it('should emit the first date value immediately.', (done) => {
    const obs = dateInterval({
      period: MS_IN_DAY
    });

    const sub = obs
      .pipe(
        timeoutStartWith(() => new Date(0), 100), // if the obs never emits, send Date 0
        delay(50) // delay to prevent subscribe from executing immediately
      )
      .subscribe((date) => {
        expect(date).not.toEqual(new Date(0));
        sub.unsubscribe();
        done();
      });
  });

  it('should use the input factory.', (done) => {
    const factoryValue = new Date(1);

    const obs = dateInterval({
      factory: () => factoryValue,
      emitAll: true
    });

    const sub = obs
      .pipe(
        timeoutStartWith(() => new Date(0), 100), // if the obs never emits, send Date 0
        delay(50) // delay to prevent subscribe from executing immediately
      )
      .subscribe((date) => {
        expect(date).toBeSameSecondAs(factoryValue);
        sub.unsubscribe();
        done();
      });
  });

  it('should emit the date value on the given period.', (done) => {
    const obs = dateInterval({
      period: 9,
      logicalDate: 'now',
      emitAll: true
    });

    let i = 0;

    const sub = obs
      .pipe(
        timeoutStartWith(() => new Date(0), 50) // if the obs never emits, send Date 0
      )
      .subscribe((date) => {
        expect(date).not.toBeSameSecondAs(new Date(0));

        i += 1;

        // should emit a few times
        if (i > 5) {
          sub.unsubscribe();
          done();
        }
      });
  });
});
