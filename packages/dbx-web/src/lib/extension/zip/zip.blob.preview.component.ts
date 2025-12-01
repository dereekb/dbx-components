import { ChangeDetectionStrategy, Component, computed, input, Signal, signal, OnDestroy } from '@angular/core';
import { DbxInjectionComponent } from '@dereekb/dbx-core';
import { JsonPipe, NgTemplateOutlet } from '@angular/common';
import { Maybe } from '@dereekb/util';
import { ZipReader, BlobReader, Entry, FileEntry } from '@zip.js/zip.js';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DbxLoadingComponent } from '../../loading';
import { distinctUntilChanged, map, Observable, of, shareReplay, switchMap } from 'rxjs';
import { LoadingState, loadingStateContext, loadingStateFromObs, valueFromFinishedLoadingState } from '@dereekb/rxjs';
import { dbxZipBlobPreviewEntryTreeFromEntries, DbxZipBlobPreviewEntryTreeNode } from './zip.blob';
import { DbxZipPreviewEntryListComponent } from './zip.blob.preview.list.component';
import { DbxBarHeaderComponent, DbxListEmptyContentComponent, DbxListTitleGroupData, DbxListTitleGroupDirective, DbxListTitleGroupTitleDelegate, DbxSpacerDirective, DbxValueListItemModifierDirective } from '../../layout';
import { AnchorForValueFunction, DbxListItemAnchorModifierDirective } from '../../router';
import { DbxEmbedComponent } from '../../interaction';
import { MatToolbarModule } from '@angular/material/toolbar';
import { DbxButtonSpacerDirective, DbxIconButtonComponent } from '../../button';
import { DbxDownloadBlobButtonComponent, DbxDownloadBlobButtonConfig } from '../download/blob/download.blob.button.component';

export type DbxZipBlobPreviewMode = 'view_directory' | 'view_entry';

export type DbxZipBlobPreviewGroupValue = 'directory' | 'file';
export type DbxZipBlobPreviewGroupData = DbxListTitleGroupData<DbxZipBlobPreviewGroupValue> & { sort: number };

/**
 * Used to display a zip preview based on the input blob.
 */
