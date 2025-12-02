import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxValueAsListItem, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE, DbxListWrapperComponentImportsModule, provideDbxListViewWrapper, AbstractDbxSelectionListWrapperDirective, DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE, DbxSelectionValueListViewComponentImportsModule, provideDbxListView, AbstractDbxSelectionListViewDirective, DbxSelectionValueListViewConfig, AbstractDbxValueListViewItemComponent, DbxSpacerDirective } from '../../layout';
import { of } from 'rxjs';
import { DbxZipBlobPreviewEntryTreeNode } from './zip.blob';
import { DatePipe } from '@angular/common';
import { DbxIconButtonComponent } from '../../button';
import { DbxDownloadBlobButtonComponent, DbxDownloadBlobButtonConfig } from '../download/blob/download.blob.button.component';

export type DbxZipPreviewEntryWithSelection = DbxValueAsListItem<DbxZipBlobPreviewEntryTreeNode>;

export function iconForDbxZipPreviewEntryWithSelection(entry: DbxZipBlobPreviewEntryTreeNode) {
  return entry.value.value.directory ? 'folder' : entry.value.mimeType ? 'note' : 'question_mark';
}

@Component({
  selector: 'dbx-zip-preview-file-entry-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxListWrapperComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: provideDbxListViewWrapper(DbxZipPreviewEntryListComponent),
  standalone: true
})
export class DbxZipPreviewEntryListComponent extends AbstractDbxSelectionListWrapperDirective<DbxZipPreviewEntryWithSelection> {
  constructor() {
    super({
      componentClass: DbxZipPreviewEntryListViewComponent,
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
  providers: provideDbxListView(DbxZipPreviewEntryListViewComponent)
})
export class DbxZipPreviewEntryListViewComponent extends AbstractDbxSelectionListViewDirective<DbxZipPreviewEntryWithSelection> {
  readonly config: DbxSelectionValueListViewConfig<DbxZipPreviewEntryWithSelection> = {
    componentClass: DbxZipPreviewEntryListViewItemComponent,
    mapValuesToItemValues: (x) => of(x.map((y) => ({ ...y, icon: iconForDbxZipPreviewEntryWithSelection(y), itemValue: y })))
  };
}

@Component({
  selector: 'dbx-zip-preview-file-entry-list-view-item',
  template: `
    <div class="dbx-list-item-padded dbx-list-two-line-item">
      <div class="item-left">
        <div class="mat-subtitle-2">{{ name }}</div>
        @if (lastModDate) {
          <div class="item-details">{{ lastModDate | date: 'short' }}</div>
        }
      </div>
      <dbx-spacer></dbx-spacer>
      <div class="item-right">
        @if (canDownload) {
          <dbx-download-blob-button [config]="downloadBlobButtonConfig"></dbx-download-blob-button>
        }
      </div>
    </div>
  `,
  imports: [DatePipe, DbxIconButtonComponent, DbxSpacerDirective, DbxDownloadBlobButtonComponent],
  standalone: true
})
export class DbxZipPreviewEntryListViewItemComponent extends AbstractDbxValueListViewItemComponent<DbxZipPreviewEntryWithSelection> {
  get name() {
    return this.itemValue.value.value.filename ?? 'hello';
  }

  get lastModDate() {
    return this.itemValue.value.value.lastModDate ?? undefined;
  }

  get isDirectory() {
    return this.itemValue.value.value.directory;
  }

  get canDownload() {
    return !this.isDirectory;
  }

  get downloadBlobButtonConfig(): DbxDownloadBlobButtonConfig {
    return {
      loadBlob: this.itemValue.value.getBlob,
      fileName: this.itemValue.value.slashPathDetails.fileName,
      buttonDisplay: {
        icon: 'download',
        text: 'Download'
      },
      buttonStyle: {
        type: 'stroked'
      }
    };
  }
}
