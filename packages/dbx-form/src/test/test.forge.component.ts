import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type ComponentFixture } from '@angular/core/testing';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { AbstractSyncForgeFormDirective } from '../lib/forge/form/forge.directive';
import { DbxForgeFormComponent } from '../lib/forge/form/forge.component';
import { provideDbxForgeFormContext } from '../lib/forge/form/forge.context';
import { dbxForgeTextField } from '../lib/forge/field/value/text/text.field';

export interface TestFormValue {
  text: string;
}

/**
 * Reusable forge-based test form component exposing a single required `text` field.
 *
 * Drop-in replacement for the former formly `DbxTestDbxFormComponent` test harness; provides the
 * `DbxForgeFormContext` so neutral form directives (action, loading source, etc.) can bind to it.
 */
@Component({
  selector: 'dbx-test-dbx-form',
  template: `
    <dbx-forge></dbx-forge>
  `,
  providers: [provideDbxForgeFormContext()],
  imports: [DbxForgeFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxTestDbxFormComponent<T = TestFormValue> extends AbstractSyncForgeFormDirective<T> {
  readonly formConfig: FormConfig = {
    fields: [dbxForgeTextField({ key: 'text', label: 'Text', required: true }) as any]
  };

  detectFormChanges(fixture: ComponentFixture<unknown>): void {
    fixture.detectChanges();
  }
}
