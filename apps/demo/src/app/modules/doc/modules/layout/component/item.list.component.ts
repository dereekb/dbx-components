import { Component } from '@angular/core';
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxSelectionListViewDirective, DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE } from '@dereekb/dbx-web';
import { DocValue } from './item.list';

/**
 * Demo DbxSelectionListWrapperDirective
 */
@Component({
  selector: 'doc-item-list',
  template: DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE
})
export class DocItemListComponent extends AbstractDbxSelectionListWrapperDirective<DocValue> {
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
export class DocItemListViewComponent extends AbstractDbxSelectionListViewDirective<DocValue> {}
