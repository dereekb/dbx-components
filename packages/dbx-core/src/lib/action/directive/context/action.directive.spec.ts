import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { delay, filter, first, map, of, tap, throwError, timer } from 'rxjs';
import { SubscriptionObject, WorkUsingObservable } from '@dereekb/rxjs';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { DbxActionDirective } from './action.directive';
import { DbxActionHandlerDirective } from '../state/action.handler.directive';
import { DbxCoreActionModule } from '../../action.module';
import { callbackTest } from '@dereekb/util/test';

describe('DbxActionDirective', () => {
  let testComponent: TestActionContextDirectiveComponent;

  let directive: DbxActionDirective<number, number>;
  let handlerDirective: DbxActionHandlerDirective<number, number>;

  let fixture: ComponentFixture<TestActionContextDirectiveComponent>;

  const sub = new SubscriptionObject();

  afterEach(() => {
    sub.destroy(); // clean up our subscriptions
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestActionContextDirectiveComponent]
    });

    fixture = TestBed.createComponent(TestActionContextDirectiveComponent);
    testComponent = fixture.componentInstance;
    testComponent.handlerFunctionSignal.set(() => of(0));

    fixture.detectChanges();

    directive = testComponent.directive() as DbxActionDirective<number, number>;
    handlerDirective = testComponent.handlerDirective() as DbxActionHandlerDirective<number, number>;
  });

  describe('dbxActionContext', () => {
    it('should be created', () => {
      expect(directive).toBeDefined();
    });

    describe('DbxActionContextStoreSourceInstance', () => {
      let instance: DbxActionContextStoreSourceInstance<number, number>;

      beforeEach(() => {
        instance = directive.sourceInstance;
      });

      it(
        'should set state to triggered on trigger()',
        callbackTest((done) => {
          instance.trigger();

          instance.triggered$.subscribe((x) => {
            expect(x).toBe(true);
            done();
          });
        })
      );

      it(
        'should set value ready on valueReady() if already triggered',
        callbackTest((done) => {
          const READY_VALUE = 1;

          instance.trigger();
          instance.readyValue(READY_VALUE);

          sub.subscription = instance.valueReady$.subscribe((x) => {
            expect(x).toBe(READY_VALUE);
            done();
          });
        })
      );
    });
  });

  describe('dbxActionHandler', () => {
    it('should be created', () => {
      expect(handlerDirective).toBeDefined();
    });

    describe('handler function', () => {
      it(
        'should use the handler function on action',
        callbackTest((done) => {
          let triggered = false;
          const READY_VALUE = 0;
          const SUCCESS_VALUE = 123;

          testComponent.handlerFunctionSignal.set(() =>
            of(SUCCESS_VALUE).pipe(
              tap(() => {
                triggered = true;
              })
            )
          );

          fixture.detectChanges();

          expect(handlerDirective.handlerFunction()).toBeDefined();

          directive.sourceInstance.trigger();
          directive.sourceInstance.readyValue(READY_VALUE);

          sub.subscription = directive.sourceInstance.success$.pipe(first()).subscribe((successValue) => {
            expect(successValue).toBe(SUCCESS_VALUE);
            expect(triggered).toBe(true);
            done();
          });
        })
      );

      describe('with observable return', () => {
        it(
          'should handle delayed observable emissions',
          callbackTest((done) => {
            const READY_VALUE = 0;
            const SUCCESS_VALUE = 456;

            testComponent.handlerFunctionSignal.set(() => of(SUCCESS_VALUE).pipe(delay(100)));

            fixture.detectChanges();

            directive.sourceInstance.trigger();
            directive.sourceInstance.readyValue(READY_VALUE);

            sub.subscription = directive.sourceInstance.success$.pipe(first()).subscribe((successValue) => {
              expect(successValue).toBe(SUCCESS_VALUE);
              done();
            });
          })
        );

        it(
          'should handle timer-based observables',
          callbackTest((done) => {
            const READY_VALUE = 5;
            const TIMER_VALUE = 999;

            testComponent.handlerFunctionSignal.set(() => timer(50).pipe(map(() => TIMER_VALUE)));

            fixture.detectChanges();

            directive.sourceInstance.trigger();
            directive.sourceInstance.readyValue(READY_VALUE);

            sub.subscription = directive.sourceInstance.success$.pipe(first()).subscribe((successValue) => {
              expect(successValue).toBe(TIMER_VALUE);
              done();
            });
          })
        );

        it(
          'should handle errors from observables',
          callbackTest((done) => {
            const READY_VALUE = 0;
            const ERROR_MESSAGE = 'Test error';

            testComponent.handlerFunctionSignal.set(() => throwError(() => new Error(ERROR_MESSAGE)));

            fixture.detectChanges();

            directive.sourceInstance.trigger();
            directive.sourceInstance.readyValue(READY_VALUE);

            sub.subscription = directive.sourceInstance.error$.pipe(first()).subscribe((error) => {
              expect(error).toBeDefined();
              expect(error?.message).toBe(ERROR_MESSAGE);
              done();
            });
          })
        );

        it(
          'should handle observables with multiple transformations',
          callbackTest((done) => {
            const READY_VALUE = 10;
            const INITIAL_VALUE = 5;
            const EXPECTED_VALUE = INITIAL_VALUE * 2 + 10; // (5 * 2) + 10 = 20

            testComponent.handlerFunctionSignal.set((input) =>
              of(INITIAL_VALUE).pipe(
                map((x) => x * 2),
                map((x) => x + input),
                delay(50)
              )
            );

            fixture.detectChanges();

            directive.sourceInstance.trigger();
            directive.sourceInstance.readyValue(READY_VALUE);

            sub.subscription = directive.sourceInstance.success$.pipe(first()).subscribe((successValue) => {
              expect(successValue).toBe(EXPECTED_VALUE);
              done();
            });
          })
        );

        it(
          'should handle async observable that completes after delay',
          callbackTest((done) => {
            const READY_VALUE = 0;
            const SUCCESS_VALUE = 789;

            testComponent.handlerFunctionSignal.set(() => timer(100).pipe(map(() => SUCCESS_VALUE)));

            fixture.detectChanges();

            directive.sourceInstance.trigger();
            directive.sourceInstance.readyValue(READY_VALUE);

            sub.subscription = directive.sourceInstance.success$.pipe(first()).subscribe((successValue) => {
              expect(successValue).toBe(SUCCESS_VALUE);
              done();
            });
          })
        );

        it(
          'should handle observables that use the input value',
          callbackTest((done) => {
            const READY_VALUE = 42;
            const MULTIPLIER = 3;

            testComponent.handlerFunctionSignal.set((input) => of(input * MULTIPLIER));

            fixture.detectChanges();

            directive.sourceInstance.trigger();
            directive.sourceInstance.readyValue(READY_VALUE);

            sub.subscription = directive.sourceInstance.success$.pipe(first()).subscribe((successValue) => {
              expect(successValue).toBe(READY_VALUE * MULTIPLIER);
              done();
            });
          })
        );
      });
    });
  });
});

@Component({
  template: `
    <div #action="action" dbxActionContext [dbxActionHandler]="handlerFunctionSignal()"></div>
  `,
  imports: [DbxCoreActionModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
class TestActionContextDirectiveComponent {
  readonly directive = viewChild.required<DbxActionDirective<number, number>>(DbxActionDirective);
  readonly handlerDirective = viewChild.required<DbxActionHandlerDirective<number, number>>(DbxActionHandlerDirective);

  readonly handlerFunctionSignal = signal<WorkUsingObservable<number, number> | undefined>(undefined);
}
