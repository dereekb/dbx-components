import { ChangeDetectionStrategy, Component, computed, inject, input, type Type } from '@angular/core';
import { of } from 'rxjs';
import {
  AbstractDbxListViewDirective,
  AbstractDbxListWrapperDirective,
  AbstractDbxValueListViewItemComponent,
  DbxActionModule,
  DbxActionSnackbarErrorDirective,
  DbxButtonComponent,
  DbxButtonSpacerDirective,
  DbxFileListItemComponent,
  DbxListWrapperComponentImportsModule,
  DbxValueListViewComponentImportsModule,
  DEFAULT_DBX_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  provideDbxListView,
  type DbxActionConfirmConfig,
  type DbxButtonStyle,
  type DbxFileListItemComponentConfig,
  type DbxListView,
  type DbxValueAsListItem,
  type DbxValueListViewConfig
} from '@dereekb/dbx-web';
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
 * A StorageFile entry wrapped as a list item.
 */
export type DbxFirebaseStorageFileListItem<T = unknown> = DbxValueAsListItem<DbxFirebaseStorageFileListEntry<T>>;

/**
 * What a remove button confirms before it runs, when a listing configures nothing of its own.
 *
 * Removal is confirmed by default rather than on request: a removed file is gone from the space, and the
 * object behind it is swept soon after, so there is usually nothing for the user to undo.
 */
export const DEFAULT_DBX_FIREBASE_STORAGE_FILE_LIST_REMOVE_CONFIRM_CONFIG: DbxActionConfirmConfig = {
  title: 'Remove File?',
  prompt: 'This file will be removed immediately. This can not be undone.',
  confirmText: 'Remove',
  cancelText: 'Cancel'
};

/**
 * How every row of a {@link DbxFirebaseStorageFileListComponent} behaves.
 *
 * Named for the row rather than the component because the list's OWN configuration — its state, its
 * selection mode, its empty content — belongs to the dbx-list it wraps.
 */
export interface DbxFirebaseStorageFileListRowConfig<T = unknown> {
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
   * What a remove button confirms before it runs. Defaults to
   * {@link DEFAULT_DBX_FIREBASE_STORAGE_FILE_LIST_REMOVE_CONFIRM_CONFIG}.
   *
   * Pass `{ autoConfirm: true }` for a listing whose removals are cheap to undo and should not prompt.
   */
  readonly removeConfirm?: Maybe<DbxActionConfirmConfig>;
  readonly downloadButtonConfig?: Maybe<DbxFirebaseStorageFileDownloadButtonConfig>;
  /**
   * Handles removing a file. Each row passes its own {@link DbxFirebaseStorageFileListEntry.value}.
   */
  readonly removeHandler?: Maybe<WorkUsingContext<T>>;
}

/**
 * Builds the tracking key for a row.
 *
 * Carries the row's RENDERED state, not just its identity. An item value reaches its component through the
 * injected list-item provider, and the injection config comparison deliberately ignores the provider array —
 * so under a key that is only the StorageFile key the component is never recreated, and a file would keep
 * rendering the state it was first built with (one stuck reading "Checking..." long after it validated).
 *
 * @param entry - The entry to key.
 * @returns The tracking key.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function keyForDbxFirebaseStorageFileListEntry(entry: DbxFirebaseStorageFileListEntry): string {
  return [entry.storageFileKey, entry.name, entry.details, entry.detailsDate?.getTime(), entry.detailsClass, entry.accessible].join('_');
}

/**
 * Lists StorageFiles, giving each one a download button and an optional remove action.
 *
 * Knows nothing about where the list came from — the caller maps whatever it holds into
 * {@link DbxFirebaseStorageFileListEntry} values and supplies the handler that removes one.
 *
 * Composed list utilities, as in `DbxFirebaseExternalConnectionListComponent`:
 * - `.dbx-list-no-hover-effects` drops the hover state layer, since a row is not clickable — only its buttons are;
 * - `.dbx-list-auto-height` lets the list flow inline inside whatever section holds it rather than filling it.
 *
 * @example
 * ```html
 * <dbx-firebase-storagefile-list [state]="fileListStateSignal()" [removeHandler]="handleRemoveFile">
 *   <dbx-list-empty-content empty>
 *     <p class="dbx-hint no-margin">No files yet.</p>
 *   </dbx-list-empty-content>
 * </dbx-firebase-storagefile-list>
 * ```
 */
