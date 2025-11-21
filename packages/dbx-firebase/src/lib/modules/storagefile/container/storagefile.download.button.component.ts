import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DbxActionDialogDirective, DbxActionDialogFunction, DbxActionModule, DbxActionSnackbarErrorDirective, DbxAnchorComponent, DbxButtonComponent, DbxButtonStyle, DbxEmbedDialogComponent } from '@dereekb/dbx-web';
import { StorageFileKey, StorageFilePublicDownloadUrl, StorageFileSignedDownloadUrl } from '@dereekb/firebase';
import { ContentTypeMimeType, dateFromDateOrTimeNumber, DateOrUnixTimeNumber, isPast, Maybe, MS_IN_SECOND } from '@dereekb/util';
import { DbxFirebaseStorageFileDownloadService } from '../service/storagefile.download.service';
import { ClickableAnchor } from '@dereekb/dbx-core';
import { WorkUsingObservable } from '@dereekb/rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, interval, map, Observable, of, shareReplay, switchMap } from 'rxjs';
import { DbxFirebaseStorageFileDownloadUrlPair } from '../service/storagefile.download.storage.service';
import { MatDialog } from '@angular/material/dialog';

/**
 * Configuration for the DbxFirebaseStorageFileDownloadButton.
 */
export interface DbxFirebaseStorageFileDownloadButtonConfig {
  readonly buttonStyle?: Maybe<DbxButtonStyle>;
  readonly previewButtonStyle?: Maybe<DbxButtonStyle>;
  /**
   * Whether or not to pre-load the download url from the source.
   */
  readonly preload?: Maybe<boolean>;
  /**
   * Whether or not to show a preview button.
   */
  readonly showPreviewButton?: Maybe<boolean>;
  readonly icon?: Maybe<string>;
  readonly text?: Maybe<string>;
  readonly downloadReadyIcon?: Maybe<string>;
  readonly downloadReadyText?: Maybe<string>;
  readonly previewIcon?: Maybe<string>;
  readonly previewText?: Maybe<string>;
}

