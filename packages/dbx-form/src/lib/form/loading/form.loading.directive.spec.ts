import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ViewChild, Input, Directive, ContentChild, AfterViewInit, OnInit } from '@angular/core';
import { Observable, of } from 'rxjs';
import { LoadingState } from '@dereekb/rxjs';
import { DbNgxFormLoadingPairSourceDirective } from './form.loading.directive';
import { DbNgxTestDbNgxFormComponent, FORM_TEST_PROVIDERS } from '../formly.component.spec';

describe('DbNgxFormLoadingPairSourceDirective', () => {

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        ...FORM_TEST_PROVIDERS,
      ],
      declarations: [
        TestDbNgxActionFormDirectiveComponent,
        DbNgxTestDbNgxFormComponent
      ]
    }).compileComponents();
  });

  let directive: DbNgxFormLoadingPairSourceDirective;
  let form: DbNgxTestDbNgxFormComponent;

  let testComponent: TestDbNgxActionFormDirectiveComponent;
  let fixture: ComponentFixture<TestDbNgxActionFormDirectiveComponent>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(TestDbNgxActionFormDirectiveComponent);
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
    testComponent.source = of({ model: { text: TEST_VALUE, invalidField: 0 } });
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
class TestDbNgxActionFormDirectiveComponent {

  source?: Observable<LoadingState<{ text: string }>>;

  @ViewChild(DbNgxFormLoadingPairSourceDirective, { static: true })
  directive!: DbNgxFormLoadingPairSourceDirective;

  @ViewChild(DbNgxTestDbNgxFormComponent, { static: true })
  form!: DbNgxTestDbNgxFormComponent;

  constructor() { }

}
