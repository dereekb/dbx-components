import { ChangeDetectionStrategy, Component, computed, input, signal, Signal } from '@angular/core';
import { DbxInjectionComponent } from '@dereekb/dbx-core';
import { JsonPipe, NgTemplateOutlet } from '@angular/common';
import { Maybe, SlashPathDetails, slashPathDetails, SlashPathPart, TreeNode } from '@dereekb/util';
import { ZipReader, BlobReader, Entry, DirectoryEntry, FileEntry } from '@zip.js/zip.js';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DbxLoadingComponent } from '../../loading';
import { distinctUntilChanged, map, Observable, of, shareReplay, switchMap } from 'rxjs';
import { LoadingState, loadingStateContext, loadingStateFromObs, valueFromFinishedLoadingState } from '@dereekb/rxjs';
import { OnDestroy } from '@angular/core';
import { ZipPreviewEntryListComponent } from './zip.blob.preview.list.component';

export type DbxZipBlobPreviewMode = 'list' | 'view_folder' | 'view_entry';

export interface DbxZipBlobPreviewEntryNodeData {
  readonly entry: Entry;
  readonly isDirectory: boolean;
  readonly slashPathDetails: SlashPathDetails;
}

export type DbxZipBlobPreviewEntryNode = TreeNode<DbxZipBlobPreviewEntryNodeData>;

/**
 * Used to display a zip preview based on the input blob.
 */
@Component({
  selector: 'dbx-zip-blob-preview',
  templateUrl: './zip.blob.preview.component.html',
  standalone: true,
  imports: [DbxInjectionComponent, ZipPreviewEntryListComponent, DbxLoadingComponent, JsonPipe, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxZipBlobPreviewComponent implements OnDestroy {
  readonly blob = input<Maybe<Blob>>();

  readonly hasBlob = computed(() => !!this.blob());

  readonly zipReader = computed(() => {
    const blob = this.blob();
    return blob ? new ZipReader(new BlobReader(blob)) : undefined;
  });

  readonly zipReader$ = toObservable(this.zipReader);

  readonly allEntriesLoadingState$: Observable<LoadingState<Entry[]>> = loadingStateFromObs(this.zipReader$.pipe(switchMap((x) => (x ? x.getEntries() : of([])))));
  readonly allEntries$ = this.allEntriesLoadingState$.pipe(valueFromFinishedLoadingState(), distinctUntilChanged(), shareReplay(1));
  readonly allEntriesTree$ = this.allEntries$.pipe(map((x) => {}));

  readonly allEntriesSignal = toSignal(this.allEntries$);

  readonly selectedDirectoryEntrySignal = signal<Maybe<DirectoryEntry>>(undefined);
  readonly selectedFileEntrySignal = signal<Maybe<FileEntry>>(undefined);

  readonly mode = computed(() => {
    const selectedDirectoryEntry = this.selectedDirectoryEntrySignal();
    const selectedFileEntry = this.selectedFileEntrySignal();

    let mode = 'list';

    if (selectedFileEntry) {
      mode = 'view_entry';
    } else if (selectedDirectoryEntry) {
      mode = 'view_folder';
    }

    return mode;
  });

  readonly listEntries = computed(() => {
    const allEntries = this.allEntriesSignal() ?? [];
    const selectedDirectoryEntry = this.selectedDirectoryEntrySignal();

    return allEntries;
  });

  readonly listEntries$ = toObservable(this.listEntries);
  readonly listEntriesState$ = loadingStateFromObs(this.listEntries$);

  readonly context = loadingStateContext({ obs: this.allEntriesLoadingState$ });

  ngOnDestroy(): void {
    this.context.destroy();
  }
}
