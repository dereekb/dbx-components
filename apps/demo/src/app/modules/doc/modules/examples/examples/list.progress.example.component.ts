import { ChangeDetectionStrategy, Component } from '@angular/core';
import { of, type Observable } from 'rxjs';
import { type ListLoadingState, successResult } from '@dereekb/rxjs';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent } from '@dereekb/dbx-web/docs';
import { DocProgressItemListComponent } from '../component/progress.item.list.component';
import { PROGRESS_ITEM_VALUES, type ProgressItemValue } from '../component/progress.item.list';

/**
 * Two-line list with a template-painted icon tile, full-width progress bar,
 * and trailing action button. Demonstrates the customised row variant where
 * the template paints its own leading icon and the row spans a tinted card.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug list-progress-with-button
 * @dbxDocsUiExampleCategory list
 * @dbxDocsUiExampleSummary Two-line list with template-painted icon tile, progress bar, and trailing button.
 * @dbxDocsUiExampleRelated dbx-list, dbx-list-two-line-item, icon-tile, dbx-color
 * @dbxDocsUiExampleUses {@link DocProgressItemListComponent} list
 * @dbxDocsUiExampleUses {@link DocProgressItemListViewComponent} view
 * @dbxDocsUiExampleUses {@link DocProgressItemListViewItemComponent} item
 * @dbxDocsUiExampleUses {@link ProgressItemValue} data
 */
@Component({
  selector: 'doc-list-progress-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, DocProgressItemListComponent],
  template: `
    <dbx-docs-ui-example header=".dbx-list-two-line-item Customized List With Button" hint="Two-line row with a template-painted icon tile, full-width progress bar, and trailing action button.">
      <dbx-docs-ui-example-info>
        <p>
          This variant demonstrates a heavier, custom item where the template paints the leading icon itself instead of relying on the parent list view. Add the
          <code>.dbx-list-two-line-item-with-icon</code>
          modifier so the parent skips its own icon, then drop the mapped item's
          <code>icon</code>
          field to suppress the built-in slot.
        </p>
        <p>
          The leading element uses the reusable
          <code>&lt;dbx-icon-tile&gt;</code>
          component — a rounded, padded container that takes an
          <code>[icon]</code>
          input and pairs with
          <code>[dbxColor]</code>
          +
          <code>[dbxColorTone]</code>
          for a tonal background. Inside
          <code>.item-left</code>
          the template stacks a title, an
          <code>X of Y complete</code>
          details line, and a
          <code>&lt;mat-progress-bar&gt;</code>
          that spans the full width up to the trailing column;
          <code>.item-right</code>
          holds a flat action button.
        </p>
        <p>
          Supporting utilities used here:
          <code>.dbx-list-item-padded-thick</code>
          for a roomier row,
          <code>.dbx-list-card-items-list</code>
          on the wrapper for the tinted/rounded card surface — applied to the actual
          <code>.mat-mdc-list-item</code>
          so hover/focus state-layers stay within the visible card boundary (defaults flow through
          <code>--mat-sys-surface-container</code>
          +
          <code>--mat-sys-corner-large</code>
          ; overridable via
          <code>--dbx-list-item-card-background</code>
          /
          <code>--dbx-list-item-card-border-radius</code>
          , with inter-card spacing exposed as
          <code>--dbx-list-card-items-list-gap</code>
          ),
          <code>.dbx-list-item-p0</code>
          on the view item host to drop Material's default list-item padding (so the icon tile can own its leading inset), and
          <code>.dbx-list-no-hover-effects</code>
          on the wrapper to disable the hover state-layer and pointer cursor for non-clickable rows.
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <doc-progress-item-list [state]="state$"></doc-progress-item-list>
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DocListProgressExampleComponent {
  readonly state$: Observable<ListLoadingState<ProgressItemValue>> = of(successResult(PROGRESS_ITEM_VALUES));
}
