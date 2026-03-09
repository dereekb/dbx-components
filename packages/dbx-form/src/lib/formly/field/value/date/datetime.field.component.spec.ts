import { type ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { Component, viewChild } from '@angular/core';
import { DbxTestDbxFormComponent, FORM_TEST_PROVIDERS } from '../../../../../test';
import { DbxFormFormlyDateFieldModule } from '../../value/date/date.field.module';
import { timeOnlyField } from '../../value/date/datetime.field';
import { first } from 'rxjs';
import { callbackTest } from '@dereekb/util/test';

describe('DbxDateTimeFieldComponent', () => {
  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [...FORM_TEST_PROVIDERS, DbxFormFormlyDateFieldModule]
    }).compileComponents();
  }));

  let form: DbxTestDbxFormComponent<{ date: Date }>;

  let testComponent: TestDbxActionFormDirectiveComponent;
  let fixture: ComponentFixture<TestDbxActionFormDirectiveComponent>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(TestDbxActionFormDirectiveComponent);
    testComponent = fixture.componentInstance;
    fixture.detectChanges();

    form = testComponent.form();
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  describe('time only mode', () => {
    const fieldKey = 'date';
    const date = new Date();

    beforeEach(() => {
      form.setFields([timeOnlyField({ key: fieldKey })]);
      fixture.detectChanges();
    });

    describe('set time', () => {
      beforeEach(() => {
        form.setValue({
          date
        });

        form.detectFormChanges(fixture);
      });

      it(
        'should have set the time properly.',
        callbackTest((done) => {
          form
            .getValue()
            .pipe(first())
            .subscribe(({ date: dateValue }) => {
              expect(dateValue).toBeSameMinuteAs(date);
              done();
            });
        })
      );
    });
  });
});

@Component({
  template: `
    <div>
      <dbx-test-dbx-form></dbx-test-dbx-form>
    </div>
  `,
  imports: [DbxTestDbxFormComponent]
})
class TestDbxActionFormDirectiveComponent {
  readonly form = viewChild.required<DbxTestDbxFormComponent<{ date: Date }>>(DbxTestDbxFormComponent);
}
