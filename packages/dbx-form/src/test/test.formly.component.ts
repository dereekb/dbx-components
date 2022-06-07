import { BehaviorSubject, Observable } from 'rxjs';
import { OnDestroy, Component } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { AbstractAsyncFormlyFormDirective, formlyField, provideFormlyContext } from '../lib';
import { AbstractControl } from '@angular/forms';

export interface TestFormValue {
  text: string;
}

export const INVALID_TEST_STRING = 'INVALID_TEST_STRING';

export function testTextField(): FormlyFieldConfig {
  return formlyField({
    key: 'text',
    type: 'input',
    props: {
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
  template: `
    <dbx-formly></dbx-formly>
  `,
  selector: 'dbx-test-dbx-form',
  providers: [provideFormlyContext()]
})
export class DbxTestDbxFormComponent<T = TestFormValue> extends AbstractAsyncFormlyFormDirective<T> implements OnDestroy {
  private _fields = new BehaviorSubject<FormlyFieldConfig[]>([testTextField()]);

  readonly fields$: Observable<FormlyFieldConfig[]> = this._fields.asObservable();

  override ngOnDestroy() {
    super.ngOnDestroy();
    this._fields.complete();
  }

  // MARK: Testing
  setFields(fields: FormlyFieldConfig[]) {
    this._fields.next(fields);
  }

  setValidTextForTest(fixture: ComponentFixture<unknown>): string {
    const text = 'valid';
    this.setTextForTest(text, fixture);
    return text;
  }

  setInvalidTextForTest(fixture: ComponentFixture<unknown>): void {
    this.setTextForTest(INVALID_TEST_STRING, fixture);
  }

  setTextForTest(text: string, fixture: ComponentFixture<unknown>): void {
    this.setValue({ text } as unknown as T);
    this.detectFormChanges(fixture);
  }

  detectFormChanges(fixture: ComponentFixture<unknown>): void {
    // Detect the changes.
    fixture.detectChanges();

    // Force the form to update due to the internal debounce in FormlyContext.
    this.context.forceFormUpdate();

    // Detect additional residual changes.
    fixture.detectChanges();
  }
}
