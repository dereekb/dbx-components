import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { Component, viewChild } from '@angular/core';
import { filter } from 'rxjs';
import { DbxButtonDirective } from './button.directive';
import { DbxLoadingButtonDirective } from './button.loading.directive';
import { SimpleLoadingContext, SubscriptionObject } from '@dereekb/rxjs';
import { callbackTest } from '@dereekb/util/test';

describe('DbxLoadingButton', () => {
  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({});
  }));

  let testComponent: TestDbxLoadingButtonDirectiveComponent;
  let fixture: ComponentFixture<TestDbxLoadingButtonDirectiveComponent>;
  let button: DbxButtonDirective;

  beforeEach(async () => {
    fixture = TestBed.createComponent(TestDbxLoadingButtonDirectiveComponent);
    testComponent = fixture.componentInstance;
    button = testComponent.buttonDirective();
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should be created', () => {
    expect(testComponent.loadingButtonDirective()).toBeDefined();
  });

  it('should be linked to the button', () => {
    expect(((testComponent.loadingButtonDirective() as any)._loadingEffectSub as SubscriptionObject).hasSubscription).toBe(true);
  });

  it(
    'should set the button to working when loading is true.',
    callbackTest((done) => {
      testComponent.context.setLoading(true);

      testComponent.context.stream$.pipe(filter((x) => Boolean(x.loading))).subscribe((x) => {
        expect(x.loading).toBe(true);
        expect(button.workingSignal()).toBe(true);
        done();
      });
    })
  );
});

@Component({
  template: `
    <div>
      <button dbxButton [dbxLoadingButton]="context"></button>
    </div>
  `,
  standalone: true,
  imports: [DbxButtonDirective, DbxLoadingButtonDirective]
})
class TestDbxLoadingButtonDirectiveComponent {
  context = new SimpleLoadingContext(false);

  readonly loadingButtonDirective = viewChild.required<DbxLoadingButtonDirective>(DbxLoadingButtonDirective);
  readonly buttonDirective = viewChild.required<DbxButtonDirective>(DbxButtonDirective);
}
