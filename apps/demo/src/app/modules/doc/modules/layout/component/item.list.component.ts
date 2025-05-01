import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxSelectionListViewDirective, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE, DbxListWrapperComponentImportsModule } from '@dereekb/dbx-web';
import { DocValue } from './item.list';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { toSignal } from '@angular/core/rxjs-interop';

/**
 * Demo DbxSelectionListWrapperDirective
 */
@Component({
  selector: 'doc-item-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxListWrapperComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
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
  templateUrl: './item.list.component.html',
  imports: [MatListModule, MatIconModule],
  standalone: true
})
export class DocItemListViewComponent extends AbstractDbxSelectionListViewDirective<DocValue> {
  readonly valuesSignal = toSignal(this.values$);
}
