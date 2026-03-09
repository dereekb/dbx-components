import { type ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { Component, signal, viewChild } from '@angular/core';
import { first, type Observable, of } from 'rxjs';
import { type LoadingState, successResult } from '@dereekb/rxjs';
import { DbxFormLoadingSourceDirective } from './form.loading.directive';
import { DbxTestDbxFormComponent, FORM_TEST_PROVIDERS } from '../../../test';
import { callbackTest } from '@dereekb/util/test';
import { type Maybe } from '@dereekb/util';

describe('DbxFormLoadingPairSourceDirective', () => {
  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [...FORM_TEST_PROVIDERS]
    }).compileComponents();
  }));

  let directive: DbxFormLoadingSourceDirective;
  let form: DbxTestDbxFormComponent;

  let testComponent: TestDbxActionFormDirectiveComponent;
  let fixture: ComponentFixture<TestDbxActionFormDirectiveComponent>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(TestDbxActionFormDirectiveComponent);
    testComponent = fixture.componentInstance;
    fixture.detectChanges();

    directive = testComponent.directive();
    form = testComponent.form();

    expect(directive).toBeDefined();
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  it('should be created', () => {
    expect(testComponent.directive()).toBeDefined();
  });

  it(
    'should pass the value of the observable to the form',
    callbackTest((done) => {
      const TEST_VALUE = 'TEST VALUE';
      testComponent.source.set(of(successResult({ text: TEST_VALUE, invalidField: 0 })));
      form.detectFormChanges(fixture);

      form
        .getValue()
        .pipe(first())
        .subscribe((value) => {
          expect(value.text).toBe(TEST_VALUE);
          expect((value as any).invalidField).toBeUndefined();
          done();
        });
    })
  );
});

@Component({
  template: `
    <div>
      <dbx-test-dbx-form [dbxFormLoadingSource]="source()"></dbx-test-dbx-form>
    </div>
  `,
  imports: [DbxTestDbxFormComponent, DbxFormLoadingSourceDirective]
})
class TestDbxActionFormDirectiveComponent {
  readonly source = signal<Maybe<Observable<LoadingState<{ text: string }>>>>(undefined);

  readonly directive = viewChild.required(DbxFormLoadingSourceDirective);
  readonly form = viewChild.required(DbxTestDbxFormComponent);
}
