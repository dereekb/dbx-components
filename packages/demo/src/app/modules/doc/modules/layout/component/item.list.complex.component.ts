import { LOREM } from './../../shared/lorem';
import { Component } from "@angular/core";
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxSelectionValueListViewItemComponent, AbstractSelectionValueListViewDirective, DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE, DbxSelectionValueListViewConfig, ProvideDbxListView, DbxSelectionValueListItem } from "@dereekb/dbx-web";
import { of } from "rxjs";
import { DocValue, DocValueWithSelection } from "./item.list";

/**
 * Demo DbxSelectionListWrapperDirective
 */
@Component({
  selector: 'doc-complex-item-list',
  template: DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE
})
export class DocComplexItemListComponent extends AbstractDbxSelectionListWrapperDirective<DocValue> {

  constructor() {
    super({
      componentClass: DocComplexItemListViewComponent
    });
  }

}

@Component({
  template: `<dbx-selection-list-view [config]="config"></dbx-selection-list-view>`,
  providers: ProvideDbxListView(DocComplexItemListViewComponent)
})
export class DocComplexItemListViewComponent extends AbstractSelectionValueListViewDirective<DocValue> {

  readonly config: DbxSelectionValueListViewConfig<DocValueWithSelection> = {
    componentClass: DocComplexItemListViewItemComponent,
    mapValuesToItemValues: (x) => of(x.map((y) => ({ ...y, icon: y.icon, value: y })))
  };

}

@Component({
  template: `
    <div class="pad-3">
      <h5 class="no-margin pad-0">{{ value.name }}</h5>
      <div>{{ lorem }}</div>
    </div>
  `
})
export class DocComplexItemListViewItemComponent extends AbstractDbxSelectionValueListViewItemComponent<DocValue> {

  readonly lorem = LOREM;

}
