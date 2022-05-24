import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { first, Observable, of } from 'rxjs';
import { LoadingState, successResult } from '@dereekb/rxjs';
import { DbxFormLoadingSourceDirective } from './form.loading.directive';
import { DbxTestDbxFormComponent, FORM_TEST_PROVIDERS } from '../../../test';

describe('DbxFormLoadingPairSourceDirective', () => {

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ...FORM_TEST_PROVIDERS,
      ],
      declarations: [
        TestDbxActionFormDirectiveComponent,
        DbxTestDbxFormComponent
      ]
    }).compileComponents();
  });

  let directive: DbxFormLoadingSourceDirective;
  let form: DbxTestDbxFormComponent;

  let testComponent: TestDbxActionFormDirectiveComponent;
  let fixture: ComponentFixture<TestDbxActionFormDirectiveComponent>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(TestDbxActionFormDirectiveComponent);
    testComponent = fixture.componentInstance;

    directive = testComponent.directive;
    form = testComponent.form;

    expect(directive).toBeDefined();

    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should be created', () => {
    expect(testComponent.directive).toBeDefined();
  });

  it('should pass the value of the observable to the form', (done) => {
    const TEST_VALUE = 'TEST VALUE';
    testComponent.source = of(successResult({ text: TEST_VALUE, invalidField: 0 }));
    form.detectFormChanges(fixture);

    form.getValue().pipe(first()).subscribe((value) => {
      expect(value.text).toBe(TEST_VALUE);
      expect((value as any).invalidField).toBeUndefined();
      done();
    });
  });

});

@Component({
  template: `
    <div>
      <dbx-test-dbx-form [dbxFormLoadingSource]="source"></dbx-test-dbx-form>
    </div>
  `
})
class TestDbxActionFormDirectiveComponent {

  source?: Observable<LoadingState<{ text: string }>>;

  @ViewChild(DbxFormLoadingSourceDirective, { static: true })
  directive!: DbxFormLoadingSourceDirective;

  @ViewChild(DbxTestDbxFormComponent, { static: true })
  form!: DbxTestDbxFormComponent;

}
