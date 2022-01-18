import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ViewChild, Input } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ProvideFormlyContext } from './formly.context';
import { AbstractSyncFormlyFormDirective } from './formly.directive';
import { textField } from './fields/text';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { DbNgxFormModule } from './form.module';
import { FormlyModule } from '@ngx-formly/core';
import { FormlyMaterialModule } from '@ngx-formly/material';
import { formlyField } from './fields/field';
import { AbstractControl } from '@angular/forms';

export const FORMLY_TEST_PROVIDERS = [
  FormlyModule.forRoot({
    extras: { lazyRender: true }
  }),
  FormlyMaterialModule
];

export const FORM_TEST_PROVIDERS = [
  DbNgxFormModule,
  ...FORMLY_TEST_PROVIDERS,
  NoopAnimationsModule
];

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
    },
  });
}

@Component({
  template: `<dbx-formly></dbx-formly>`,
  selector: 'dbx-test-dbx-form',
  providers: [ProvideFormlyContext(DbNgxTestDbNgxFormComponent)]
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
