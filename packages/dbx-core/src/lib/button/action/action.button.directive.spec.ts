import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { DbxCoreActionModule } from '../../action/action.module';
import { DbxActionDirective } from '../../action/directive/context/action.directive';
import { DbxActionButtonDirective } from './action.button.directive';
import { DbxCoreButtonModule } from '../button.module';
import { DbxActionButtonTriggerDirective } from './action.button.trigger.directive';
import { DbxButtonDirective } from '../button.directive';
import { Maybe } from '@dereekb/util';

describe('Action Button', () => {

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        DbxCoreActionModule,
        DbxCoreButtonModule,
        NoopAnimationsModule
      ],
      declarations: [
        TestDbxActionButtonTriggerDirectiveComponent,
        TestDbxActionButtonDirectiveComponent,
      ]
    }).compileComponents();
  });

  let directive: Maybe<DbxActionDirective<number, number>>;

  describe('dbxActionButton', () => {

    let testComponent: TestDbxActionButtonDirectiveComponent;
    let fixture: ComponentFixture<TestDbxActionButtonDirectiveComponent>;

    beforeEach(async () => {
      fixture = TestBed.createComponent(TestDbxActionButtonDirectiveComponent);
      testComponent = fixture.componentInstance;

      directive = testComponent.directive;

      fixture.detectChanges();
    });

    it('should be created', () => {
      expect(testComponent.buttonDirective).toBeDefined();
    });

    describe('on click', () => {

      it('should trigger action', (done) => {
        testComponent.button!.clickButton();

        testComponent.directive!.sourceInstance.triggered$.subscribe((triggered) => {
          expect(triggered).toBe(true);
          done();
        });
      });

      it('button should be working.', () => {
        testComponent.button!.clickButton();
        expect(testComponent.button!.working).toBe(true);
      });

    });

    it('should stop working when the action completed.', () => {
      testComponent.directive!.sourceInstance.trigger();
      expect(testComponent.button!.working).toBe(true);

      testComponent.directive!.sourceInstance.readyValue(1);

      const SUCCESS_RESULT = 1;
      testComponent.directive!.sourceInstance.resolve(SUCCESS_RESULT);

      expect(testComponent.button!.working).toBe(false);
    });

  });

  describe('dbxActionButtonTrigger', () => {

    let testComponent: TestDbxActionButtonTriggerDirectiveComponent;
    let fixture: ComponentFixture<TestDbxActionButtonTriggerDirectiveComponent>;

    beforeEach(async () => {
      fixture = TestBed.createComponent(TestDbxActionButtonTriggerDirectiveComponent);
      testComponent = fixture.componentInstance;

      directive = testComponent.directive;

      fixture.detectChanges();
    });

    it('should be created', () => {
      expect(testComponent.buttonDirective).toBeDefined();
    });

    it('should trigger action on click', (done) => {
      testComponent.button!.clickButton();

      testComponent.directive!.sourceInstance.triggered$.subscribe((triggered) => {
        expect(triggered).toBe(true);
        done();
      });
    });

  });

});

@Component({
  template: `
    <div dbxActionContext>
      <<button dbxButton dbxActionButtonTrigger></button>
    </div>
  `
})
class TestDbxActionButtonTriggerDirectiveComponent {

  @ViewChild(DbxActionDirective, { static: true })
  directive?: DbxActionDirective<number, number>;

  @ViewChild(DbxActionButtonTriggerDirective, { static: true })
  buttonDirective?: DbxActionButtonTriggerDirective;

  @ViewChild(DbxButtonDirective, { static: true })
  button?: DbxButtonDirective;

  constructor() { }

}

@Component({
  template: `
    <div dbxActionContext>
      <button dbxButton dbxActionButton></button>
    </div>
  `
})
class TestDbxActionButtonDirectiveComponent {

  @ViewChild(DbxActionDirective, { static: true })
  directive?: DbxActionDirective<number, number>;

  @ViewChild(DbxActionButtonDirective, { static: true })
  buttonDirective?: DbxActionButtonDirective;

  @ViewChild(DbxButtonDirective, { static: true })
  button?: DbxButtonDirective;

  constructor() { }

}
