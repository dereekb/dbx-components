import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { FieldDef, FormConfig } from '@ng-forge/dynamic-forms';
import { AbstractSyncForgeFormDirective, DbxForgeFormComponentImportsModule, dbxForgeCheckboxField, dbxForgeEmailField, dbxForgeFormComponentProviders, dbxForgeNameField, dbxForgeTextAreaField, dbxForgeToggleField, dbxForgeValueSelectionField } from '@dereekb/dbx-form';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleContentComponent, DbxDocsUiExampleInfoComponent } from '@dereekb/dbx-web/docs';

/**
 * Style-demo section rendering a representative `<dbx-forge>` form (name, email, select, textarea, checkbox, toggle)
 * so the form-field surfaces are visible in the playground. Fields paint from the `--mat-form-field-*` and surface
 * tokens, so they respond live to the Shape and Surface levers and flip with light/dark.
 *
 * Requires the host app to register its forge field declarations (the demo app does so via
 * `provideDbxFormConfiguration()` + `provideDbxForgeFormFieldDeclarations()`).
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug style-demo-form-fields
 * @dbxDocsUiExampleCategory style-demo
 * @dbxDocsUiExampleSummary A representative dbx-forge form (name, email, select, textarea, checkbox, toggle).
 * @dbxDocsUiExampleRelated text, value-selection, checkbox
 */
@Component({
  selector: 'dbx-form-style-demo-fields-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, DbxForgeFormComponentImportsModule],
  providers: dbxForgeFormComponentProviders(),
  template: `
    <dbx-docs-ui-example header="Form Fields" hint="A representative dbx-forge form.">
      <dbx-docs-ui-example-info>
        <p>
          A mix of forge fields — name, email,
          <code>valueSelectionField</code>
          , textarea, checkbox, and toggle. Each draws its container colour and corner radius from the
          <code>--mat-form-field-*</code>
          tokens layered over the surface ramp, so the fields respond live to the Shape and Surface levers and flip with light/dark. The host app must register its forge field declarations for this section to render.
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <dbx-forge></dbx-forge>
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DbxFormStyleDemoFieldsSectionComponent extends AbstractSyncForgeFormDirective<object> {
  readonly formConfig: FormConfig = {
    fields: [
      dbxForgeNameField({ key: 'name', label: 'Full Name', required: true }),
      dbxForgeEmailField({ key: 'email', label: 'Email', required: true }),
      dbxForgeValueSelectionField({
        key: 'role',
        label: 'Role',
        props: {
          options: [
            { label: 'Admin', value: 'admin' },
            { label: 'Editor', value: 'editor' },
            { label: 'Viewer', value: 'viewer' }
          ]
        }
      }),
      dbxForgeTextAreaField({ key: 'bio', label: 'Bio', rows: 3 }),
      dbxForgeCheckboxField({ key: 'subscribe', label: 'Subscribe to updates' }),
      dbxForgeToggleField({ key: 'notifications', label: 'Enable notifications' })
    ] as FieldDef<unknown>[]
  } as FormConfig;
}
