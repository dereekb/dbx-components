import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { AbstractSyncFormlyFormDirective, DbxFormlyComponent, formlyCheckboxField, formlyEmailField, formlyNameField, formlyTextAreaField, formlyToggleField, formlyValueSelectionField, provideFormlyContext } from '@dereekb/dbx-form';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleContentComponent, DbxDocsUiExampleInfoComponent } from '@dereekb/dbx-web/docs';

/**
 * Style-demo section rendering a representative `<dbx-formly>` form (name, email, select, textarea, checkbox, toggle)
 * so the form-field surfaces are visible in the playground. Fields paint from the `--mat-form-field-*` and surface
 * tokens, so they respond live to the Shape and Surface levers and flip with light/dark.
 *
 * Requires the host app to register its formly field declarations (the demo app does so via
 * `provideDbxFormConfiguration()` + `provideDbxFormFormlyFieldDeclarations()`).
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug style-demo-form-fields
 * @dbxDocsUiExampleCategory style-demo
 * @dbxDocsUiExampleSummary A representative dbx-formly form (name, email, select, textarea, checkbox, toggle).
 * @dbxDocsUiExampleRelated text, value-selection, checkbox
 */
@Component({
  selector: 'dbx-form-style-demo-fields-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, DbxFormlyComponent],
  providers: [provideFormlyContext()],
  template: `
    <dbx-docs-ui-example header="Form Fields" hint="A representative dbx-formly form.">
      <dbx-docs-ui-example-info>
        <p>
          A mix of classic formly fields — name, email,
          <code>valueSelectionField</code>
          , textarea, checkbox, and toggle. Each draws its container colour and corner radius from the
          <code>--mat-form-field-*</code>
          tokens layered over the surface ramp, so the fields respond live to the Shape and Surface levers and flip with light/dark. The host app must register its formly field declarations for this section to render.
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <dbx-formly></dbx-formly>
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DbxFormStyleDemoFieldsSectionComponent extends AbstractSyncFormlyFormDirective<object> {
  readonly fields: FormlyFieldConfig[] = [
    formlyNameField({ key: 'name', label: 'Full Name', required: true }),
    formlyEmailField({ key: 'email', label: 'Email', required: true }),
    formlyValueSelectionField({
      key: 'role',
      label: 'Role',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
        { label: 'Viewer', value: 'viewer' }
      ]
    }),
    formlyTextAreaField({ key: 'bio', label: 'Bio', rows: 3 }),
    formlyCheckboxField({ key: 'subscribe', label: 'Subscribe to updates' }),
    formlyToggleField({ key: 'notifications', label: 'Enable notifications' })
  ];
}
