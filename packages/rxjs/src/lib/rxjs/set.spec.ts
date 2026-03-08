import { BehaviorSubject, first, Subject } from 'rxjs';
import { SubscriptionObject } from '../subscription';
import { setContainsAllValuesFrom, setContainsAnyValueFrom, setContainsNoValueFrom, distinctUntilHasDifferentValues } from './set';
import { callbackTest } from '@dereekb/util/test';

describe('setContainsAllValuesFrom', () => {
  it(
    'should return true when the set contains all values',
    callbackTest((done) => {
      const set$ = new BehaviorSubject(new Set([1, 2, 3]));
      const values$ = new BehaviorSubject([1, 2]);

      set$.pipe(setContainsAllValuesFrom(values$), first()).subscribe((result) => {
        expect(result).toBe(true);
        done();
      });
    })
  );

  it(
    'should return false when the set is missing a value',
    callbackTest((done) => {
      const set$ = new BehaviorSubject(new Set([1, 2]));
      const values$ = new BehaviorSubject([1, 2, 3]);

      set$.pipe(setContainsAllValuesFrom(values$), first()).subscribe((result) => {
        expect(result).toBe(false);
        done();
      });
    })
  );
});

describe('setContainsAnyValueFrom', () => {
  it(
    'should return true when the set contains any of the values',
    callbackTest((done) => {
      const set$ = new BehaviorSubject(new Set([1, 5]));
      const values$ = new BehaviorSubject([1, 2]);

      set$.pipe(setContainsAnyValueFrom(values$), first()).subscribe((result) => {
        expect(result).toBe(true);
        done();
      });
    })
  );

  it(
    'should return false when the set contains none of the values',
    callbackTest((done) => {
      const set$ = new BehaviorSubject(new Set([5, 6]));
      const values$ = new BehaviorSubject([1, 2]);

      set$.pipe(setContainsAnyValueFrom(values$), first()).subscribe((result) => {
        expect(result).toBe(false);
        done();
      });
    })
  );
});

describe('setContainsNoValueFrom', () => {
  it(
    'should return true when the set contains none of the values',
    callbackTest((done) => {
      const set$ = new BehaviorSubject(new Set([5, 6]));
      const values$ = new BehaviorSubject([1, 2]);

      set$.pipe(setContainsNoValueFrom(values$), first()).subscribe((result) => {
        expect(result).toBe(true);
        done();
      });
    })
  );
});

describe('distinctUntilHasDifferentValues', () => {
  let sub: SubscriptionObject;

  beforeEach(() => {
    sub = new SubscriptionObject();
  });

  afterEach(() => {
    sub.destroy();
  });

  it('should only emit when the iterable values change', () => {
    const subject = new Subject<number[]>();
    const results: number[][] = [];

    sub.subscription = subject.pipe(distinctUntilHasDifferentValues()).subscribe((value) => results.push(value));

    subject.next([1, 2]);
    subject.next([1, 2]); // same values
    subject.next([1, 3]); // different

    expect(results.length).toBe(2);

    subject.complete();
  });
});
