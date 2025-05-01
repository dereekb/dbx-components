import { LOREM } from '../../shared/lorem';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractDbxListGridViewDirective, AbstractDbxValueListViewItemComponent, provideDbxListView, AbstractDbxListWrapperDirective, DbxValueListGridViewConfig, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE, DbxListWrapperComponentImportsModule, DEFAULT_DBX_LIST_GRID_VIEW_DIRECTIVE_TEMPLATE, DbxListGridViewDirectiveImportsModule } from '@dereekb/dbx-web';
import { of } from 'rxjs';
import { DocValue, DocValueWithSelection } from './item.list';

/**
 * Demo DbxSelectionListWrapperDirective
 */
@Component({
  selector: 'doc-item-list-grid',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxListWrapperComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
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
  selector: 'doc-item-list-grid-view',
  template: DEFAULT_DBX_LIST_GRID_VIEW_DIRECTIVE_TEMPLATE,
  providers: provideDbxListView(DocItemListGridViewComponent),
  imports: [DbxListGridViewDirectiveImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
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
