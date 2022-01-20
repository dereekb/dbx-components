import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { DbNgxActionContextDirective, DbNgxCoreActionModule } from '@dereekb/ngx-core';
import { DbNgxActionFormDirective } from './form.action.directive';
import { DbNgxTestDbNgxFormComponent, FORM_TEST_PROVIDERS } from '../formly.component.spec';
import { first } from 'rxjs/operators';

describe('FormActionDirective', () => {

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        ...FORM_TEST_PROVIDERS,
        DbNgxCoreActionModule
      ],
      declarations: [
        TestDbNgxActionFormDirectiveComponent,
        DbNgxTestDbNgxFormComponent
      ]
    }).compileComponents();
  });

  let directive: DbNgxActionContextDirective<number, number>;
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
class TestDbNgxActionFormDirectiveComponent {

  @ViewChild(DbNgxActionContextDirective, { static: true })
  directive!: DbNgxActionContextDirective<number, number>;

  @ViewChild(DbNgxActionFormDirective, { static: true })
  formDirective!: DbNgxActionFormDirective;

  @ViewChild(DbNgxTestDbNgxFormComponent, { static: true })
  form!: DbNgxTestDbNgxFormComponent;

}
