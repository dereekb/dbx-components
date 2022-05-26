import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { DbxTestDbxFormComponent, FORM_TEST_PROVIDERS } from '../../../../../test';
import { timeOnlyField } from '../../..';
import { first } from 'rxjs';

describe('DbxDateTimeFieldComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [...FORM_TEST_PROVIDERS],
      declarations: [TestDbxActionFormDirectiveComponent, DbxTestDbxFormComponent]
    }).compileComponents();
  });

  let form: DbxTestDbxFormComponent<{ date: Date }>;

  let testComponent: TestDbxActionFormDirectiveComponent;
  let fixture: ComponentFixture<TestDbxActionFormDirectiveComponent>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(TestDbxActionFormDirectiveComponent);
    testComponent = fixture.componentInstance;
    form = testComponent.form;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
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

      it('should have set the time properly.', (done) => {
        form
          .getValue()
          .pipe(first())
          .subscribe(({ date: dateValue }) => {
            expect(dateValue).toBeSameMinuteAs(date);
            done();
          });
      });
    });
  });
});

@Component({
  template: `
    <div>
      <dbx-test-dbx-form></dbx-test-dbx-form>
    </div>
  `
})
class TestDbxActionFormDirectiveComponent {
  @ViewChild(DbxTestDbxFormComponent, { static: true })
  form!: DbxTestDbxFormComponent<{ date: Date }>;
}