@Component({
  selector: 'dbx-firebase-storagefile-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxListWrapperComponentImportsModule],
  host: {
    class: 'dbx-firebase-storagefile-list dbx-list-auto-height dbx-list-no-hover-effects'
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseStorageFileListComponent<T = unknown> extends AbstractDbxListWrapperDirective<DbxFirebaseStorageFileListEntry<T>> {
  readonly rowConfig = input<Maybe<DbxFirebaseStorageFileListRowConfig<T>>>();

  readonly showDownloadButton = input<Maybe<boolean>>();
  readonly showRemoveButton = input<Maybe<boolean>>();
  readonly removeText = input<Maybe<string>>();
  readonly removeButtonStyle = input<Maybe<DbxButtonStyle>>();
  readonly removeDisabled = input<Maybe<boolean>>();
  readonly removeConfirm = input<Maybe<DbxActionConfirmConfig>>();
  readonly downloadButtonConfig = input<Maybe<DbxFirebaseStorageFileDownloadButtonConfig>>();
  readonly removeHandler = input<Maybe<WorkUsingContext<T>>>();

  readonly showDownloadButtonSignal = computed(() => {
    const rowConfig = this.rowConfig();
    return this.showDownloadButton() ?? rowConfig?.showDownloadButton ?? true;
  });

  readonly showRemoveButtonSignal = computed(() => {
    const rowConfig = this.rowConfig();
    return this.showRemoveButton() ?? rowConfig?.showRemoveButton ?? true;
  });

  readonly removeTextSignal = computed(() => {
    const rowConfig = this.rowConfig();
    return this.removeText() ?? rowConfig?.removeText ?? 'Remove';
  });

  readonly removeButtonStyleSignal = computed<DbxButtonStyle>(() => {
    const rowConfig = this.rowConfig();
    return this.removeButtonStyle() ?? rowConfig?.removeButtonStyle ?? { type: 'raised', color: 'warn' };
  });

  readonly removeDisabledSignal = computed(() => {
    const rowConfig = this.rowConfig();
    return (this.removeDisabled() ?? rowConfig?.removeDisabled) === true;
  });

  readonly removeConfirmSignal = computed<DbxActionConfirmConfig>(() => {
    const rowConfig = this.rowConfig();
    return this.removeConfirm() ?? rowConfig?.removeConfirm ?? DEFAULT_DBX_FIREBASE_STORAGE_FILE_LIST_REMOVE_CONFIRM_CONFIG;
  });

  readonly downloadButtonConfigSignal = computed(() => {
    const rowConfig = this.rowConfig();
    return this.downloadButtonConfig() ?? rowConfig?.downloadButtonConfig;
  });

  readonly removeHandlerSignal = computed(() => {
    const rowConfig = this.rowConfig();
    return this.removeHandler() ?? rowConfig?.removeHandler;
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

  constructor() {
    super({
      // the view is one concrete component for every entry type: the row's own value type never reaches it,
      // so the cast erases a generic that only exists for this component's inputs
      componentClass: DbxFirebaseStorageFileListViewComponent as Type<DbxListView<DbxFirebaseStorageFileListEntry<T>>>
    });
  }
}

/**
 * Internal list view for {@link DbxFirebaseStorageFileListComponent}.
 */
@Component({
  selector: 'dbx-firebase-storagefile-list-view',
  template: DEFAULT_DBX_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxValueListViewComponentImportsModule],
  providers: provideDbxListView(DbxFirebaseStorageFileListViewComponent),
  host: {
    // the row owns all of its own padding
    class: 'dbx-list-item-p0'
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseStorageFileListViewComponent extends AbstractDbxListViewDirective<DbxFirebaseStorageFileListEntry> {
  readonly config: DbxValueListViewConfig<DbxFirebaseStorageFileListItem> = {
    componentClass: DbxFirebaseStorageFileListViewItemComponent,
    mapValuesToItemValues: (values) =>
      of(
        values.map((value) => ({
          ...value,
          itemValue: value,
          // the row paints its own leading icon, so the list's built-in icon slot stays empty
          icon: undefined,
          key: keyForDbxFirebaseStorageFileListEntry(value)
        }))
      )
  };
}

/**
 * One StorageFile: its name and details, and the controls the list configured for it.
 *
 * Reads those controls off the list rather than off the entry, so a listing configures its download and
 * remove behavior once instead of restating it on every row.
 */
@Component({
  selector: 'dbx-firebase-storagefile-list-view-item',
  template: `
    <dbx-file-list-item [name]="entry.name" [icon]="entry.icon" [details]="entry.details" [detailsDate]="entry.detailsDate" [detailsDateStyle]="entry.detailsDateStyle" [detailsClass]="entry.detailsClass">
      @if (isAccessible) {
        @if (list.showDownloadButtonSignal()) {
          <dbx-firebase-storagefile-download-button [config]="list.downloadButtonConfigSignal()" [storageFileKey]="entry.storageFileKey"></dbx-firebase-storagefile-download-button>
        }
        @if (list.rowRemoveHandlerSignal(); as removeHandler) {
          @if (list.showDownloadButtonSignal()) {
            <dbx-button-spacer></dbx-button-spacer>
          }
          <!-- the row's value rides on the confirm config rather than a dbxActionValue: both answer the
               action's trigger by calling readyValue, and dbxActionValue answering first would run the
               removal before the user had confirmed it -->
          <div class="dbx-firebase-storagefile-list-item-remove" dbxAction dbxActionSnackbarError [dbxActionConfirm]="removeConfirmConfigSignal()" [dbxActionHandler]="removeHandler">
            <dbx-button dbxActionButton [buttonStyle]="list.removeButtonStyleSignal()" [text]="list.removeTextSignal()" [disabled]="list.removeDisabledSignal()"></dbx-button>
          </div>
        }
      }
    </dbx-file-list-item>
  `,
  imports: [
    //
    DbxActionModule,
    DbxActionSnackbarErrorDirective,
    DbxButtonComponent,
    DbxButtonSpacerDirective,
    DbxFileListItemComponent,
    DbxFirebaseStorageFileDownloadButtonComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseStorageFileListViewItemComponent extends AbstractDbxValueListViewItemComponent<DbxFirebaseStorageFileListEntry> {
  readonly list = inject(DbxFirebaseStorageFileListComponent);

  readonly removeConfirmConfigSignal = computed<DbxActionConfirmConfig<unknown>>(() => ({
    ...this.list.removeConfirmSignal(),
    readyValue: this.entry.value
  }));

  get entry(): DbxFirebaseStorageFileListEntry {
    return this.itemValue;
  }

  get isAccessible(): boolean {
    return this.entry.accessible !== false;
  }
}
