import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type DbxValueAsListItem, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE, DbxListWrapperComponentImportsModule, provideDbxListViewWrapper, AbstractDbxSelectionListWrapperDirective, DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE, DbxSelectionValueListViewComponentImportsModule, provideDbxListView, AbstractDbxSelectionListViewDirective, type DbxSelectionValueListViewConfig, AbstractDbxValueListViewItemComponent, DbxSpacerDirective } from '../../layout';
import { of } from 'rxjs';
import { type DbxZipBlobPreviewEntryTreeNode } from './zip.blob';
import { DatePipe } from '@angular/common';
import { DbxDownloadBlobButtonComponent, type DbxDownloadBlobButtonConfig } from '../download/blob/download.blob.button.component';

/**
 * A zip preview entry tree node wrapped as a list item for use in selection-based list views.
 */
export type DbxZipPreviewEntryWithSelection = DbxValueAsListItem<DbxZipBlobPreviewEntryTreeNode>;

/**
 * Returns the appropriate Material icon name for a zip entry tree node: "folder" for directories, "note" for files with a known MIME type, or "question_mark" for unknown files.
 *
 * @param entry - The zip entry tree node to determine the icon for
 * @returns The Material icon name: "folder", "note", or "question_mark"
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

/**
 * Internal list view component for rendering zip file entry items with selection support. Used by {@link DbxZipPreviewEntryListComponent}.
 */
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
    mapValuesToItemValues: (x) => of(x.map((y) => ({ ...y, key: y.value.slashPathDetails.path, icon: iconForDbxZipPreviewEntryWithSelection(y), itemValue: y })))
  };
}

/**
 * Individual list item component for a zip entry, displaying the file name, last modified date, and a download button for non-directory entries.
 */
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
  imports: [DatePipe, DbxSpacerDirective, DbxDownloadBlobButtonComponent],
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