@Component({
  selector: 'dbx-zip-blob-preview',
  templateUrl: './zip.blob.preview.component.html',
  standalone: true,
  imports: [MatToolbarModule, DbxButtonSpacerDirective, DbxIconButtonComponent, DbxBarHeaderComponent, DbxListTitleGroupDirective, DbxInjectionComponent, DbxZipPreviewEntryListComponent, DbxEmbedComponent, DbxLoadingComponent, JsonPipe, NgTemplateOutlet, DbxValueListItemModifierDirective, DbxListItemAnchorModifierDirective, DbxListTitleGroupDirective, DbxListEmptyContentComponent, DbxDownloadBlobButtonComponent, DbxSpacerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxZipBlobPreviewComponent implements OnDestroy {
  readonly blob = input<Maybe<Blob>>();

  /**
   * The download file name for the zip file.
   *
   * If not defined, then the file cannot be downloaded directly.
   */
  readonly downloadFileName = input<Maybe<string>>();

  readonly hasBlob = computed(() => !!this.blob());

  readonly zipReader = computed(() => {
    const blob = this.blob();
    return blob ? new ZipReader(new BlobReader(blob)) : undefined;
  });

  readonly downloadZipFileBlobButtonConfigSignal = computed(() => {
    const blob = this.blob();
    const fileName = this.downloadFileName();

    let result: Maybe<DbxDownloadBlobButtonConfig> = undefined;

    if (blob && fileName) {
      result = {
        blob,
        fileName: fileName ?? 'download.zip',
        buttonDisplay: {
          icon: 'download_for_offline',
          text: 'Download Zip'
        },
        buttonStyle: {
          type: 'stroked'
        }
      };
    }

    return result;
  });

  readonly zipReader$ = toObservable(this.zipReader);

  readonly allEntriesLoadingState$: Observable<LoadingState<Entry[]>> = loadingStateFromObs(this.zipReader$.pipe(switchMap((x) => (x ? x.getEntries() : of([])))));
  readonly allEntries$ = this.allEntriesLoadingState$.pipe(valueFromFinishedLoadingState(), distinctUntilChanged(), shareReplay(1));
  readonly allEntriesRoot$ = this.allEntries$.pipe(
    map((x) => dbxZipBlobPreviewEntryTreeFromEntries(x)),
    shareReplay(1)
  );

  readonly allEntriesRootSignal = toSignal(this.allEntriesRoot$);

  readonly selectedNodeSignal = signal<Maybe<DbxZipBlobPreviewEntryTreeNode>>(undefined);

  readonly listTitleGroupDelegate: DbxListTitleGroupTitleDelegate<DbxZipBlobPreviewEntryTreeNode, DbxZipBlobPreviewGroupValue, DbxZipBlobPreviewGroupData> = {
    groupValueForItem: (item) => {
      const group: DbxZipBlobPreviewGroupValue = item.itemValue.value.value.directory ? 'directory' : 'file';
      return group;
    },
    dataForGroupValue: (value: DbxZipBlobPreviewGroupValue, items) => {
      const data: DbxZipBlobPreviewGroupData = {
        title: (value === 'directory' ? 'Directories' : 'Files') + ` (${items.length})`,
        value,
        sort: value === 'directory' ? 0 : 1,
        cssClasses: ['dbx-zip-blob-preview-list-group']
      };

      return data;
    },
    sortGroupsByData: (a, b) => {
      return a.sort - b.sort;
    }
  };

  readonly mode = computed(() => {
    const selectedNode = this.selectedNodeSignal();

    let mode = 'view_directory';

    if (selectedNode && !selectedNode.value.value.directory) {
      mode = 'view_entry';
    }

    return mode;
  });

  readonly listEntries = computed(() => {
    const allEntries = this.allEntriesRootSignal();
    const selectedNode = this.selectedNodeSignal();

    let entries: Maybe<DbxZipBlobPreviewEntryTreeNode[]>;

    if (selectedNode) {
      if (selectedNode.value.value.directory) {
        entries = selectedNode.children;
      } else {
        entries = selectedNode.parent?.children;
      }
    } else {
      entries = allEntries?.children;
    }

    return entries ?? [];
  });

  readonly listEntries$ = toObservable(this.listEntries);
  readonly listEntriesState$ = loadingStateFromObs(this.listEntries$);

  readonly selectedNodeIconSignal = computed(() => {
    const selectedNode = this.selectedNodeSignal();

    let icon: string;

    if (selectedNode) {
      if (selectedNode.value.value.directory) {
        icon = 'folder';
      } else {
        icon = 'note';
      }
    } else {
      icon = 'home';
    }

    return icon;
  });

  readonly selectedNodePathSignal = computed(() => {
    const selectedNode = this.selectedNodeSignal();
    return ['Home', ...(selectedNode?.value.slashPathDetails.parts ?? [])].join(' > ');
  });

  readonly selectedFileNodeSignal: Signal<Maybe<DbxZipBlobPreviewEntryTreeNode<FileEntry>>> = computed(() => {
    const selectedNode = this.selectedNodeSignal();
    return selectedNode?.value.value.directory ? undefined : (selectedNode as DbxZipBlobPreviewEntryTreeNode<FileEntry>);
  });

  readonly selectedFileEntry$ = toObservable(this.selectedFileNodeSignal);
  readonly selectedFileEntryBlob$: Observable<Maybe<Blob>> = this.selectedFileEntry$.pipe(
    switchMap((x) => (x && x.value.getBlob ? x.value.getBlob() : of(undefined))),
    shareReplay(1)
  );
  readonly selectedFileEntryBlobSignal: Signal<Maybe<Blob>> = toSignal(this.selectedFileEntryBlob$);

  readonly context = loadingStateContext({ obs: this.allEntriesLoadingState$ });

  ngOnDestroy(): void {
    this.context.destroy();
  }

  readonly makeEntryAnchor: AnchorForValueFunction<DbxZipBlobPreviewEntryTreeNode> = (itemValue) => {
    return {
      onClick: () => {
        this.selectedNodeSignal.set(itemValue);
      }
    };
  };

  readonly homeClicked = () => {
    this.selectedNodeSignal.set(undefined);
  };

  readonly backClicked = () => {
    const selectedNode = this.selectedNodeSignal();
    this.selectedNodeSignal.set(selectedNode?.parent);
  };
}
