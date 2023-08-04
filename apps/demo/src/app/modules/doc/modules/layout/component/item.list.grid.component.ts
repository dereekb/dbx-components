import { LOREM } from '../../shared/lorem';
import { Component } from '@angular/core';
import { AbstractDbxListGridViewDirective, DEFAULT_DBX_VALUE_LIST_GRID_DIRECTIVE_TEMPLATE, AbstractDbxValueListViewItemComponent, DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE, provideDbxListView, AbstractDbxListWrapperDirective, DbxValueListGridViewConfig } from '@dereekb/dbx-web';
import { of } from 'rxjs';
import { DocValue, DocValueWithSelection } from './item.list';

/**
 * Demo DbxSelectionListWrapperDirective
 */
@Component({
  selector: 'doc-item-list-grid',
  template: DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE
})
export class DocItemListGridComponent extends AbstractDbxListWrapperDirective<DocValue> {
  constructor() {
    super({
      componentClass: DocItemListGridViewComponent,
      defaultSelectionMode: 'view'
    });
  }
}

@Component({
  template: DEFAULT_DBX_VALUE_LIST_GRID_DIRECTIVE_TEMPLATE,
  providers: provideDbxListView(DocItemListGridViewComponent)
})
export class DocItemListGridViewComponent extends AbstractDbxListGridViewDirective<DocValue> {
  readonly config: DbxValueListGridViewConfig<DocValueWithSelection> = {
    componentClass: DocItemListGridViewItemComponent,
    mapValuesToItemValues: (x) => of(x.map((y) => ({ ...y, icon: y.icon, itemValue: y })))
  };
}

@Component({
  template: `
    <div class="dbx-p3">
      <h5 class="no-margin dbx-p0">{{ name }}</h5>
      <div>{{ lorem }}</div>
    </div>
  `
})
export class DocItemListGridViewItemComponent extends AbstractDbxValueListViewItemComponent<DocValue> {
  readonly lorem = LOREM;

  get name() {
    return this.itemValue.name;
  }
}
