import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type Entry } from '@zip.js/zip.js';
import { DbxValueAsListItem, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE, DbxListWrapperComponentImportsModule, provideDbxListViewWrapper, AbstractDbxSelectionListWrapperDirective, DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE, DbxSelectionValueListViewComponentImportsModule, provideDbxListView, AbstractDbxSelectionListViewDirective, DbxSelectionValueListViewConfig, AbstractDbxValueListViewItemComponent } from '../../layout';
import { of } from 'rxjs';

export type ZipPreviewEntryWithSelection = DbxValueAsListItem<Entry>;

@Component({
  selector: 'dbx-zip-preview-file-entry-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxListWrapperComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: provideDbxListViewWrapper(ZipPreviewEntryListComponent),
  standalone: true
})
export class ZipPreviewEntryListComponent extends AbstractDbxSelectionListWrapperDirective<ZipPreviewEntryWithSelection> {
  constructor() {
    super({
      componentClass: ZipPreviewEntryListViewComponent,
      defaultSelectionMode: 'view'
    });
  }
}

@Component({
  selector: 'dbx-zip-preview-file-entry-list-view',
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxSelectionValueListViewComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  providers: provideDbxListView(ZipPreviewEntryListViewComponent)
})
export class ZipPreviewEntryListViewComponent extends AbstractDbxSelectionListViewDirective<ZipPreviewEntryWithSelection> {
  readonly config: DbxSelectionValueListViewConfig<ZipPreviewEntryWithSelection> = {
    componentClass: ZipPreviewEntryListViewItemComponent,
    mapValuesToItemValues: (x) => of(x.map((y) => ({ ...y, icon: 'file', itemValue: y })))
  };
}

@Component({
  selector: 'dbx-zip-preview-file-entry-list-view-item',
  template: `
    <div>
      <p>{{ name }}</p>
    </div>
  `,
  standalone: true
})
export class ZipPreviewEntryListViewItemComponent extends AbstractDbxValueListViewItemComponent<ZipPreviewEntryWithSelection> {
  get name() {
    return this.itemValue.filename;
  }
}
