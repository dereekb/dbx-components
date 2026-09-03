import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DbxActionDialogDirective, type DbxActionDialogFunction, DbxActionModule, DbxActionSnackbarErrorDirective, DbxAnchorComponent, DbxButtonComponent, type DbxButtonStyle, DbxWebFilePreviewService } from '@dereekb/dbx-web';
import { firestoreModelId, type StorageFileDownloadUrl, type StorageFileId, type StorageFileKey, type StorageFilePublicDownloadUrl, type StoragePathInput } from '@dereekb/firebase';
import { type ContentTypeMimeType, dateFromDateOrTimeSecondsNumber, type DateOrUnixDateTimeSecondsNumber, isPast, type Maybe, MS_IN_SECOND } from '@dereekb/util';
import { DbxFirebaseStorageFileDownloadService, type DbxFirebaseStorageFileDownloadServiceCustomSource } from '../service/storagefile.download.service';
import { DbxFirebaseStorageService } from '../../../storage/firebase.storage.service';
import { type ClickableAnchor } from '@dereekb/dbx-core';
import { type MaybeObservableOrValue, maybeValueFromObservableOrValue, type WorkInstance, type WorkUsingContext } from '@dereekb/rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, distinctUntilChanged, interval, map, type Observable, of, shareReplay, switchMap } from 'rxjs';
import { type DbxFirebaseStorageFileDownloadUrlPair } from '../service/storagefile.download.storage.service';
import { MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { isSameDate } from '@dereekb/date';

export interface DbxFirebaseStorageFileDownloadDetails {
  readonly downloadUrl: StorageFileDownloadUrl;
  readonly mimeType?: Maybe<ContentTypeMimeType>;
  readonly expiresAt?: Maybe<Date>;
}

/**
 * Derives the object path of a PUBLIC StorageFile from the file's id.
 *
 * Exists so a caller that holds only an id can still name the object without a document read: the path
 * shape for a given purpose is a pure function of the id (e.g. `calendarIcsFileStoragePath()`).
 */
export type DbxFirebaseStorageFilePublicStoragePathFactory = (storageFileId: StorageFileId) => StoragePathInput;

/**
 * Path of a PUBLIC StorageFile's object, or a factory that derives it from the file's id.
 */
export type DbxFirebaseStorageFilePublicStoragePathInput = StoragePathInput | DbxFirebaseStorageFilePublicStoragePathFactory;

/**
 * Source configuration for the DbxFirebaseStorageFileDownloadButtonComponent.
 */
export interface DbxFirebaseStorageFileDownloadButtonSource {
  /**
   * A static StorageFileKey to use.
   */
  readonly storageFileKey?: MaybeObservableOrValue<StorageFileKey>;
  /**
   * Object path of a PUBLIC StorageFile.
   *
   * When set, the download url is DERIVED on the client from the app's storage origin and this path — no
   * callable, no auth, and no expiration — so the button lands ready to save on first render and clicking it
   * only follows the anchor, rather than fetching a url the component already has.
   *
   * Accepts either a path value or a factory from the file's id. A StorageFile document satisfies the value
   * form directly, since it carries its own bucket and path; pass the factory form when only the id is on
   * hand and the path shape is derivable from it.
   *
   * Only for a file whose bytes are actually public. A private path yields a url that resolves to a 403.
   */
  readonly publicStoragePath?: Maybe<MaybeObservableOrValue<DbxFirebaseStorageFilePublicStoragePathInput>>;
  /**
   * Whether or not to pre-load the download url from the source.
   *
   * Defaults to false.
   */
  readonly preload?: Maybe<boolean>;
  /**
   * The expected mime type of the StorageFile to use when previewing.
   */
  readonly storageFileEmbedMimeType?: MaybeObservableOrValue<ContentTypeMimeType | string>;
  /**
   * Custom source to use with the DbxFirebaseStorageFileDownloadService. A more simple alternative to using handleGetDownloadUrl().
   */
  readonly customSource?: Maybe<DbxFirebaseStorageFileDownloadServiceCustomSource>;
  /**
   * Optional custom work to use to get the download URL.
   *
   * If provided, customSource is ignored.
   */
  readonly handleGetDownloadUrl?: Maybe<WorkUsingContext<StorageFileKey, DbxFirebaseStorageFileDownloadUrlPair>>;
  /**
   * Optional custom success handler for the download URL.
   */
  readonly handleGetDownloadUrlSuccess?: (value: DbxFirebaseStorageFileDownloadUrlPair) => void;
  /**
   * Optional custom error handler for the download URL.
   */
  readonly handleGetDownloadUrlError?: (error: unknown) => void;
  /**
   * Called when the download details change.
   */
  readonly downloadDetailsChangeCallback?: Maybe<(downloadDetails: Maybe<DbxFirebaseStorageFileDownloadDetails>) => void>;
}

/**
 * Configuration for the DbxFirebaseStorageFileDownloadButtonComponent.
 */
export interface DbxFirebaseStorageFileDownloadButtonConfig {
  readonly buttonStyle?: Maybe<DbxButtonStyle>;
  readonly previewButtonStyle?: Maybe<DbxButtonStyle>;
  /**
   * Whether or not to show a preview button.
   *
   * Defaults to true.
   */
  readonly showPreviewButton?: Maybe<boolean>;
  readonly icon?: Maybe<string>;
  readonly text?: Maybe<string>;
  readonly downloadReadyIcon?: Maybe<string>;
  readonly downloadReadyText?: Maybe<string>;
  readonly previewIcon?: Maybe<string>;
  readonly previewText?: Maybe<string>;
  /**
   * Optional custom function to open a preview dialog. If not provided, the default preview dialog provided by the DbxWebFilePreviewService will be used.
   *
   * The function can return undefined, in which case the default preview dialog will be used.
   */
  readonly openCustomPreview?: Maybe<(downloadUrl: StorageFileDownloadUrl, embedMimeType?: Maybe<string>) => Maybe<MatDialogRef<any>>>;
}

@Component({
  selector: 'dbx-firebase-storagefile-download-button',
  template: `
    <dbx-anchor
      [anchor]="anchorSignal()"
      dbxAction
      [dbxActionAutoTrigger]="preloadSignal()"
      dbxActionSnackbarError
      [dbxActionDisabled]="actionDisabledSignal()"
      [dbxActionValue]="storageFileKeySignal()"
      [dbxActionHandler]="handleGetDownloadUrl"
      [dbxActionSuccessHandler]="handleGetDownloadUrlSuccess"
      [dbxActionErrorHandler]="handleGetDownloadUrlError">
      <!-- allowClickPropagation lets a click on a resolved url reach the anchor, which is what performs the download -->
      <dbx-button dbxActionButton [allowClickPropagation]="true" [buttonStyle]="buttonStyleSignal()" [icon]="iconSignal()" [text]="textSignal()"></dbx-button>
    </dbx-anchor>
    @if (showPreviewButtonSignal()) {
      <ng-container dbxAction [dbxActionDialog]="handleOpenPreviewDialog" dbxActionHandlerValue dbxActionSnackbarError>
        <span class="dbx-button-spacer"></span>
        <dbx-button dbxActionButton [buttonStyle]="previewButtonStyleSignal()" [icon]="previewIconSignal()" [text]="previewTextSignal()"></dbx-button>
      </ng-container>
    }
  `,
  imports: [DbxButtonComponent, DbxActionModule, DbxActionSnackbarErrorDirective, DbxActionDialogDirective, DbxAnchorComponent]
})
export class DbxFirebaseStorageFileDownloadButtonComponent {
  readonly matDialog = inject(MatDialog);

  readonly dbxWebFilePreviewService = inject(DbxWebFilePreviewService);
  readonly dbxFirebaseStorageFileDownloadService = inject(DbxFirebaseStorageFileDownloadService);
  readonly dbxFirebaseStorageService = inject(DbxFirebaseStorageService);

  /**
   * The StorageFileKey to set up the download button for.
   */
  readonly storageFileKey = input<Maybe<StorageFileKey>>();

  /**
   * The download URL to use for the download button.
   */
  readonly storageFileDownloadUrl = input<Maybe<StorageFileDownloadUrl>>();

  /**
   * Object path of a PUBLIC StorageFile, or a factory deriving it from the file's id.
   *
   * See {@link DbxFirebaseStorageFileDownloadButtonSource.publicStoragePath}.
   */
  readonly publicStoragePath = input<Maybe<DbxFirebaseStorageFilePublicStoragePathInput>>();

  /**
   * The MIME type to use the embed component.
   */
  readonly embedMimeType = input<Maybe<ContentTypeMimeType | string>>();

  /**
   * Whether or not to show a preview button.
   *
   * Takes precedence over the config. Defaults to true when neither is set.
   */
  readonly showPreviewButton = input<Maybe<boolean>>();

  /**
   * Whether or not to pre-load the download URL from the source.
   */
  readonly preload = input<Maybe<boolean>>(undefined);

  /**
   * Output event emitted when the download details change.
   */
  readonly downloadDetailsChange = output<Maybe<DbxFirebaseStorageFileDownloadDetails>>();

  readonly config = input<Maybe<DbxFirebaseStorageFileDownloadButtonConfig>>();
  readonly source = input<Maybe<DbxFirebaseStorageFileDownloadButtonSource>>();

  readonly source$ = toObservable(this.source);

  readonly configSignal = computed(() => {
    const config = this.config();

    const result: DbxFirebaseStorageFileDownloadButtonConfig = {
      buttonStyle: config?.buttonStyle,
      previewButtonStyle: config?.previewButtonStyle,
      icon: config?.icon ?? 'cloud_download',
      text: config?.text ?? 'Start Download',
      downloadReadyIcon: config?.downloadReadyIcon ?? 'download',
      downloadReadyText: config?.downloadReadyText ?? 'Save File',
      previewIcon: config?.previewIcon ?? 'preview',
      previewText: config?.previewText ?? 'View File',
      showPreviewButton: config?.showPreviewButton,
      openCustomPreview: config?.openCustomPreview
    };

    return result;
  });

  readonly preloadSignal = computed(() => {
    const preload = this.preload();
    const source = this.source();
    return preload ?? source?.preload ?? false;
  });

  /**
   * The url fetched by the download action, restored from the cache, or given by the {@link storageFileDownloadUrl}
   * input. A derived public url takes precedence over it in {@link downloadUrlSignal}.
   */
  private readonly _downloadUrlSignal = signal<Maybe<StorageFileDownloadUrl>>(undefined);
  readonly downloadMimeTypeSignal = signal<Maybe<ContentTypeMimeType>>(undefined);
  readonly downloadUrlExpiresAtSignal = signal<Maybe<DateOrUnixDateTimeSecondsNumber>>(undefined);

  readonly storageFileKeyFromInput$ = toObservable(this.storageFileKey).pipe(distinctUntilChanged(), shareReplay(1));

  readonly storageFileKeyFromSource$: Observable<Maybe<StorageFileKey>> = this.source$.pipe(
    map((source) => source?.storageFileKey),
    maybeValueFromObservableOrValue(),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly storageFileKey$: Observable<Maybe<StorageFileKey>> = combineLatest([this.storageFileKeyFromInput$, this.storageFileKeyFromSource$]).pipe(
    map(([storageFileKeyFromInput, storageFileKeyFromSource]) => {
      return storageFileKeyFromInput ?? storageFileKeyFromSource;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly storageFileKeySignal = toSignal(this.storageFileKey$);

  readonly hasDownloadUrlSignal = computed(() => Boolean(this.downloadUrlSignal()));

  // MARK: Public Url
  readonly publicStoragePathFromInput$ = toObservable(this.publicStoragePath).pipe(distinctUntilChanged(), shareReplay(1));

  readonly publicStoragePathFromSource$: Observable<Maybe<DbxFirebaseStorageFilePublicStoragePathInput>> = this.source$.pipe(
    map((source) => source?.publicStoragePath),
    maybeValueFromObservableOrValue(),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly publicStoragePathInput$: Observable<Maybe<DbxFirebaseStorageFilePublicStoragePathInput>> = combineLatest([this.publicStoragePathFromInput$, this.publicStoragePathFromSource$]).pipe(
    map(([publicStoragePathFromInput, publicStoragePathFromSource]) => {
      return publicStoragePathFromInput ?? publicStoragePathFromSource;
    }),
    shareReplay(1)
  );

  /**
   * The resolved public object path, or undefined while a configured factory still has no key to work from.
   */
  readonly publicStoragePath$: Observable<Maybe<StoragePathInput>> = combineLatest([this.publicStoragePathInput$, this.storageFileKey$]).pipe(
    map(([publicStoragePathInput, storageFileKey]) => {
      let result: Maybe<StoragePathInput>;

      if (typeof publicStoragePathInput === 'function') {
        // none of StoragePathInput's members is callable, so this discriminates the union unambiguously
        result = storageFileKey == null ? undefined : publicStoragePathInput(firestoreModelId(storageFileKey));
      } else {
        result = publicStoragePathInput;
      }

      return result;
    }),
    shareReplay(1)
  );

  readonly publicDownloadUrl$: Observable<Maybe<StorageFilePublicDownloadUrl>> = this.publicStoragePath$.pipe(
    map((publicStoragePath) => (publicStoragePath == null ? undefined : this.dbxFirebaseStorageService.publicDownloadUrl(publicStoragePath))),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly publicDownloadUrlSignal = toSignal(this.publicDownloadUrl$);

  readonly publicStoragePathInputSignal = toSignal(this.publicStoragePathInput$);

  /**
   * Whether the button is on the client-derived public url rather than the download action.
   *
   * An explicit `storageFileDownloadUrl` wins: it is a url the caller decided on, where a derived one is
   * only what the component could work out for itself.
   */
  readonly usesPublicDownloadUrlSignal = computed(() => {
    const storageFileDownloadUrl = this.storageFileDownloadUrl();
    return Boolean(this.publicStoragePathInputSignal()) && storageFileDownloadUrl == null;
  });

  /**
   * The public url this component derived itself, if it is the url the button is on.
   */
  readonly derivedPublicDownloadUrlSignal = computed(() => {
    const usesPublicDownloadUrl = this.usesPublicDownloadUrlSignal();
    const publicDownloadUrl = this.publicDownloadUrlSignal();

    return usesPublicDownloadUrl ? publicDownloadUrl : undefined;
  });

  /**
   * The url the button downloads from.
   *
   * A derived public url wins over a fetched one: it is available before first render and never expires, so
   * there is nothing for the action to improve on.
   */
  readonly downloadUrlSignal = computed<Maybe<StorageFileDownloadUrl>>(() => {
    const derivedPublicDownloadUrl = this.derivedPublicDownloadUrlSignal();
    const downloadUrl = this._downloadUrlSignal();

    return derivedPublicDownloadUrl ?? downloadUrl;
  });

  /**
   * Whether the download action is disabled, which also disables the button.
   *
   * A url the component already has is enough on its own: the button is then a live link, and the derived
   * public url arrives without a key ever being set.
   */
  readonly actionDisabledSignal = computed(() => {
    const storageFileKey = this.storageFileKeySignal();
    const hasDownloadUrl = this.hasDownloadUrlSignal();

    return !storageFileKey && !hasDownloadUrl;
  });

  readonly buttonStyleSignal = computed(() => {
    const config = this.configSignal();

    const result: DbxButtonStyle = {
      type: 'raised',
      ...config.buttonStyle
    };

    return result;
  });

  readonly previewButtonStyleSignal = computed(() => {
    const config = this.configSignal();

    const result: DbxButtonStyle = {
      type: 'raised',
      ...config.previewButtonStyle
    };

    return result;
  });

  readonly iconSignal = computed(() => {
    const config = this.configSignal();
    const hasDownloadUrl = this.hasDownloadUrlSignal();
    return hasDownloadUrl ? (config.downloadReadyIcon ?? config.icon) : config.icon;
  });

  readonly textSignal = computed(() => {
    const config = this.configSignal();
    const hasDownloadUrl = this.hasDownloadUrlSignal();
    return hasDownloadUrl ? (config.downloadReadyText ?? config.text) : config.text;
  });

  readonly previewIconSignal = computed(() => {
    const config = this.configSignal();
    return config.previewIcon;
  });

  readonly previewTextSignal = computed(() => {
    const config = this.configSignal();
    return config.previewText;
  });

  readonly anchorSignal = computed(() => {
    const downloadUrl = this.downloadUrlSignal();

    let result: Maybe<ClickableAnchor>;

    if (downloadUrl) {
      result = {
        url: downloadUrl
      };
    }

    return result;
  });

  readonly storageFileDownloadUrlEffect = effect(() => {
    const downloadUrl = this.storageFileDownloadUrl();

    if (downloadUrl || downloadUrl === null) {
      this._downloadUrlSignal.set(downloadUrl);
    }
  });

  // Preview
  readonly showPreviewButtonSignal = computed(() => {
    const showPreviewButton = this.showPreviewButton();
    const config = this.configSignal();
    const hasDownloadUrl = this.hasDownloadUrlSignal();
    return hasDownloadUrl && (showPreviewButton ?? config.showPreviewButton ?? true);
  });

  readonly openCustomPreviewSignal = computed(() => {
    const config = this.configSignal();
    return config.openCustomPreview;
  });

  readonly handleOpenPreviewDialog: DbxActionDialogFunction = () => {
    const openPreview = this.openCustomPreviewSignal();

    const srcUrl = this.downloadUrlSignal() as string;
    const inputEmbedMimeType = this.embedMimeType();
    const downloadMimeType = this.downloadMimeTypeSignal();
    const embedMimeType = inputEmbedMimeType ?? downloadMimeType;

    return (
      openPreview?.(srcUrl, embedMimeType) ??
      this.dbxWebFilePreviewService.openPreviewDialog({
        srcUrl,
        embedMimeType
      })
    );
  };

  // Cached Url Effect
  // When the key changes, check the cache to see if it is already available, and populate the download url if it is.
  readonly cachedUrlForStorageFileKey$ = this.storageFileKey$.pipe(
    switchMap((key) => (key ? this.dbxFirebaseStorageFileDownloadService.getCachedDownloadPairForStorageFile(key) : of(null))),
    shareReplay(1)
  );

  readonly cachedUrlForStorageFileKeySignal = toSignal(this.cachedUrlForStorageFileKey$);

  readonly cachedUrlEffect = effect(() => {
    const cachedPair = this.cachedUrlForStorageFileKeySignal();

    if (cachedPair) {
      this._downloadUrlSignal.set(cachedPair.downloadUrl);
      this.downloadMimeTypeSignal.set(cachedPair.mimeType);
      this.downloadUrlExpiresAtSignal.set(cachedPair.expiresAt);
    }
  });

  // Expiration Effect
  readonly downloadUrlExpiresAtDate$ = toObservable(this.downloadUrlExpiresAtSignal).pipe(map(dateFromDateOrTimeSecondsNumber), distinctUntilChanged(isSameDate), shareReplay(1));
  readonly downloadUrlExpiresAtDateSignal = toSignal(this.downloadUrlExpiresAtDate$);

  readonly downloadUrlHasExpired$ = this.downloadUrlExpiresAtDate$.pipe(
    switchMap((x) => {
      let obs: Observable<boolean>;

      if (x) {
        obs = interval(MS_IN_SECOND).pipe(
          map(() => isPast(x)),
          distinctUntilChanged(),
          shareReplay(1)
        );
      } else {
        obs = of(false);
      }

      return obs;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly downloadUrlHasExpiredSignal = toSignal(this.downloadUrlHasExpired$);
  readonly downloadUrlHasExpiredEffect = effect(() => {
    const expired = this.downloadUrlHasExpiredSignal();

    if (expired) {
      this._downloadUrlSignal.set(undefined);
      this.downloadMimeTypeSignal.set(undefined);
      this.downloadUrlExpiresAtSignal.set(undefined);
    }
  });

  // Output Effect
  readonly downloadDetailsSignal = computed(() => {
    const downloadUrl = this.downloadUrlSignal();
    const mimeType = this.downloadMimeTypeSignal();
    const expiresAt = this.downloadUrlExpiresAtDateSignal();

    const details: Maybe<DbxFirebaseStorageFileDownloadDetails> =
      downloadUrl == null
        ? undefined
        : {
            downloadUrl,
            mimeType,
            expiresAt
          };

    return details;
  });

  readonly downloadDetailsChangedEffect = effect(() => {
    const details: Maybe<DbxFirebaseStorageFileDownloadDetails> = this.downloadDetailsSignal();
    this.downloadDetailsChange.emit(details);
  });

  readonly sourceDownloadDetailsChangeCallbackEffect = effect(() => {
    const details: Maybe<DbxFirebaseStorageFileDownloadDetails> = this.downloadDetailsSignal();
    const source = this.source();

    if (source?.downloadDetailsChangeCallback) {
      source.downloadDetailsChangeCallback(details);
    }
  });

  // Handlers
  readonly handleGetDownloadUrl: WorkUsingContext<StorageFileKey, DbxFirebaseStorageFileDownloadUrlPair> = (value: StorageFileKey, context: WorkInstance<StorageFileKey, DbxFirebaseStorageFileDownloadUrlPair>) => {
    const source = this.source();
    const { customSource, handleGetDownloadUrl } = source ?? {};

    if (this.derivedPublicDownloadUrlSignal()) {
      // the url is derived on the client and already on the button, so the action has nothing to fetch. It
      // completes with no pair, since a public url has neither a mime type nor an expiration.
      context.success();
    } else if (handleGetDownloadUrl) {
      handleGetDownloadUrl(value, context);
    } else {
      context.startWorkingWithObservable(this.dbxFirebaseStorageFileDownloadService.downloadPairForStorageFileUsingSource(value, customSource));
    }
  };

  readonly handleGetDownloadUrlSuccess = (value: Maybe<DbxFirebaseStorageFileDownloadUrlPair>) => {
    const source = this.source();
    const { handleGetDownloadUrlSuccess } = source ?? {};

    // no pair means the derived public url completed the action, and there is nothing to record
    if (value) {
      this._downloadUrlSignal.set(value.downloadUrl);
      this.downloadMimeTypeSignal.set(value.mimeType);
      this.downloadUrlExpiresAtSignal.set(value.expiresAt);

      if (handleGetDownloadUrlSuccess) {
        handleGetDownloadUrlSuccess(value);
      }
    }
  };

  readonly handleGetDownloadUrlError = (error: unknown) => {
    const source = this.source();
    const { handleGetDownloadUrlError } = source ?? {};

    this._downloadUrlSignal.set(undefined);
    this.downloadMimeTypeSignal.set(undefined);
    this.downloadUrlExpiresAtSignal.set(undefined);

    if (handleGetDownloadUrlError) {
      handleGetDownloadUrlError(error);
    }
  };
}
