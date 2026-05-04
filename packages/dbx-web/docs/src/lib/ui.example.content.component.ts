import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Runnable-snippet slot inside a `<dbx-docs-ui-example>`.
 *
 * The MCP scanner extracts the projected HTML body as the example entry's
 * `snippet` field. Whatever is inside this element is treated as the literal
 * code shown to LLM consumers — keep it minimal, copy-paste-ready, and free of
 * documentation-only chrome.
 */
@Component({
  selector: 'dbx-docs-ui-example-content',
  template: `
    <div class="dbx-docs-ui-example-content">
      <ng-content></ng-content>
    </div>
  `,
  styles: [
    `
      .dbx-docs-ui-example-content {
        display: block;
      }
    `
  ],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxDocsUiExampleContentComponent {}
