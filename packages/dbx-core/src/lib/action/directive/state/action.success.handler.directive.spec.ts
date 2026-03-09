import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { delay, filter, first, of } from 'rxjs';
import { SubscriptionObject, type WorkUsingObservable } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { callbackTest } from '@dereekb/util/test';
import { DbxActionDirective } from '../context/action.directive';
import { DbxActionHandlerDirective } from './action.handler.directive';
import { DbxActionSuccessHandlerDirective, type DbxActionSuccessHandlerFunction } from './action.success.handler.directive';

@Component({
  template: `
    <div dbxAction [dbxActionHandler]="handlerFunctionSignal()" [dbxActionSuccessHandler]="successHandlerSignal()"></div>
  `,
  imports: [DbxActionDirective, DbxActionHandlerDirective, DbxActionSuccessHandlerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
class TestDbxActionSuccessHandlerDirectiveComponent {
  readonly directive = viewChild.required(DbxActionDirective);
  readonly successHandlerDirective = viewChild.required(DbxActionSuccessHandlerDirective);
  readonly handlerFunctionSignal = signal<Maybe<WorkUsingObservable<number, number>>>(undefined);
  readonly successHandlerSignal = signal<Maybe<DbxActionSuccessHandlerFunction<number>>>(undefined);
}

describe('DbxActionSuccessHandlerDirective', () => {
  let testComponent: TestDbxActionSuccessHandlerDirectiveComponent;
  let fixture: ComponentFixture<TestDbxActionSuccessHandlerDirectiveComponent>;
  let directive: DbxActionDirective<number, number>;

  const sub = new SubscriptionObject();

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TestDbxActionSuccessHandlerDirectiveComponent);
    testComponent = fixture.componentInstance;
    testComponent.handlerFunctionSignal.set(() => of(0));

    fixture.detectChanges();

    directive = testComponent.directive() as DbxActionDirective<number, number>;
  });

  afterEach(() => {
    sub.destroy();
    TestBed.resetTestingModule();
  });

  it('should be created', () => {
    expect(testComponent.successHandlerDirective()).toBeDefined();
  });

  it(
    'should execute the success handler function on success',
    callbackTest((done) => {
      const READY_VALUE = 1;
      const SUCCESS_VALUE = 42;

      testComponent.handlerFunctionSignal.set(() => of(SUCCESS_VALUE));
      testComponent.successHandlerSignal.set((value) => {
        expect(value).toBe(SUCCESS_VALUE);
        done();
      });

      fixture.detectChanges();

      directive.sourceInstance.trigger();
      directive.sourceInstance.readyValue(READY_VALUE);
    })
  );

  it(
    'should execute the success handler function even after the component is destroyed',
    callbackTest((done) => {
      const READY_VALUE = 1;
      const SUCCESS_VALUE = 99;
      const HANDLER_DELAY_MS = 200;

      // Use a delayed handler to simulate async work
      testComponent.handlerFunctionSignal.set(() => of(SUCCESS_VALUE).pipe(delay(HANDLER_DELAY_MS)));
      testComponent.successHandlerSignal.set((value) => {
        // This should still fire even though the component was destroyed while working.
        // This works because cleanSubscriptionWithLockSet waits for the lockSet to unlock
        // (i.e., the work to complete) before destroying the subscription.
        expect(value).toBe(SUCCESS_VALUE);
        done();
      });

      fixture.detectChanges();

      directive.sourceInstance.trigger();
      directive.sourceInstance.readyValue(READY_VALUE);

      // Wait for the action to start working, then destroy the fixture
      sub.subscription = directive.sourceInstance.isWorking$
        .pipe(
          filter((isWorking) => isWorking),
          first()
        )
        .subscribe(() => {
          fixture.destroy();
        });
    })
  );
});
