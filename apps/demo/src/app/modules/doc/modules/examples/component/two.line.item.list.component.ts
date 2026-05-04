import { ChangeDetectionStrategy, Component } from '@angular/core';
import { of } from 'rxjs';
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxSelectionListViewDirective, AbstractDbxValueListViewItemComponent, type DbxSelectionValueListViewConfig, provideDbxListView, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE, DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE, DbxListWrapperComponentImportsModule, DbxSelectionValueListViewComponentImportsModule, DbxSpacerDirective, DbxChipDirective } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { type TwoLineItemValue, type TwoLineItemValueWithSelection } from './two.line.item.list';

/**
 * Demo wrapper that renders {@link TwoLineItemValue} items as a standard
 * `.dbx-list-two-line-item` row: parent-rendered leading icon,
 * title/details/footnote in `.item-left`, and a status `<dbx-chip>` in
 * `.item-right`.
 *
 * The selection list view paints the icon (it reads `icon` off each mapped
 * item), so the item template only fills `.item-left` and `.item-right`. To
 * paint a custom icon from the template instead — e.g. in grid/accordion
 * views, or when you want a coloured tile — add
 * `.dbx-list-two-line-item-with-icon` to the row and use the reusable
 * `.dbx-icon-tile` utility (see the customized progress-item demo).
 */
@Component({
  selector: 'doc-two-line-item-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxListWrapperComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocTwoLineItemListComponent extends AbstractDbxSelectionListWrapperDirective<TwoLineItemValue> {
  constructor() {
    super({
      componentClass: DocTwoLineItemListViewComponent,
      defaultSelectionMode: 'view'
    });
  }
}

@Component({
  selector: 'doc-two-line-item-list-view',
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxSelectionValueListViewComponentImportsModule],
  providers: provideDbxListView(DocTwoLineItemListViewComponent),
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocTwoLineItemListViewComponent extends AbstractDbxSelectionListViewDirective<TwoLineItemValue> {
  readonly config: DbxSelectionValueListViewConfig<TwoLineItemValueWithSelection> = {
    componentClass: DocTwoLineItemListViewItemComponent,
    mapValuesToItemValues: (values) => of(values.map((value) => ({ ...value, itemValue: value, icon: value.icon })))
  };
}

type TwoLineItemStatusColor = 'primary' | 'warn' | 'grey';

const STATUS_COLOR: Record<NonNullable<TwoLineItemValue['status']>, TwoLineItemStatusColor> = {
  active: 'primary',
  pending: 'warn',
  archived: 'grey'
};

@Component({
  selector: 'doc-two-line-item-list-view-item',
  template: `
    <div class="dbx-list-item-padded dbx-list-two-line-item">
      <div class="item-left">
        <span class="item-title">{{ title }}</span>
        @if (details) {
          <span class="item-details">{{ details }}</span>
        }
        @if (footnote) {
          <span class="item-details-footnote">{{ footnote }}</span>
        }
      </div>
      <dbx-spacer></dbx-spacer>
      <div class="item-right">
        @if (status) {
          <dbx-chip [small]="true" [color]="statusColor">{{ status }}</dbx-chip>
        }
      </div>
    </div>
  `,
  imports: [DbxSpacerDirective, DbxChipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocTwoLineItemListViewItemComponent extends AbstractDbxValueListViewItemComponent<TwoLineItemValue> {
  get title(): string {
    return this.itemValue.title;
  }

  get details(): Maybe<string> {
    return this.itemValue.details;
  }

  get footnote(): Maybe<string> {
    return this.itemValue.footnote;
  }

  get status(): Maybe<TwoLineItemValue['status']> {
    return this.itemValue.status;
  }

  get statusColor(): TwoLineItemStatusColor {
    return this.status ? STATUS_COLOR[this.status] : 'grey';
  }
}
