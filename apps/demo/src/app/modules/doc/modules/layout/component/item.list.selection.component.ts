import { LOREM } from '../../shared/lorem';
import { Component } from '@angular/core';
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxValueListViewItemComponent, AbstractDbxSelectionListViewDirective, DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE, DbxSelectionValueListViewConfig, provideDbxListView, DEFAULT_DBX_SELECTION_VALUE_LIST_DIRECTIVE_TEMPLATE } from '@dereekb/dbx-web';
import { of } from 'rxjs';
import { DocValue, DocValueWithSelection } from './item.list';

/**
 * Demo DbxSelectionListWrapperDirective
 */
@Component({
  selector: 'doc-complex-item-list',
  template: DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE
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
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_DIRECTIVE_TEMPLATE,
  providers: provideDbxListView(DocSelectionItemListViewComponent)
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
  `
})
export class DocSelectionItemListViewItemComponent extends AbstractDbxValueListViewItemComponent<DocValue> {
  readonly lorem = LOREM;

  get name() {
    return this.itemValue.name;
  }
}
