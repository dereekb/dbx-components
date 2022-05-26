import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ViewChild, Input } from '@angular/core';
import { first, tap, of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { DbxActionDirective } from './action.directive';
import { DbxActionHandlerDirective } from '../state/action.handler.directive';
import { DbxCoreActionModule } from '../../action.module';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { HandleActionFunction } from '../../action.handler';

describe('DbxActionDirective', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [DbxCoreActionModule, NoopAnimationsModule],
      declarations: [TestActionContextDirectiveComponent]
    }).compileComponents();
  });

  let testComponent: TestActionContextDirectiveComponent;

  let directive: DbxActionDirective<number, number>;
  let handlerDirective: DbxActionHandlerDirective<number, number>;

  let fixture: ComponentFixture<TestActionContextDirectiveComponent>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(TestActionContextDirectiveComponent);
    testComponent = fixture.componentInstance;

    directive = testComponent.directive!;
    handlerDirective = testComponent.handlerDirective!;
    handlerDirective.handlerFunction = () => of(0);

    fixture.detectChanges();
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

        handlerDirective.handlerFunction = () => of(SUCCESS_VALUE).pipe(tap(() => (triggered = true)));

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
    <div #action="action" dbxActionContext [dbxActionHandler]="handlerFunction"></div>
  `
})
class TestActionContextDirectiveComponent {
  @ViewChild(DbxActionDirective, { static: true })
  directive?: DbxActionDirective<number, number>;

  @ViewChild(DbxActionHandlerDirective, { static: true })
  handlerDirective?: DbxActionHandlerDirective<number, number>;

  @Input()
  handlerFunction?: HandleActionFunction<number, number>;
}