@Component({
  selector: 'dbx-firebase-storagefile-download-button',
  template: `
    <dbx-anchor dbxActionAnchor [anchor]="anchorSignal()" dbxAction [dbxActionAutoTrigger]="preloadSignal()" dbxActionSnackbarError [dbxActionDisabled]="!storageFileKey()" [dbxActionValue]="storageFileKey" [dbxActionHandler]="handleGetDownloadUrl" [dbxActionSuccessHandler]="handleGetDownloadUrlSuccess" [dbxActionErrorHandler]="handleGetDownloadUrlError">
      <dbx-button dbxActionButton [buttonStyle]="buttonStyleSignal()" [icon]="iconSignal()" [text]="textSignal()"></dbx-button>
    </dbx-anchor>
    @if (showPreviewButtonSignal()) {
      <ng-container dbxAction [dbxActionDialog]="handleOpenPreviewDialog" dbxActionHandlerValue>
        <span class="dbx-button-spacer"></span>
        <dbx-button dbxActionButton [buttonStyle]="previewButtonStyleSignal()" [icon]="previewIconSignal()" [text]="previewTextSignal()"></dbx-button>
      </ng-container>
    }
  `,
  imports: [DbxButtonComponent, DbxActionModule, DbxActionSnackbarErrorDirective, DbxActionDialogDirective, DbxAnchorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseStorageFileDownloadButton {
  readonly dbxFirebaseStorageFileDownloadService = inject(DbxFirebaseStorageFileDownloadService);
  readonly matDialog = inject(MatDialog);

  /**
   * The StorageFileKey to set up the download button for.
   */
  readonly storageFileKey = input<Maybe<StorageFileKey>>();

  /**
   * The download URL to use for the download button.
   */
  readonly storageFileDownloadUrl = input<Maybe<StorageFileSignedDownloadUrl | StorageFilePublicDownloadUrl>>();

  /**
   * The MIME type to use the embed component.
   */
  readonly embedMimeType = input<Maybe<ContentTypeMimeType | string>>();

  /**
   * Whether or not to show a preview button.
   *
   * Defaults to true.
   */
  readonly showPreviewButton = input<Maybe<boolean>>(true);

  /**
   * Output event emitted when the download URL changes.
   */
  readonly downloadUrlChange = output<Maybe<StorageFileSignedDownloadUrl>>();

  readonly config = input<Maybe<DbxFirebaseStorageFileDownloadButtonConfig>>();

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
      previewText: config?.previewText ?? 'View File'
    };

    return result;
  });

  readonly preloadSignal = computed(() => {
    const config = this.configSignal();
    return config.preload ?? false;
  });

  readonly downloadUrlSignal = signal<Maybe<StorageFileSignedDownloadUrl>>(undefined);
  readonly downloadUrlExpiresAtSignal = signal<Maybe<DateOrUnixTimeNumber>>(undefined);

  readonly storageFileKey$ = toObservable(this.storageFileKey).pipe(distinctUntilChanged(), shareReplay(1));

  readonly hasDownloadUrlSignal = computed(() => Boolean(this.downloadUrlSignal()));

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

  readonly storageFileDownloadUrlEffect = effect(
    () => {
      const downloadUrl = this.storageFileDownloadUrl();

      if (downloadUrl || downloadUrl === null) {
        this.downloadUrlSignal.set(downloadUrl);
      }
    },
    {
      allowSignalWrites: true
    }
  );

  // Preview
  readonly showPreviewButtonSignal = computed(() => {
    const config = this.configSignal();
    const hasDownloadUrl = this.hasDownloadUrlSignal();
    return hasDownloadUrl && (config.showPreviewButton ?? true);
  });

  readonly handleOpenPreviewDialog: DbxActionDialogFunction = () => {
    const srcUrl = this.downloadUrlSignal() as string;
    const embedMimeType = this.embedMimeType();

    return DbxEmbedDialogComponent.openDialog(this.matDialog, {
      srcUrl,
      embedMimeType,
      sanitizeUrl: true
    });
  };

  // Cached Url Effect
  // When the key changes, check the cache to see if it is already available, and populate the download url if it is.
  readonly cachedUrlForStorageFileKey$ = this.storageFileKey$.pipe(
    switchMap((key) => (key ? this.dbxFirebaseStorageFileDownloadService.getCachedDownloadPairForStorageFile(key) : of(null))),
    shareReplay(1)
  );
  readonly cachedUrlForStorageFileKeySignal = toSignal(this.cachedUrlForStorageFileKey$);

  readonly cachedUrlEffect = effect(
    () => {
      const cachedPair = this.cachedUrlForStorageFileKeySignal();

      if (cachedPair) {
        this.downloadUrlSignal.set(cachedPair.downloadUrl);
        this.downloadUrlExpiresAtSignal.set(cachedPair.expiresAt);
      }
    },
    {
      allowSignalWrites: true
    }
  );

  // Expiration Effect
  readonly downloadUrlExpiresAt$ = toObservable(this.downloadUrlExpiresAtSignal).pipe(map(dateFromDateOrTimeNumber), distinctUntilChanged(), shareReplay(1));

  readonly downloadUrlHasExpired$ = this.downloadUrlExpiresAt$.pipe(
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
  readonly downloadUrlHasExpiredEffect = effect(
    () => {
      const expired = this.downloadUrlHasExpiredSignal();

      if (expired) {
        this.downloadUrlSignal.set(undefined);
        this.downloadUrlExpiresAtSignal.set(undefined);
      }
    },
    {
      allowSignalWrites: true
    }
  );

  // Output Effect
  readonly downloadUrlChangeEffect = effect(() => {
    const downloadUrl = this.downloadUrlSignal();
    this.downloadUrlChange.emit(downloadUrl);
  });

  // Handlers
  readonly handleGetDownloadUrl: WorkUsingObservable<StorageFileKey, DbxFirebaseStorageFileDownloadUrlPair> = (value: StorageFileKey) => {
    return this.dbxFirebaseStorageFileDownloadService.downloadPairForStorageFile(value);
  };

  readonly handleGetDownloadUrlSuccess = (value: DbxFirebaseStorageFileDownloadUrlPair) => {
    this.downloadUrlSignal.set(value.downloadUrl);
    this.downloadUrlExpiresAtSignal.set(value.expiresAt);
  };

  readonly handleGetDownloadUrlError = (error: unknown) => {
    this.downloadUrlSignal.set(undefined);
    this.downloadUrlExpiresAtSignal.set(undefined);
  };
}
