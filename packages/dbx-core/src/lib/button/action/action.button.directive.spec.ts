import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { Component, viewChild } from '@angular/core';
import { DbxCoreActionModule } from '../../action/action.module';
import { DbxActionDirective } from '../../action/directive/context/action.directive';
import { DbxActionButtonDirective } from './action.button.directive';
import { DbxCoreButtonModule } from '../button.module';
import { DbxActionButtonTriggerDirective } from './action.button.trigger.directive';
import { DbxButtonDirective } from '../button.directive';
import { type Maybe } from '@dereekb/util';
import { callbackTest } from '@dereekb/util/test';

describe('Action Button', () => {
  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [DbxCoreActionModule, DbxCoreButtonModule]
    }).compileComponents();
  }));

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  let directive: Maybe<DbxActionDirective<number, number>>;

  describe('dbxActionButton', () => {
    let testComponent: TestDbxActionButtonDirectiveComponent;
    let fixture: ComponentFixture<TestDbxActionButtonDirectiveComponent>;

    beforeEach(async () => {
      fixture = TestBed.createComponent(TestDbxActionButtonDirectiveComponent);
      testComponent = fixture.componentInstance;

      directive = testComponent.directive();
      expect(directive).toBeDefined();

      fixture.detectChanges();
    });

    it('should be created', () => {
      expect(testComponent.buttonDirective()).toBeDefined();
    });

    describe('on click', () => {
      it(
        'should trigger action',
        callbackTest((done) => {
          testComponent.button()!.clickButton();

          testComponent.directive()!.sourceInstance.triggered$.subscribe((triggered) => {
            expect(triggered).toBe(true);
            done();
          });
        })
      );

      it('button should be working.', () => {
        testComponent.button()!.clickButton();
        expect(testComponent.button()?.workingSignal()).toBe(true);
      });
    });

    it('should stop working when the action completed.', () => {
      testComponent.directive()!.sourceInstance.trigger();
      expect(testComponent.button()?.workingSignal()).toBe(true);

      testComponent.directive()!.sourceInstance.readyValue(1);

      const SUCCESS_RESULT = 1;
      testComponent.directive()!.sourceInstance.resolve(SUCCESS_RESULT);

      expect(testComponent.button()?.workingSignal()).toBe(false);
    });
  });

  describe('dbxActionButtonTrigger', () => {
    let testComponent: TestDbxActionButtonTriggerDirectiveComponent;
    let fixture: ComponentFixture<TestDbxActionButtonTriggerDirectiveComponent>;

    beforeEach(async () => {
      fixture = TestBed.createComponent(TestDbxActionButtonTriggerDirectiveComponent);
      testComponent = fixture.componentInstance;

      directive = testComponent.directive();
      expect(directive).toBeDefined();

      fixture.detectChanges();
    });

    it('should be created', () => {
      expect(testComponent.buttonDirective()).toBeDefined();
    });

    it(
      'should trigger action on click',
      callbackTest((done) => {
        testComponent.button()!.clickButton();

        testComponent.directive()!.sourceInstance.triggered$.subscribe((triggered) => {
          expect(triggered).toBe(true);
          done();
        });
      })
    );
  });
});

@Component({
  template: `
    <div dbxActionContext>
      <button dbxButton dbxActionButtonTrigger></button>
    </div>
  `,
  standalone: true,
  imports: [DbxActionDirective, DbxButtonDirective, DbxActionButtonTriggerDirective]
})
class TestDbxActionButtonTriggerDirectiveComponent {
  readonly directive = viewChild.required<DbxActionDirective<number, number>>(DbxActionDirective);
  readonly buttonDirective = viewChild.required(DbxActionButtonTriggerDirective);
  readonly button = viewChild.required(DbxButtonDirective);
}

@Component({
  template: `
    <div dbxActionContext>
      <button dbxButton dbxActionButton></button>
    </div>
  `,
  standalone: true,
  imports: [DbxActionDirective, DbxButtonDirective, DbxActionButtonDirective]
})
class TestDbxActionButtonDirectiveComponent {
  readonly directive = viewChild.required<DbxActionDirective<number, number>>(DbxActionDirective);
  readonly buttonDirective = viewChild.required(DbxActionButtonDirective);
  readonly button = viewChild.required(DbxButtonDirective);
}
