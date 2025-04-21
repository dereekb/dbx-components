import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, viewChild, ViewChild } from '@angular/core';
import { DbxActionDirective, DbxCoreActionModule } from '@dereekb/dbx-core';
import { DbxActionFormDirective } from './form.action.directive';
import { FORM_TEST_PROVIDERS } from '../../../test/test.formly';
import { DbxTestDbxFormComponent } from '../../../test/test.formly.component';
import { filter, first, switchMap } from 'rxjs';

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

    directive = testComponent.directive();
    form = testComponent.form();

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
      // set the text value
      form.setTextForTest('text value', fixture);

      // wait until it is marked as complete
      form.context.stream$
        .pipe(
          filter((x) => x.isComplete),
          first()
        )
        .subscribe(() => {
          done();
        });
    });

    it('should provide the value when triggered.', (done) => {
      directive.trigger();

      directive.sourceInstance.triggered$
        .pipe(
          filter((x) => x),
          switchMap(() => directive.sourceInstance.valueReady$),
          first()
        )
        .subscribe((valueReady) => {
          expect(valueReady).toBeDefined();
          done();
        });
    });
  });

  describe('when form is invalid', () => {
    beforeEach(() => {
      form.setInvalidTextForTest(fixture);
    });

    it('isModifiedAndCanTrigger$ should be false.', (done) => {
      form.context.stream$.pipe(first()).subscribe(({ isComplete }) => {
        expect(isComplete).toBe(false);
      });

      directive.trigger();

      directive.sourceInstance.isModifiedAndCanTrigger$.pipe(first()).subscribe((canTrigger) => {
        expect(canTrigger).toBe(false);
        done();
      });
    });
  });

  // todo: test dbxActionFormDisabledOnWorking
});

@Component({
  template: `
    <dbx-action>
      <dbx-test-dbx-form dbxActionForm></dbx-test-dbx-form>
    </dbx-action>
  `
})
class TestDbxActionFormDirectiveComponent {
  readonly directive = viewChild.required<DbxActionDirective<number, number>>(DbxActionDirective);
  readonly formDirective = viewChild.required<DbxActionFormDirective>(DbxActionFormDirective);
  readonly form = viewChild.required<DbxTestDbxFormComponent>(DbxTestDbxFormComponent);
}
