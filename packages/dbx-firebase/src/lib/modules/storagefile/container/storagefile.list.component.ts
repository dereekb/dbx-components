import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DbxActionModule, DbxActionSnackbarErrorDirective, DbxButtonComponent, type DbxButtonStyle, type DbxFileListItemComponentConfig, DbxFileListItemComponent, DbxListEmptyContentComponent } from '@dereekb/dbx-web';
import { type StorageFileKey } from '@dereekb/firebase';
import { type WorkUsingContext } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { DbxFirebaseStorageFileDownloadButtonComponent, type DbxFirebaseStorageFileDownloadButtonConfig } from './storagefile.download.button.component';

/**
 * One row of a {@link DbxFirebaseStorageFileListComponent}: the StorageFile the row downloads, and how the
 * row presents it.
 */
export interface DbxFirebaseStorageFileListEntry<T = unknown> extends DbxFileListItemComponentConfig {
  /**
   * The StorageFile the row's download button reads.
   *
   * Also the row's tracking key, so a listing should not hold the same StorageFile twice.
   */
  readonly storageFileKey: StorageFileKey;
  /**
   * Whether the signed-in user may download and remove this file. Defaults to true.
   *
   * A COURTESY, not a control — the server decides both verbs again. What this spares the user is a download
   * button that returns FORBIDDEN and a remove button that raises an access error; it is not what stops them.
   */
  readonly accessible?: Maybe<boolean>;
  /**
   * The value handed to the list's remove handler when this row's remove button is used.
   */
  readonly value?: T;
}

/**
 * Configuration for the {@link DbxFirebaseStorageFileListComponent}.
 */
export interface DbxFirebaseStorageFileListComponentConfig<T = unknown> {
  /**
   * The files to list.
   */
  readonly entries?: Maybe<DbxFirebaseStorageFileListEntry<T>[]>;
  /**
   * What is shown in place of the list while it holds no files. Nothing is shown when this is not set.
   */
  readonly emptyText?: Maybe<string>;
  /**
   * Whether each file gets a download button. Defaults to true.
   */
  readonly showDownloadButton?: Maybe<boolean>;
  /**
   * Whether each file gets a remove button. Defaults to true.
   *
   * A remove button is only rendered when a {@link removeHandler} is also provided.
   */
  readonly showRemoveButton?: Maybe<boolean>;
  /**
   * Text of each file's remove button. Defaults to "Remove".
   */
  readonly removeText?: Maybe<string>;
  readonly removeButtonStyle?: Maybe<DbxButtonStyle>;
  /**
   * Disables every remove button.
   */
  readonly removeDisabled?: Maybe<boolean>;
  /**
   * What is shown in place of a file's controls when the entry is not accessible.
   */
  readonly inaccessibleText?: Maybe<string>;
  readonly downloadButtonConfig?: Maybe<DbxFirebaseStorageFileDownloadButtonConfig>;
  /**
   * Handles removing a file. Each row passes its own {@link DbxFirebaseStorageFileListEntry.value}.
   */
  readonly removeHandler?: Maybe<WorkUsingContext<T>>;
}

/**
 * Lists StorageFiles, giving each one a download button and an optional remove action.
 *
 * Knows nothing about where the list came from — the caller maps whatever it holds into
 * {@link DbxFirebaseStorageFileListEntry} values and supplies the handler that removes one.
 *
 * @example
 * ```html
 * <dbx-firebase-storagefile-list [entries]="fileListEntriesSignal()" [removeHandler]="handleRemoveFile"></dbx-firebase-storagefile-list>
 * ```
 */
