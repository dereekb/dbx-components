import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { DbxActionContextDirective, DbxCoreActionModule } from '@dereekb/dbx-core';
import { DbxActionFormDirective } from './form.action.directive';
import { DbxTestDbxFormComponent, FORM_TEST_PROVIDERS } from '../formly.component.spec';
import { first } from 'rxjs/operators';

describe('FormActionDirective', () => {

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        ...FORM_TEST_PROVIDERS,
        DbxCoreActionModule
      ],
      declarations: [
        TestDbxActionFormDirectiveComponent,
        DbxTestDbxFormComponent
      ]
    }).compileComponents();
  });

  let directive: DbxActionContextDirective<number, number>;
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
    expect(testComponent.formDirective).toBeDefined();
  });

  describe('when form valid', () => {

    beforeEach(() => {
      form.setTextForTest('text value', fixture);
      expect(form.context.isComplete).toBe(true);
    });

    it('should provide the value when triggered.', (done) => {
      directive.trigger();

      testComponent.directive.sourceInstance.valueReady$.subscribe((valueReady) => {
        expect(valueReady).toBeDefined();
        done();
      });
    });

  });

  describe('when form is invalid', () => {

    beforeEach(() => {
      form.setInvalidTextForTest(fixture);
      expect(form.context.isComplete).toBe(false);
    });

    it('isModifiedAndCanTrigger$ should be false.', (done) => {
      directive.trigger();

      testComponent.directive.sourceInstance.isModifiedAndCanTrigger$.pipe(first()).subscribe((canTrigger) => {
        expect(canTrigger).toBe(false);
        done();
      });
    });

  });

});

@Component({
  template: `
    <div appActionContext>
      <dbx-test-dbx-form appActionForm></dbx-test-dbx-form>
    </div>
  `
})
class TestDbxActionFormDirectiveComponent {

  @ViewChild(DbxActionContextDirective, { static: true })
  directive!: DbxActionContextDirective<number, number>;

  @ViewChild(DbxActionFormDirective, { static: true })
  formDirective!: DbxActionFormDirective;

  @ViewChild(DbxTestDbxFormComponent, { static: true })
  form!: DbxTestDbxFormComponent;

}
