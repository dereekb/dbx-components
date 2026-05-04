import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DbxSectionComponent } from '@dereekb/dbx-web';

/**
 * Wrapper for a single self-contained documentation UI example.
 *
 * The `<dbx-docs-ui-example>` element is the parser contract for the
 * `@dereekb/dbx-components-mcp` UI examples scanner: every example component
 * tagged with `@dbxDocsUiExample` must render exactly one of these as the
 * template root, with the runnable snippet placed inside
 * `<dbx-docs-ui-example-content>` and descriptive prose inside
 * `<dbx-docs-ui-example-info>`. Optional `<dbx-docs-ui-example-imports>` and
 * `<dbx-docs-ui-example-notes>` slots are also picked up by the scanner.
 *
 * Selector and child element names are stable — renaming them would break
 * the scanner's deterministic anchors, so treat the names as a public
 * contract on par with a JSDoc tag vocabulary.
 */
@Component({
  selector: 'dbx-docs-ui-example',
  template: `
    <div class="dbx-docs-ui-example dbx-content-border">
      <dbx-section [h]="3" [header]="header()" [hint]="hint()">
        <ng-content></ng-content>
      </dbx-section>
    </div>
  `,
  styles: [
    `
      .dbx-docs-ui-example {
        display: block;
        margin-bottom: 12px;
      }
    `
  ],
  imports: [DbxSectionComponent],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxDocsUiExampleComponent {
  readonly header = input.required<string>();
  readonly hint = input<string | undefined>(undefined);
}