@Component({
  selector: 'dbx-firebase-storagefile-list',
  template: `
    @if (entriesSignal().length) {
      @for (entry of entriesSignal(); track entry.storageFileKey) {
        <dbx-file-list-item [config]="entry">
          @if (entry.accessible !== false) {
            @if (showDownloadButtonSignal()) {
              <dbx-firebase-storagefile-download-button [config]="downloadButtonConfigSignal()" [storageFileKey]="entry.storageFileKey"></dbx-firebase-storagefile-download-button>
            }
            @if (rowRemoveHandlerSignal(); as removeHandler) {
              <div class="dbx-firebase-storagefile-list-item-remove" dbxAction dbxActionSnackbarError [dbxActionValue]="entry.value" [dbxActionHandler]="removeHandler">
                <dbx-button dbxActionButton [buttonStyle]="removeButtonStyleSignal()" [text]="removeTextSignal()" [disabled]="removeDisabledSignal()"></dbx-button>
              </div>
            }
          } @else {
            <div class="dbx-hint">{{ inaccessibleTextSignal() }}</div>
          }
        </dbx-file-list-item>
      }
    } @else if (emptyTextSignal(); as emptyText) {
      <dbx-list-empty-content>{{ emptyText }}</dbx-list-empty-content>
    }
  `,
  host: {
    class: 'dbx-firebase-storagefile-list d-block'
  },
  imports: [
    //
    DbxActionModule,
    DbxActionSnackbarErrorDirective,
    DbxButtonComponent,
    DbxFileListItemComponent,
    DbxListEmptyContentComponent,
    DbxFirebaseStorageFileDownloadButtonComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseStorageFileListComponent<T = unknown> {
  readonly config = input<Maybe<DbxFirebaseStorageFileListComponentConfig<T>>>();

  readonly entries = input<Maybe<DbxFirebaseStorageFileListEntry<T>[]>>();
  readonly emptyText = input<Maybe<string>>();
  readonly showDownloadButton = input<Maybe<boolean>>();
  readonly showRemoveButton = input<Maybe<boolean>>();
  readonly removeText = input<Maybe<string>>();
  readonly removeButtonStyle = input<Maybe<DbxButtonStyle>>();
  readonly removeDisabled = input<Maybe<boolean>>();
  readonly inaccessibleText = input<Maybe<string>>();
  readonly downloadButtonConfig = input<Maybe<DbxFirebaseStorageFileDownloadButtonConfig>>();
  readonly removeHandler = input<Maybe<WorkUsingContext<T>>>();

  readonly entriesSignal = computed<DbxFirebaseStorageFileListEntry<T>[]>(() => {
    const config = this.config();
    return this.entries() ?? config?.entries ?? [];
  });

  readonly emptyTextSignal = computed(() => {
    const config = this.config();
    return this.emptyText() ?? config?.emptyText;
  });

  readonly showDownloadButtonSignal = computed(() => {
    const config = this.config();
    return this.showDownloadButton() ?? config?.showDownloadButton ?? true;
  });

  readonly showRemoveButtonSignal = computed(() => {
    const config = this.config();
    return this.showRemoveButton() ?? config?.showRemoveButton ?? true;
  });

  readonly removeTextSignal = computed(() => {
    const config = this.config();
    return this.removeText() ?? config?.removeText ?? 'Remove';
  });

  readonly removeButtonStyleSignal = computed<DbxButtonStyle>(() => {
    const config = this.config();
    return this.removeButtonStyle() ?? config?.removeButtonStyle ?? { type: 'basic' };
  });

  readonly removeDisabledSignal = computed(() => {
    const config = this.config();
    return (this.removeDisabled() ?? config?.removeDisabled) === true;
  });

  readonly inaccessibleTextSignal = computed(() => {
    const config = this.config();
    return this.inaccessibleText() ?? config?.inaccessibleText ?? 'Uploaded by someone else.';
  });

  readonly downloadButtonConfigSignal = computed(() => {
    const config = this.config();
    return this.downloadButtonConfig() ?? config?.downloadButtonConfig;
  });

  readonly removeHandlerSignal = computed(() => {
    const config = this.config();
    return this.removeHandler() ?? config?.removeHandler;
  });

  /**
   * The handler a row's remove button uses, or undefined when the row has no remove button.
   *
   * A list given no handler shows no remove button at all rather than a button that does nothing.
   */
  readonly rowRemoveHandlerSignal = computed(() => {
    const removeHandler = this.removeHandlerSignal();
    return this.showRemoveButtonSignal() ? removeHandler : undefined;
  });
}
