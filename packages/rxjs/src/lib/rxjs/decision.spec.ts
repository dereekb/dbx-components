import { first, of, Subject } from 'rxjs';
import { SubscriptionObject } from '../subscription';
import { filterItemsWithObservableDecision, invertObservableDecision } from './decision';
import { callbackTest } from '@dereekb/util/test';

describe('invertObservableDecision', () => {
  it('should negate the decision result', () => {
    const alwaysTrue = () => of(true);
    const inverted = invertObservableDecision(alwaysTrue);

    return new Promise<void>((resolve) => {
      inverted('any')
        .pipe(first())
        .subscribe((result) => {
          expect(result).toBe(false);
          resolve();
        });
    });
  });

  it('should return the original function when invert is false', () => {
    const alwaysTrue = () => of(true);
    const notInverted = invertObservableDecision(alwaysTrue, false);

    return new Promise<void>((resolve) => {
      notInverted('any')
        .pipe(first())
        .subscribe((result) => {
          expect(result).toBe(true);
          resolve();
        });
    });
  });
});

describe('filterItemsWithObservableDecision', () => {
  let sub: SubscriptionObject;

  beforeEach(() => {
    sub = new SubscriptionObject();
  });

  afterEach(() => {
    sub.destroy();
  });

  it(
    'should filter items based on the observable decision',
    callbackTest((done) => {
      const isEven = (x: number) => of(x % 2 === 0);
      const source = new Subject<number[]>();

      sub.subscription = source.pipe(filterItemsWithObservableDecision(isEven), first()).subscribe((result) => {
        expect(result).toEqual([2, 4]);
        done();
      });

      source.next([1, 2, 3, 4, 5]);
    })
  );

  it(
    'should return empty array for empty input',
    callbackTest((done) => {
      const isEven = (x: number) => of(x % 2 === 0);
      const source = new Subject<number[]>();

      sub.subscription = source.pipe(filterItemsWithObservableDecision(isEven), first()).subscribe((result) => {
        expect(result).toEqual([]);
        done();
      });

      source.next([]);
    })
  );
});
