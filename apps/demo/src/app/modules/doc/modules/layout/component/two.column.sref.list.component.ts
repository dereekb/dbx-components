import { ChangeDetectionStrategy, Component } from '@angular/core';
import { of } from 'rxjs';
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxSelectionListViewDirective, AbstractDbxValueListViewItemComponent, type DbxSelectionValueListViewConfig, type DbxValueAsListItem, provideDbxListView, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE, DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE, DbxListWrapperComponentImportsModule, DbxSelectionValueListViewComponentImportsModule } from '@dereekb/dbx-web';

/**
 * Value for the two-column sref demo list. Each value names a route to segue to; the host
 * turns it into a row anchor via `dbxListItemAnchorModifier` (see {@link DocLayoutTwoColumnsComponent}),
 * exactly how the hellosubs lists are wired.
 */
export interface TwoColumnSrefValue {
  title: string;
  ref: string;
}

export type TwoColumnSrefValueWithSelection = DbxValueAsListItem<TwoColumnSrefValue>;

/**
 * Demo `dbx-list` value list used to reproduce the hellosubs list configuration in the two-column
 * docs. Unlike `<dbx-anchor-list>` (which renders a bare `.dbx-anchor-list` nav list), a value list
 * renders the `.dbx-list-view` wrapper. The active-route row tone/shape rules in `_list.scss` are
 * scoped to `.dbx-list-view .dbx-anchor-active`, so the active row only highlights inside this list.
 */
@Component({
  selector: 'doc-two-column-sref-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxListWrapperComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocTwoColumnSrefListComponent extends AbstractDbxSelectionListWrapperDirective<TwoColumnSrefValue> {
  constructor() {
    super({
      componentClass: DocTwoColumnSrefListViewComponent,
      defaultSelectionMode: 'view'
    });
  }
}

@Component({
  selector: 'doc-two-column-sref-list-view',
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxSelectionValueListViewComponentImportsModule],
  providers: provideDbxListView(DocTwoColumnSrefListViewComponent),
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocTwoColumnSrefListViewComponent extends AbstractDbxSelectionListViewDirective<TwoColumnSrefValue> {
  readonly config: DbxSelectionValueListViewConfig<TwoColumnSrefValueWithSelection> = {
    componentClass: DocTwoColumnSrefListViewItemComponent,
    mapValuesToItemValues: (x) => of(x.map((y) => ({ ...y, key: y.ref, itemValue: y })))
  };
}

@Component({
  template: `
    <div class="dbx-list-item-padded dbx-list-two-line-item">
      <div class="item-left">
        <span>{{ title }}</span>
      </div>
    </div>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocTwoColumnSrefListViewItemComponent extends AbstractDbxValueListViewItemComponent<TwoColumnSrefValue> {
  get title() {
    return this.itemValue.title;
  }
}
