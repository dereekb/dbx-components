import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ViewChild, Input, Directive, ContentChild, AfterViewInit, OnInit } from '@angular/core';
import { Observable, of } from 'rxjs';
import { LoadingState, successResult } from '@dereekb/rxjs';
import { DbxFormLoadingPairSourceDirective } from './form.loading.directive';
import { DbxTestDbxFormComponent, FORM_TEST_PROVIDERS } from '../formly.component.spec';

describe('DbxFormLoadingPairSourceDirective', () => {

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        ...FORM_TEST_PROVIDERS,
      ],
      declarations: [
        TestDbxActionFormDirectiveComponent,
        DbxTestDbxFormComponent
      ]
    }).compileComponents();
  });

  let directive: DbxFormLoadingPairSourceDirective;
  let form: DbxTestDbxFormComponent;

  let testComponent: TestDbxActionFormDirectiveComponent;
  let fixture: ComponentFixture<TestDbxActionFormDirectiveComponent>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(TestDbxActionFormDirectiveComponent);
    testComponent = fixture.componentInstance;

    directive = testComponent.directive;
    form = testComponent.form;

    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(testComponent.directive).toBeDefined();
  });

  it('should pass the value of the observable to the form', () => {
    const TEST_VALUE = 'TEST VALUE';
    testComponent.source = of(successResult({ text: TEST_VALUE, invalidField: 0 }));
    form.detectFormChanges(fixture);

    const value = form.getValue();

    expect(value.text).toBe(TEST_VALUE);
    expect((value as any).invalidField).toBeUndefined();
  });

});

@Component({
  template: `
    <div>
      <dbx-test-dbx-form [appFormLoadingPairSource]="source"></dbx-test-dbx-form>
    </div>
  `
})
class TestDbxActionFormDirectiveComponent {

  source?: Observable<LoadingState<{ text: string }>>;

  @ViewChild(DbxFormLoadingPairSourceDirective, { static: true })
  directive!: DbxFormLoadingPairSourceDirective;

  @ViewChild(DbxTestDbxFormComponent, { static: true })
  form!: DbxTestDbxFormComponent;

  constructor() { }

}
