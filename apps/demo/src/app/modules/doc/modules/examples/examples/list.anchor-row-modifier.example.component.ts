import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { of, type Observable } from 'rxjs';
import { type ListLoadingState, successResult } from '@dereekb/rxjs';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent } from '@dereekb/dbx-web/docs';
import { type AnchorForValueFunction, DbxValueListItemModifierDirective, DbxListItemAnchorModifierDirective } from '@dereekb/dbx-web';
import { DocAnchorRowItemListComponent } from '../component/anchor.row.item.list.component';
import { ANCHOR_ROW_ITEM_VALUES, type AnchorRowItemValue } from '../component/anchor.row.item.list';

/**
 * Two-line list whose entire row is the click target. The host attaches
 * `dbxListItemModifier [dbxListItemAnchorModifier]="makeClickAnchor"` on the
 * wrapper; the modifier runs the host's `AnchorForValueFunction` for each
 * item and sets the resulting `ClickableAnchor` on the `DbxValueListItem`,
 * which the list's row hosting wires as a row click.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug list-anchor-row-modifier
 * @dbxDocsUiExampleCategory list
 * @dbxDocsUiExampleSummary Two-line list where dbxListItemAnchorModifier makes the entire row a click target — data has no anchor field.
 * @dbxDocsUiExampleRelated dbx-list, dbx-list-two-line-item, dbxListItemAnchorModifier, dbxListItemModifier, icon-tile, dbx-color
 * @dbxDocsUiExampleUses {@link DocAnchorRowItemListComponent} list
 * @dbxDocsUiExampleUses {@link DocAnchorRowItemListViewComponent} view
 * @dbxDocsUiExampleUses {@link DocAnchorRowItemListViewItemComponent} item
 * @dbxDocsUiExampleUses {@link AnchorRowItemValue} data
 */
@Component({
  selector: 'doc-list-anchor-row-modifier-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, DocAnchorRowItemListComponent, DbxValueListItemModifierDirective, DbxListItemAnchorModifierDirective],
  template: `
    <dbx-docs-ui-example header=".dbx-list-two-line-item Anchor-Row List With Modifier" hint="Whole-row click target wired by dbxListItemAnchorModifier — the data has no anchor field of its own.">
      <dbx-docs-ui-example-info>
        <p>
          The list values don't carry an
          <code>anchor</code>
          field. Instead, the host attaches
          <code>dbxListItemModifier [dbxListItemAnchorModifier]="makeClickAnchor"</code>
          on the wrapper. The modifier runs the host's
          <code>AnchorForValueFunction</code>
          for each item, sets the resulting
          <code>ClickableAnchor</code>
          on the
          <code>DbxValueListItem</code>
          , and the list's row hosting wires it as a row click — the
          <em>entire row</em>
          becomes the click target without the data needing to know anything about routing.
        </p>
        <p>
          Pick this pattern when the routing target is computed from the value's identity (e.g. a router
          <code>ref</code>
          built from
          <code>itemValue.key</code>
          ) and you want the row itself to be the action surface — no trailing button needed; a chevron is plenty of affordance.
        </p>
        <p>
          Last clicked:
          <code>{{ clickedKey() ?? '(none)' }}</code>
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <doc-anchor-row-item-list [state]="state$" dbxListItemModifier [dbxListItemAnchorModifier]="makeClickAnchor"></doc-anchor-row-item-list>
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DocListAnchorRowModifierExampleComponent {
  readonly state$: Observable<ListLoadingState<AnchorRowItemValue>> = of(successResult(ANCHOR_ROW_ITEM_VALUES));
  readonly clickedKey = signal<string | undefined>(undefined);

  readonly makeClickAnchor: AnchorForValueFunction<AnchorRowItemValue> = (itemValue) => ({
    onClick: () => this.clickedKey.set(itemValue.key)
  });
}
