import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { of, type Observable } from 'rxjs';
import { type ListLoadingState, successResult } from '@dereekb/rxjs';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent } from '@dereekb/dbx-web/docs';
import { DocAnchorButtonItemListComponent } from '../component/anchor.button.item.list.component';
import { makeAnchorButtonItemValues, type AnchorButtonItemValue } from '../component/anchor.button.item.list';

/**
 * Two-line list whose trailing button wraps a per-item `ClickableAnchor` via
 * `<dbx-anchor>`. The row itself is non-clickable; the button is the action
 * surface.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug list-anchor-button
 * @dbxDocsUiExampleCategory list
 * @dbxDocsUiExampleSummary Two-line list whose trailing button wraps a per-item ClickableAnchor via dbx-anchor.
 * @dbxDocsUiExampleRelated dbx-list, dbx-list-two-line-item, dbx-anchor, icon-tile, dbx-color
 * @dbxDocsUiExampleUses {@link DocAnchorButtonItemListComponent} list
 * @dbxDocsUiExampleUses {@link DocAnchorButtonItemListViewComponent} view
 * @dbxDocsUiExampleUses {@link DocAnchorButtonItemListViewItemComponent} item
 * @dbxDocsUiExampleUses {@link AnchorButtonItemValue} data
 */
@Component({
  selector: 'doc-list-anchor-button-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, DocAnchorButtonItemListComponent],
  template: `
    <dbx-docs-ui-example header=".dbx-list-two-line-item Anchor-Button List" hint="Two-line row whose trailing button wraps a per-item ClickableAnchor via dbx-anchor.">
      <dbx-docs-ui-example-info>
        <p>
          Each item carries its own
          <code>anchor: ClickableAnchor</code>
          field. The item template wraps the trailing
          <code>&lt;button mat-flat-button&gt;</code>
          in
          <code>&lt;dbx-anchor [anchor]="anchor"&gt;</code>
          so clicking the button fires whatever the data dictates — an
          <code>onClick</code>
          callback, a router
          <code>ref</code>
          , or an external
          <code>url</code>
          .
        </p>
        <p>
          Because
          <code>mapValuesToItemValues</code>
          drops
          <code>anchor</code>
          off the row item, the row's hosting (mat-list-item) doesn't pick it up — only the trailing button is interactive. Use this when each item already knows where it routes and you want the action visually scoped to a button.
        </p>
        <p>
          For the alternative — a whole-row click target supplied by the host rather than embedded in data — see
          <code>list-anchor-row-modifier</code>
          .
        </p>
        <p>
          Last clicked:
          <code>{{ clickedKey() ?? '(none)' }}</code>
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <doc-anchor-button-item-list [state]="state$"></doc-anchor-button-item-list>
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DocListAnchorButtonExampleComponent {
  readonly clickedKey = signal<string | undefined>(undefined);
  readonly state$: Observable<ListLoadingState<AnchorButtonItemValue>> = of(successResult(makeAnchorButtonItemValues((key) => this.clickedKey.set(key))));
}
