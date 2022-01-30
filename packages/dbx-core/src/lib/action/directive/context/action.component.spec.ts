import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ViewChild, Input } from '@angular/core';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { DbxActionComponent } from './action.component';
import { HandleActionFunction } from '../../action.handler';
import { ActionContextStoreSourceInstance } from '../../action.store.source';
import { DbxActionHandlerDirective } from '../state/action.handler.directive';
import { DbxCoreActionModule } from '../../action.module';

describe('DbxActionContextComponent', () => {

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        DbxCoreActionModule,
        NoopAnimationsModule
      ],
      declarations: [
        TestActionComponentComponent
      ]
    }).compileComponents();
  });

  let testComponent: TestActionComponentComponent;

  let component: DbxActionComponent<number, number>;
  let handlerDirective: DbxActionHandlerDirective<number, number>;

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
  describe('DbxActionContextComponent', () => {

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

  @ViewChild(DbxActionComponent, { static: true })
  component?: DbxActionComponent<number, number>;

  @ViewChild(DbxActionHandlerDirective, { static: true })
  handlerDirective?: DbxActionHandlerDirective<number, number>;

  @Input()
  handlerFunction?: HandleActionFunction<number, number>;

}
