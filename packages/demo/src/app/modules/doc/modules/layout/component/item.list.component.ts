import { Component } from "@angular/core";
import { AbstractDbxSelectionListWrapperDirective, AbstractSelectionValueListViewDirective, DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE } from "@dereekb/dbx-web";

export interface DocItem {
  name: string;
  icon: string;
}

/**
 * Demo DbxSelectionListWrapperDirective
 */
@Component({
  selector: 'doc-item-list',
  template: DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE
})
export class DocItemListComponent extends AbstractDbxSelectionListWrapperDirective<DocItem> {

  constructor() {
    super({
      componentClass: DocItemListViewComponent
    });
  }

}

@Component({
  selector: 'doc-item-list-view',
  templateUrl: './item.list.view.component.html'
})
export class DocItemListViewComponent extends AbstractSelectionValueListViewDirective<DocItem> { }
