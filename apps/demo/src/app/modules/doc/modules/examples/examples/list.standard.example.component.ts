import { ChangeDetectionStrategy, Component } from '@angular/core';
import { of, type Observable } from 'rxjs';
import { type ListLoadingState, successResult } from '@dereekb/rxjs';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent } from '@dereekb/dbx-web/docs';
import { DocTwoLineItemListComponent } from '../component/two.line.item.list.component';
import { TWO_LINE_ITEM_VALUES, type TwoLineItemValue } from '../component/two.line.item.list';

/**
 * Two-line list with parent-rendered leading icon, title/details/footnote in
 * `.item-left`, and a status `<dbx-chip>` in `.item-right`.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug list-standard-two-line
 * @dbxDocsUiExampleCategory list
 * @dbxDocsUiExampleSummary Two-line list with parent-rendered leading icon and trailing status chip.
 * @dbxDocsUiExampleRelated dbx-list, dbx-list-two-line-item, dbx-chip
 * @dbxDocsUiExampleUses {@link DocTwoLineItemListComponent} list
 * @dbxDocsUiExampleUses {@link DocTwoLineItemListViewComponent} view
 * @dbxDocsUiExampleUses {@link DocTwoLineItemListViewItemComponent} item
 * @dbxDocsUiExampleUses {@link TwoLineItemValue} data
 */
@Component({
  selector: 'doc-list-standard-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, DocTwoLineItemListComponent],
  template: `
    <dbx-docs-ui-example header=".dbx-list-two-line-item Standard List With Chip" hint="Two-line row with parent-rendered leading icon, title/details/footnote, and a trailing status chip.">
      <dbx-docs-ui-example-info>
        <p>
          The
          <code>.dbx-list-two-line-item</code>
          wrapper organizes a row into
          <code>.item-left</code>
          (column with
          <code>.item-title</code>
          ,
          <code>.item-details</code>
          , and
          <code>.item-details-footnote</code>
          ) and
          <code>.item-right</code>
          (trailing content). Pair with
          <code>.dbx-list-item-padded</code>
          for the standard list-row padding and min-height.
        </p>
        <p>
          This example uses the default selection-list rendering: the parent list view paints the leading icon (it reads
          <code>icon</code>
          off each mapped item), so the item template only fills
          <code>.item-left</code>
          with the title/details/footnote and
          <code>.item-right</code>
          with a
          <code>&lt;dbx-chip&gt;</code>
          for the status badge.
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <doc-two-line-item-list [state]="state$"></doc-two-line-item-list>
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DocListStandardExampleComponent {
  readonly state$: Observable<ListLoadingState<TwoLineItemValue>> = of(successResult(TWO_LINE_ITEM_VALUES));
}
