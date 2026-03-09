import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, viewChild } from '@angular/core';
import { DbxActionDirective } from '../../action/directive/context/action.directive';
import { DbxActionButtonDirective } from './action.button.directive';
import { DbxActionButtonTriggerDirective } from './action.button.trigger.directive';
import { DbxButtonDirective } from '../button.directive';
import { type Maybe } from '@dereekb/util';
import { callbackTest } from '@dereekb/util/test';
import { SubscriptionObject } from '@dereekb/rxjs';

describe('Action Button', () => {
  const sub = new SubscriptionObject();

  beforeEach(async () => {
    await TestBed.configureTestingModule({});
  });

  afterEach(() => {
    sub.destroy();
    TestBed.resetTestingModule();
  });

  let directive: Maybe<DbxActionDirective<number, number>>;

  describe('dbxActionButton', () => {
    let testComponent: TestDbxActionButtonDirectiveComponent;
    let fixture: ComponentFixture<TestDbxActionButtonDirectiveComponent>;

    beforeEach(async () => {
      fixture = TestBed.createComponent(TestDbxActionButtonDirectiveComponent);
      testComponent = fixture.componentInstance;

      await fixture.whenStable();

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
          const button = testComponent.button();
          const directive = testComponent.directive();

          button.clickButton();
          fixture.detectChanges();

          sub.subscription = directive.sourceInstance.triggered$.subscribe((triggered) => {
            expect(triggered).toBe(true);
            done();
          });
        })
      );

      it('button should be working.', () => {
        const button = testComponent.button();

        button.clickButton();
        fixture.detectChanges();
        expect(button.workingSignal()).toBe(true);
      });
    });

    it('should stop working when the action completed.', () => {
      const button = testComponent.button();
      const directive = testComponent.directive();

      directive.sourceInstance.trigger();
      fixture.detectChanges();
      expect(button.workingSignal()).toBe(true);

      directive.sourceInstance.readyValue(1);
      fixture.detectChanges();

      const SUCCESS_RESULT = 1;
      directive.sourceInstance.resolve(SUCCESS_RESULT);
      fixture.detectChanges();

      expect(button.workingSignal()).toBe(false);
    });
  });

  describe('dbxActionButtonTrigger', () => {
    let testComponent: TestDbxActionButtonTriggerDirectiveComponent;
    let fixture: ComponentFixture<TestDbxActionButtonTriggerDirectiveComponent>;

    beforeEach(async () => {
      fixture = TestBed.createComponent(TestDbxActionButtonTriggerDirectiveComponent);
      testComponent = fixture.componentInstance;

      await fixture.whenStable();

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
        const button = testComponent.button();
        const directive = testComponent.directive();

        button.clickButton();
        fixture.detectChanges();

        sub.subscription = directive.sourceInstance.triggered$.subscribe((triggered) => {
          expect(triggered).toBe(true);
          done();
        });
      })
    );
  });
});

@Component({
  template: `
    <div dbxAction>
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
    <div dbxAction>
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
