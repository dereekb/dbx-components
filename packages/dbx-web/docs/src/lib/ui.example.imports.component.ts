import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Optional `import { … }` block slot inside a `<dbx-docs-ui-example>`.
 *
 * The MCP scanner extracts the projected text as the example entry's optional
 * `imports` field. Use this for the import lines a consumer would copy along
 * with the runnable snippet.
 */
@Component({
  selector: 'dbx-docs-ui-example-imports',
  template: `
    <ng-content></ng-content>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxDocsUiExampleImportsComponent {}
