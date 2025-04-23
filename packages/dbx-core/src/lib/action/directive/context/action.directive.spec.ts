import { ChangeDetectionStrategy, Component, ViewChild, input, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { first, of, tap } from 'rxjs';
import { WorkUsingObservable } from '@dereekb/rxjs';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { DbxActionDirective } from './action.directive';
import { DbxActionHandlerDirective } from '../state/action.handler.directive';
import { DbxCoreActionModule } from '../../action.module';

describe('DbxActionDirective', () => {
  let testComponent: TestActionContextDirectiveComponent;

  let directive: DbxActionDirective<number, number>;
  let handlerDirective: DbxActionHandlerDirective<number, number>;

  let fixture: ComponentFixture<TestActionContextDirectiveComponent>;

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

      it('should set state to triggered on trigger()', (done) => {
        instance.trigger();

        instance.triggered$.subscribe((x) => {
          expect(x).toBe(true);
          done();
        });
      });

      it('should set value ready on valueReady() if already triggered', (done) => {
        const READY_VALUE = 1;

        instance.trigger();
        instance.readyValue(READY_VALUE);

        instance.valueReady$.subscribe((x) => {
          expect(x).toBe(READY_VALUE);
          done();
        });
      });
    });
  });

  describe('dbxActionHandler', () => {
    it('should be created', () => {
      expect(handlerDirective).toBeDefined();
    });

    describe('handler function', () => {
      it('should use the handler function on action', (done) => {
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

        directive.sourceInstance.success$.pipe(first()).subscribe((successValue) => {
          expect(successValue).toBe(SUCCESS_VALUE);
          expect(triggered).toBe(true);
          done();
        });
      });

      describe('with observable return', () => {
        // TODO
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
