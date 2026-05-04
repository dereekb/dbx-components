import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Optional footnotes slot inside a `<dbx-docs-ui-example>`.
 *
 * The MCP scanner extracts the projected content as the example entry's
 * optional `notes` field, appended to `full`-depth output.
 */
@Component({
  selector: 'dbx-docs-ui-example-notes',
  template: `
    <ng-content></ng-content>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxDocsUiExampleNotesComponent {}
