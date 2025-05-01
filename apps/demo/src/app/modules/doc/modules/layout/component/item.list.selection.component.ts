import { LOREM } from '../../shared/lorem';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxValueListViewItemComponent, AbstractDbxSelectionListViewDirective, DbxSelectionValueListViewConfig, provideDbxListView, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE, DbxListWrapperComponentImportsModule, DbxSelectionValueListViewComponentImportsModule, DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE, DbxSpacerDirective, DbxChipDirective, DbxColorDirective } from '@dereekb/dbx-web';
import { of } from 'rxjs';
import { DocValue, DocValueWithSelection } from './item.list';

/**
 * Demo DbxSelectionListWrapperDirective
 */
@Component({
  selector: 'doc-complex-item-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxListWrapperComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocSelectionItemListComponent extends AbstractDbxSelectionListWrapperDirective<DocValue> {
  constructor() {
    super({
      componentClass: DocSelectionItemListViewComponent,
      defaultSelectionMode: 'select'
    });
  }
}

@Component({
  selector: 'doc-complex-item-list-selection',
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxSelectionValueListViewComponentImportsModule],
  providers: provideDbxListView(DocSelectionItemListViewComponent),
  standalone: true
})
export class DocSelectionItemListViewComponent extends AbstractDbxSelectionListViewDirective<DocValue> {
  readonly config: DbxSelectionValueListViewConfig<DocValueWithSelection> = {
    componentClass: DocSelectionItemListViewItemComponent,
    mapValuesToItemValues: (x) => of(x.map((y) => ({ ...y, icon: y.icon, itemValue: y }))) // NOTE: Passes any extra values through too from y, like "selected".
  };
}

@Component({
  template: `
    <div class="dbx-list-item-padded dbx-list-two-line-item">
      <div class="item-left">
        <span>
          {{ name }}
          <span class="item-title">Item</span>
        </span>
        <span class="item-details">{{ lorem }}</span>
      </div>
      <dbx-spacer></dbx-spacer>
      <div class="item-right">
        <dbx-chip [small]="true" dbxColor="warn">Active</dbx-chip>
      </div>
    </div>
  `,
  imports: [DbxSpacerDirective, DbxChipDirective, DbxColorDirective],
  standalone: true
})
export class DocSelectionItemListViewItemComponent extends AbstractDbxValueListViewItemComponent<DocValue> {
  readonly lorem = LOREM;

  get name() {
    return this.itemValue.name;
  }
}
