import { Component, computed, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxListEmptyContentComponent } from '../../../layout';
import { DbxDownloadBlobButtonComponent } from '../blob/download.blob.button.component';
import { type DbxFileListComponentConfig, type DbxFileListEntry } from './download.file.list';
import { DbxFileListItemComponent } from './download.file.list.item.component';

/**
 * Lists files described by {@link DbxFileListEntry} values, giving each entry that carries a download
 * configuration a download button.
 *
 * For a listing whose rows need controls of their own, build the list from {@link DbxFileListItemComponent}
 * directly and project those controls into each row.
 *
 * @example
 * ```html
 * <dbx-file-list [entries]="entriesSignal()" emptyText="No files yet."></dbx-file-list>
 * ```
 */
@Component({
  selector: 'dbx-file-list',
  template: `
    @if (entriesSignal().length) {
      @for (entry of entriesSignal(); track entry.key) {
        <dbx-file-list-item [config]="entry">
          @if (entry.download; as download) {
            <dbx-download-blob-button [config]="download"></dbx-download-blob-button>
          }
        </dbx-file-list-item>
      }
    } @else if (emptyTextSignal(); as emptyText) {
      <dbx-list-empty-content>{{ emptyText }}</dbx-list-empty-content>
    }
  `,
  host: {
    class: 'dbx-file-list d-block'
  },
  imports: [DbxFileListItemComponent, DbxDownloadBlobButtonComponent, DbxListEmptyContentComponent]
})
export class DbxFileListComponent<T = unknown> {
  readonly config = input<Maybe<DbxFileListComponentConfig<T>>>();

  readonly entries = input<Maybe<DbxFileListEntry<T>[]>>();
  readonly emptyText = input<Maybe<string>>();

  readonly entriesSignal = computed<DbxFileListEntry<T>[]>(() => {
    const config = this.config();
    return this.entries() ?? config?.entries ?? [];
  });

  readonly emptyTextSignal = computed(() => {
    const config = this.config();
    return this.emptyText() ?? config?.emptyText;
  });
}
