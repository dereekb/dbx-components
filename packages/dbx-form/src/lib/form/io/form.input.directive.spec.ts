import { preventComplete, SubscriptionObject } from '@dereekb/rxjs';
import { of, BehaviorSubject, timeout, bufferCount, first, Subject, map } from 'rxjs';
import { DbxFormState } from '../form';
import { dbxFormSourceObservableFromStream } from './form.input.directive';
import { callbackTest } from '@dereekb/util/test';

describe('dbxFormSourceObservableFromStream()', () => {
  const TIMEOUT_VALUE = 'timeout';

  let subscriptionObject: SubscriptionObject;

  beforeEach(() => {
    subscriptionObject = new SubscriptionObject();
  });

  afterEach(() => {
    subscriptionObject.destroy();
  });

  function testTimeout(first = 100) {
    return timeout({
      first,
      with: () => of(TIMEOUT_VALUE)
    });
  }

  it(
    'should complete when the state stream and mode and value obs completes.',
    callbackTest((done) => {
      subscriptionObject.subscription = dbxFormSourceObservableFromStream(
        of({
          state: DbxFormState.INITIALIZING
        }),
        of(1),
        of('always')
      ).subscribe({
        complete: () => {
          done();
        }
      });
    })
  );

  describe('mode', () => {
    describe('reset', () => {
      it(
        'should not pipe values when the state is INITIALIZING.',
        callbackTest((done) => {
          const values = new BehaviorSubject<number>(0);

          const obs$ = dbxFormSourceObservableFromStream(
            preventComplete(
              of({
                state: DbxFormState.INITIALIZING
              })
            ), // either being completed will cause the
            values,
            preventComplete(of('reset'))
          );

          subscriptionObject.subscription = obs$.pipe(testTimeout()).subscribe({
            next: (x) => {
              expect(x).toBe(TIMEOUT_VALUE);
              done();
            }
          });
        })
      );

      it(
        'should not pipe values when the state is INITIALIZING.',
        callbackTest((done) => {
          const values = new BehaviorSubject<number>(0);

          const obs$ = dbxFormSourceObservableFromStream(
            preventComplete(
              of({
                state: DbxFormState.USED
              })
            ), // either being completed will cause the
            values,
            preventComplete(of('reset'))
          );

          subscriptionObject.subscription = obs$.pipe(testTimeout()).subscribe({
            next: (x) => {
              expect(x).toBe(TIMEOUT_VALUE);
              done();
            }
          });
        })
      );

      it(
        'should only pipe the first value when the state is RESET and ignore subsequent source changes.',
        callbackTest((done) => {
          const values = new Subject<number>();

          const obs$ = dbxFormSourceObservableFromStream(
            preventComplete(
              of({
                state: DbxFormState.RESET
              })
            ),
            values,
            preventComplete(of('reset'))
          );

          // bufferCount(2) waits for a second value that should never arrive
          subscriptionObject.subscription = obs$.pipe(bufferCount(2), testTimeout(200), first()).subscribe({
            next: (x) => {
              expect(x).toBe(TIMEOUT_VALUE); // timeout proves only 1 value was emitted
              done();
            }
          });

          // emit multiple values while state stays RESET — only the first should be forwarded
          values.next(0);
          values.next(1);
          values.next(2);
        })
      );

      it(
        'should only pipe values while the state is RESET.',
        callbackTest((done) => {
          const state$ = new BehaviorSubject<DbxFormState>(DbxFormState.INITIALIZING);
          const values$ = new Subject<number>();

          const obs$ = dbxFormSourceObservableFromStream(state$.pipe(map((state) => ({ state }))), values$, preventComplete(of('reset')));

          subscriptionObject.subscription = obs$.pipe(bufferCount(3), testTimeout(), first()).subscribe({
            next: (x) => {
              expect(x).toBe(TIMEOUT_VALUE); // time out to show a 3rd value did not come through.
              done();
            }
          });

          values$.next(0);
          values$.next(1);
          state$.next(DbxFormState.RESET);
          values$.next(2);
          state$.next(DbxFormState.USED);
          values$.next(3);
        })
      );

      it(
        'should pipe the first value recieved when reset occurs',
        callbackTest((done) => {
          const value = 0;
          const state$ = new BehaviorSubject<DbxFormState>(DbxFormState.INITIALIZING);
          const values$ = new Subject<number>();

          const obs$ = dbxFormSourceObservableFromStream(state$.pipe(map((state) => ({ state }))), values$, preventComplete(of('reset')));

          subscriptionObject.subscription = obs$.pipe(testTimeout(), first()).subscribe({
            next: (x) => {
              expect(x).toBe(value);
              done();
            }
          });

          values$.next(value);
          state$.next(DbxFormState.RESET);
          state$.next(DbxFormState.USED);
        })
      );

      it(
        'should forward the latest value on each RESET after USED',
        callbackTest((done) => {
          const state$ = new BehaviorSubject<DbxFormState>(DbxFormState.INITIALIZING);
          const values$ = new BehaviorSubject<number>(0);

          const obs$ = dbxFormSourceObservableFromStream(state$.pipe(map((state) => ({ state }))), values$, preventComplete(of('reset')));

          const received: number[] = [];

          subscriptionObject.subscription = obs$.subscribe({
            next: (x) => {
              received.push(x as number);

              if (received.length === 2) {
                expect(received).toEqual([0, 2]);
                done();
              }
            }
          });

          // 1) Initial RESET → forward 0
          state$.next(DbxFormState.RESET);
          // 2) Form is used (user interacts)
          state$.next(DbxFormState.USED);
          // 3) Source value changes while form is in use — ignored
          values$.next(1);
          values$.next(2);
          // 4) Form is explicitly reset → forward latest value (2)
          state$.next(DbxFormState.RESET);
        })
      );
    });

    describe('always', () => {
      it(
        'should not pipe values when the state is INITIALIZING.',
        callbackTest((done) => {
          const values = new BehaviorSubject<number>(0);

          const obs$ = dbxFormSourceObservableFromStream(
            preventComplete(
              of({
                state: DbxFormState.INITIALIZING
              })
            ),
            values,
            preventComplete(of('always'))
          );

          subscriptionObject.subscription = obs$.pipe(testTimeout()).subscribe({
            next: (x) => {
              expect(x).toBe(TIMEOUT_VALUE);
              done();
            }
          });
        })
      );

      it(
        'should not pipe values when the state is changing between other non-initialized states.',
        callbackTest((done) => {
          // tests the case where the DbxFormState would change between RESET to USED, then pipe the previous value again, causing the form to reset.

          const state$ = new BehaviorSubject<DbxFormState>(DbxFormState.INITIALIZING);
          const values$ = new Subject<number>();

          const obs$ = dbxFormSourceObservableFromStream(state$.pipe(map((state) => ({ state }))), values$, preventComplete(of('reset')));

          subscriptionObject.subscription = obs$.pipe(bufferCount(3), testTimeout(), first()).subscribe({
            next: (x) => {
              expect(x).toBe(TIMEOUT_VALUE); // should only pipe values when values$ changes and the state is not initialized.
              done();
            }
          });

          values$.next(0);
          state$.next(DbxFormState.RESET);
          state$.next(DbxFormState.USED);
          state$.next(DbxFormState.USED);
          state$.next(DbxFormState.USED);
          values$.next(1);
          state$.next(DbxFormState.RESET);
          state$.next(DbxFormState.USED);
        })
      );

      it(
        'should pipe values when the state is RESET.',
        callbackTest((done) => {
          const value = 0;
          const values = new BehaviorSubject<number>(value);

          const obs$ = dbxFormSourceObservableFromStream(
            preventComplete(
              of({
                state: DbxFormState.RESET
              })
            ),
            values,
            preventComplete(of('always'))
          );

          subscriptionObject.subscription = obs$.pipe(testTimeout()).subscribe({
            next: (x) => {
              expect(x).toBe(value);
              done();
            }
          });
        })
      );

      it(
        'should pipe values when the state is USED.',
        callbackTest((done) => {
          const value = 0;
          const values = new BehaviorSubject<number>(value);

          const obs$ = dbxFormSourceObservableFromStream(
            preventComplete(
              of({
                state: DbxFormState.USED
              })
            ),
            values,
            preventComplete(of('every'))
          );

          subscriptionObject.subscription = obs$.pipe(testTimeout()).subscribe({
            next: (x) => {
              expect(x).toBe(value);
              done();
            }
          });
        })
      );

      it(
        'should continue to pipe values while the state is not INITIALIZING.',
        callbackTest((done) => {
          const additionalValues = [0, 1, 2];
          const values = new Subject<number>();

          const obs$ = dbxFormSourceObservableFromStream(
            preventComplete(
              of({
                state: DbxFormState.USED
              })
            ),
            values,
            preventComplete(of('every'))
          );

          const valuesCount = 3;

          subscriptionObject.subscription = obs$.pipe(bufferCount(3), first()).subscribe({
            next: (x) => {
              expect(x.length).toBe(valuesCount);
              expect(x[0]).toBe(0);
              expect(x[1]).toBe(1);
              expect(x[2]).toBe(2);
              done();
            }
          });

          additionalValues.forEach((x) => values.next(x));
        })
      );
    });
  });
});
