import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { DbNgxActionContextDirective } from '../action.directive';
import { DbNgxActionModule } from '../action.module';
import { DbNgxActionButtonTriggerDirective, DbNgxActionButtonDirective } from './action.button.directive';
import { DbNgxButtonModule } from '../../button/button.module';
import { DbNgxButtonComponent } from '../../button/button.component';

describe('Action Button', () => {

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        DbNgxActionModule,
        DbNgxButtonModule,
        NoopAnimationsModule
      ],
      declarations: [
        TestDbNgxActionButtonTriggerDirectiveComponent,
        TestDbNgxActionButtonDirectiveComponent,
      ]
    }).compileComponents();
  });

  let directive: DbNgxActionContextDirective<number, number>;

  describe('dbxActionButton', () => {

    let testComponent: TestDbNgxActionButtonDirectiveComponent;
    let fixture: ComponentFixture<TestDbNgxActionButtonDirectiveComponent>;

    beforeEach(async () => {
      fixture = TestBed.createComponent(TestDbNgxActionButtonDirectiveComponent);
      testComponent = fixture.componentInstance;

      directive = testComponent.directive;

      fixture.detectChanges();
    });

    it('should be created', () => {
      expect(testComponent.buttonDirective).toBeDefined();
    });

    describe('on click', () => {

      it('should trigger action', (done) => {
        testComponent.button.clickButton();

        testComponent.directive.sourceInstance.triggered$.subscribe((triggered) => {
          expect(triggered).toBe(true);
          done();
        });
      });

      it('button should be working.', () => {
        testComponent.button.clickButton();
        expect(testComponent.button.working).toBe(true);
      });

    });

    it('should stop working when the action completed.', () => {
      testComponent.directive.sourceInstance.trigger();
      expect(testComponent.button.working).toBe(true);

      testComponent.directive.sourceInstance.readyValue(1);

      const SUCCESS_RESULT = 1;
      testComponent.directive.sourceInstance.success(SUCCESS_RESULT);

      expect(testComponent.button.working).toBe(false);
    });

  });

  describe('dbxActionButtonTrigger', () => {

    let testComponent: TestDbNgxActionButtonTriggerDirectiveComponent;
    let fixture: ComponentFixture<TestDbNgxActionButtonTriggerDirectiveComponent>;

    beforeEach(async () => {
      fixture = TestBed.createComponent(TestDbNgxActionButtonTriggerDirectiveComponent);
      testComponent = fixture.componentInstance;

      directive = testComponent.directive;

      fixture.detectChanges();
    });

    it('should be created', () => {
      expect(testComponent.buttonDirective).toBeDefined();
    });

    it('should trigger action on click', (done) => {
      testComponent.button.clickButton();

      testComponent.directive.sourceInstance.triggered$.subscribe((triggered) => {
        expect(triggered).toBe(true);
        done();
      });
    });

  });

});

@Component({
  template: `
    <div dbxActionContext>
      <dbx-button dbxActionButtonTrigger></dbx-button>
    </div>
  `
})
class TestDbNgxActionButtonTriggerDirectiveComponent {

  @ViewChild(DbNgxActionContextDirective, { static: true })
  directive?: DbNgxActionContextDirective<number, number>;

  @ViewChild(DbNgxActionButtonTriggerDirective, { static: true })
  buttonDirective?: DbNgxActionButtonTriggerDirective;

  @ViewChild(DbNgxButtonComponent, { static: true })
  button?: DbNgxButtonComponent;

  constructor() { }

}

@Component({
  template: `
    <div dbxActionContext>
      <dbx-button dbxActionButton></dbx-button>
    </div>
  `
})
class TestDbNgxActionButtonDirectiveComponent {

  @ViewChild(DbNgxActionContextDirective, { static: true })
  directive?: DbNgxActionContextDirective<number, number>;

  @ViewChild(DbNgxActionButtonDirective, { static: true })
  buttonDirective?: DbNgxActionButtonDirective;

  @ViewChild(DbNgxButtonComponent, { static: true })
  button?: DbNgxButtonComponent;

  constructor() { }

}
