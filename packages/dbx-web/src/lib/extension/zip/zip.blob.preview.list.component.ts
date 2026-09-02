import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type DbxValueAsListItem, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE, DbxListWrapperComponentImportsModule, provideDbxListViewWrapper, AbstractDbxSelectionListWrapperDirective, DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE, DbxSelectionValueListViewComponentImportsModule, provideDbxListView, AbstractDbxSelectionListViewDirective, type DbxSelectionValueListViewConfig, AbstractDbxValueListViewItemComponent } from '../../layout';
import { of } from 'rxjs';
import { type DbxZipBlobPreviewEntryTreeNode } from './zip.blob';
import { DbxDownloadBlobButtonComponent, type DbxDownloadBlobButtonConfig } from '../download/blob/download.blob.button.component';
import { DbxFileListItemComponent } from '../download/list/download.file.list.item.component';

/**
 * A zip preview entry tree node wrapped as a list item for use in selection-based list views.
 */
export type DbxZipPreviewEntryWithSelection = DbxValueAsListItem<DbxZipBlobPreviewEntryTreeNode>;

/**
 * Returns the appropriate Material icon name for a zip entry tree node: "folder" for directories, "note" for files with a known MIME type, or "question_mark" for unknown files.
 *
 * @param entry - The zip entry tree node to determine the icon for.
 * @returns The Material icon name: "folder", "note", or "question_mark".
 *
 * @example
 * ```typescript
 * const icon = iconForDbxZipPreviewEntryWithSelection(treeNode); // 'folder', 'note', or 'question_mark'
 * ```
 */
export function iconForDbxZipPreviewEntryWithSelection(entry: DbxZipBlobPreviewEntryTreeNode) {
  return entry.value.value.directory ? 'folder' : entry.value.mimeType ? 'note' : 'question_mark';
}

/**
 * Selection list wrapper for displaying zip file entries with icons for directories and files.
 *
 * @example
 * ```html
 * <dbx-zip-preview-file-entry-list [values$]="entries$"></dbx-zip-preview-file-entry-list>
 * ```
 */
@Component({
  selector: 'dbx-zip-preview-file-entry-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxListWrapperComponentImportsModule],
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

/**
 * Internal list view component for rendering zip file entry items with selection support. Used by {@link DbxZipPreviewEntryListComponent}.
 */
@Component({
  selector: 'dbx-zip-preview-file-entry-list-view',
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxSelectionValueListViewComponentImportsModule],
  standalone: true,
  providers: provideDbxListView(DbxZipPreviewEntryListViewComponent)
})
export class DbxZipPreviewEntryListViewComponent extends AbstractDbxSelectionListViewDirective<DbxZipPreviewEntryWithSelection> {
  readonly config: DbxSelectionValueListViewConfig<DbxZipPreviewEntryWithSelection> = {
    componentClass: DbxZipPreviewEntryListViewItemComponent,
    mapValuesToItemValues: (x) => of(x.map((y) => ({ ...y, key: y.value.slashPathDetails.path, icon: iconForDbxZipPreviewEntryWithSelection(y), itemValue: y })))
  };
}

/**
 * Individual list item component for a zip entry, displaying the file name, last modified date, and a download button for non-directory entries.
 */
@Component({
  selector: 'dbx-zip-preview-file-entry-list-view-item',
  template: `
    <dbx-file-list-item [name]="name" [detailsDate]="lastModDate">
      @if (canDownload) {
        <dbx-download-blob-button [config]="downloadBlobButtonConfig"></dbx-download-blob-button>
      }
    </dbx-file-list-item>
  `,
  imports: [DbxFileListItemComponent, DbxDownloadBlobButtonComponent],
  standalone: true
})
export class DbxZipPreviewEntryListViewItemComponent extends AbstractDbxValueListViewItemComponent<DbxZipPreviewEntryWithSelection> {
  get name() {
    return this.itemValue.value.value.filename;
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
      buttonStylePair: {
        display: {
          icon: 'download',
          text: 'Download'
        },
        style: {
          type: 'stroked'
        }
      }
    };
  }
}
