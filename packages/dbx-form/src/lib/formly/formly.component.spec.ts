import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ProvideFormlyContext } from './formly.context';
import { AbstractSyncFormlyFormDirective } from './formly.directive';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { formlyField } from './fields/field';
import { AbstractControl } from '@angular/forms';
import { FORM_TEST_PROVIDERS } from './formly.spec';

describe('DbNgxInputFormControlComponent', () => {

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        ...FORM_TEST_PROVIDERS
      ],
      declarations: [
        DbNgxTestDbNgxFormComponent
      ]
    }).compileComponents();
  });

  let testComponent: DbNgxTestDbNgxFormComponent;
  let fixture: ComponentFixture<DbNgxTestDbNgxFormComponent>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(DbNgxTestDbNgxFormComponent);
    testComponent = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(testComponent).toBeDefined();
  });

});

export interface TestFormValue {
  text: string;
}

export const INVALID_TEST_STRING = 'INVALID_TEST_STRING';

export function testTextField(): FormlyFieldConfig {
  return formlyField({
    key: 'text',
    type: 'input',
    templateOptions: {
      required: true
    },
    validators: {
      invalid: {
        expression: (c: AbstractControl) => c.value !== INVALID_TEST_STRING,
        message: () => `You set the invalid text string.`
      }
    }
  });
}

@Component({
  template: `<dbx-formly></dbx-formly>`,
  selector: 'dbx-test-dbx-form',
  providers: [ProvideFormlyContext()]
})
export class DbNgxTestDbNgxFormComponent extends AbstractSyncFormlyFormDirective<TestFormValue> {

  fields: FormlyFieldConfig[] = [
    testTextField()
  ];

  // MARK: Testing
  setValidTextForTest(fixture: ComponentFixture<any>): string {
    const text = 'valid';
    this.setTextForTest(text, fixture);
    return text;
  }

  setInvalidTextForTest(fixture: ComponentFixture<any>): void {
    this.setTextForTest(INVALID_TEST_STRING, fixture);
  }

  setTextForTest(text: string, fixture: ComponentFixture<any>): void {
    this.setValue({ text });
    this.detectFormChanges(fixture);
  }

  detectFormChanges(fixture: ComponentFixture<any>): void {
    // Detect the changes.
    fixture.detectChanges();

    // Force the form to update due to the internal debounce in FormlyContext.
    this.context.forceFormUpdate();

    // Detect additional residual changes.
    fixture.detectChanges();
  }

}
