import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Descriptive prose slot inside a `<dbx-docs-ui-example>`.
 *
 * The MCP scanner extracts the projected content as the example entry's
 * `info` field. Multiple `<dbx-docs-ui-example-info>` children are joined in
 * source order. Free-form HTML / inline markdown is allowed.
 */
@Component({
  selector: 'dbx-docs-ui-example-info',
  template: `
    <div class="dbx-docs-ui-example-info">
      <ng-content></ng-content>
    </div>
  `,
  styles: [
    `
      .dbx-docs-ui-example-info {
        display: block;
      }
    `
  ],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxDocsUiExampleInfoComponent {}
