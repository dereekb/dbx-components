import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { DbxActionDirective, DbxCoreActionModule } from '@dereekb/dbx-core';
import { DbxActionFormDirective } from './form.action.directive';
import { FORM_TEST_PROVIDERS } from '../../../test/test.formly';
import { DbxTestDbxFormComponent } from '../../../test/test.formly.component';
import { first } from 'rxjs';

describe('FormActionDirective', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [...FORM_TEST_PROVIDERS, DbxCoreActionModule],
      declarations: [TestDbxActionFormDirectiveComponent, DbxTestDbxFormComponent]
    }).compileComponents();
  });

  let directive: DbxActionDirective<number, number>;
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

  afterEach(() => {
    fixture.destroy();
  });

  it('should be created', () => {
    expect(testComponent.formDirective).toBeDefined();
  });

  describe('when form valid', () => {
    beforeEach((done) => {
      form.setTextForTest('text value', fixture);

      form.context.stream$.pipe(first()).subscribe(({ isComplete }) => {
        expect(isComplete).toBe(true);
        done();
      });
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

      form.context.stream$.pipe(first()).subscribe(({ isComplete }) => {
        expect(isComplete).toBe(false);
      });
    });

    it('isModifiedAndCanTrigger$ should be false.', (done) => {
      directive.trigger();

      testComponent.directive.sourceInstance.isModifiedAndCanTrigger$.pipe(first()).subscribe((canTrigger) => {
        expect(canTrigger).toBe(false);
        done();
      });
    });
  });

  // todo: test formDisabledOnWorking
});

@Component({
  template: `
    <dbx-action>
      <dbx-test-dbx-form dbxActionForm></dbx-test-dbx-form>
    </dbx-action>
  `
})
class TestDbxActionFormDirectiveComponent {
  @ViewChild(DbxActionDirective, { static: true })
  directive!: DbxActionDirective<number, number>;

  @ViewChild(DbxActionFormDirective, { static: true })
  formDirective!: DbxActionFormDirective;

  @ViewChild(DbxTestDbxFormComponent, { static: true })
  form!: DbxTestDbxFormComponent;
}
