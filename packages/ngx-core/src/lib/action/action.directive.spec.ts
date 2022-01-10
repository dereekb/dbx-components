import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ViewChild, Input, Directive, ContentChild, AfterViewInit, OnInit } from '@angular/core';
import { Observable, of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { DbNgxActionContextDirective } from './action.directive';
import { DbNgxActionHandlerDirective } from './handler.directive';
import { DbNgxActionModule } from './action.module';
import { first, tap } from 'rxjs/operators';
import { ActionContextStore } from './action.store';
import { ActionContextStoreSourceInstance } from './action';
import { HandleActionFunction } from './action.handler';

describe('DbNgxActionContextDirective', () => {

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        DbNgxActionModule,
        NoopAnimationsModule
      ],
      declarations: [
        TestActionContextDirectiveComponent
      ]
    }).compileComponents();
  });

  let testComponent: TestActionContextDirectiveComponent;

  let directive: DbNgxActionContextDirective<number, number>;
  let handlerDirective: DbNgxActionHandlerDirective<number, number>;

  let fixture: ComponentFixture<TestActionContextDirectiveComponent>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(TestActionContextDirectiveComponent);
    testComponent = fixture.componentInstance;

    directive = testComponent.directive!;
    handlerDirective = testComponent.handlerDirective!;
    handlerDirective.handlerFunction = (() => of(0));

    fixture.detectChanges();
  });

  describe('dbxActionContext', () => {

    it('should be created', () => {
      expect(directive).toBeDefined();
    });

    describe('ActionContextStoreSourceInstance', () => {

      let instance: ActionContextStoreSourceInstance<number, number>;

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

      it('should set value ready on valueReady()', (done) => {
        const READY_VALUE = 1;

        // Clear to prevent issues.
        handlerDirective.handlerFunction = undefined;

        instance.readyValue(READY_VALUE);

        instance.valueReady$.subscribe((x) => {
          expect(x).toBe(READY_VALUE);
          done();
        });

      });


    });

    describe('ActionContextStore', () => {

      let contextStore: ActionContextStore<number, number>;

      beforeEach(async () => {
        contextStore = await directive.store$.toPromise();
      });

      it('should set state to triggered on trigger()', (done) => {
        contextStore.trigger();

        contextStore.triggered$.subscribe((x) => {
          expect(x).toBe(true);
          done();
        });

      });

      it('should set value ready on valueReady()', (done) => {
        const READY_VALUE = 1;

        // Clear to prevent issues.
        handlerDirective.handlerFunction = undefined;

        contextStore.readyValue(READY_VALUE);

        contextStore.valueReady$.subscribe((x) => {
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

        handlerDirective.handlerFunction = () => of(SUCCESS_VALUE).pipe(tap(() => triggered = true));

        directive.sourceInstance.trigger();
        directive.sourceInstance.readyValue(READY_VALUE);

        directive.sourceInstance.success$.pipe(first()).subscribe((successValue) => {
          expect(successValue).toBe(SUCCESS_VALUE);
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

  @ViewChild(DbNgxActionContextDirective, { static: true })
  directive?: DbNgxActionContextDirective<number, number>;

  @ViewChild(DbNgxActionHandlerDirective, { static: true })
  handlerDirective?: DbNgxActionHandlerDirective<number, number>;

  @Input()
  handlerFunction?: HandleActionFunction<number, number>;

  constructor() { }

}
