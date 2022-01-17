import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ViewChild, Input } from '@angular/core';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { DbNgxActionComponent } from './action.component';
import { HandleActionFunction } from './action.handler';
import { ActionContextStoreSourceInstance } from './action.store.source';
import { DbNgxActionHandlerDirective } from './handler.directive';
import { DbNgxCoreActionModule } from './action.module';

describe('DbNgxActionContextComponent', () => {

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        DbNgxCoreActionModule,
        NoopAnimationsModule
      ],
      declarations: [
        TestActionComponentComponent
      ]
    }).compileComponents();
  });

  let testComponent: TestActionComponentComponent;

  let component: DbNgxActionComponent<number, number>;
  let handlerDirective: DbNgxActionHandlerDirective<number, number>;

  let fixture: ComponentFixture<TestActionComponentComponent>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(TestActionComponentComponent);
    testComponent = fixture.componentInstance;

    component = testComponent.component!;
    handlerDirective = testComponent.handlerDirective!;
    handlerDirective.handlerFunction = (() => of(0));

    fixture.detectChanges();
  });

  // NOTE: Also tested in action.directive.spec.ts
  describe('DbNgxActionContextComponent', () => {

    it('should be created', () => {
      expect(component).toBeDefined();
    });

    describe('ActionContextStoreSourceInstance', () => {

      let instance: ActionContextStoreSourceInstance<number, number>;

      beforeEach(() => {
        instance = component.sourceInstance;
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

        instance.trigger();
        instance.readyValue(READY_VALUE);

        instance.valueReady$.subscribe((x) => {
          expect(x).toBe(READY_VALUE);
          done();
        });

      });


    });

  });

});

@Component({
  template: `
    <dbx-action [dbxActionHandler]="handlerFunction">
      <p>Content</p>
    </dbx-action>
  `
})
class TestActionComponentComponent {

  @ViewChild(DbNgxActionComponent, { static: true })
  component?: DbNgxActionComponent<number, number>;

  @ViewChild(DbNgxActionHandlerDirective, { static: true })
  handlerDirective?: DbNgxActionHandlerDirective<number, number>;

  @Input()
  handlerFunction?: HandleActionFunction<number, number>;

}
