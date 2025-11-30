import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, computed, inject, input, viewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AbstractSubscriptionDirective, DbxActionButtonDirective, DbxButtonDisplay } from '@dereekb/dbx-core';
import { DbxButtonComponent, type DbxButtonStyle } from '../../../button/button.component';
import { DbxActionModule } from '../../../action/action.module';
import { DbxButtonSpacerDirective } from '../../../button/button.spacer.directive';
import { browserObjectUrlRef } from '@dereekb/browser';
import { asPromise, Getter, Maybe, PromiseOrValue, safeCompareEquality } from '@dereekb/util';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, from, Observable, of, shareReplay, switchMap } from 'rxjs';
import { NgClass } from '@angular/common';

export interface DbxDownloadBlobButtonConfig {
  /**
   * Button display customization.
   */
  readonly buttonDisplay?: Maybe<DbxButtonDisplay>;
  /**
   * Custom button style to use.
   */
  readonly buttonStyle?: Maybe<DbxButtonStyle>;
  /**
   * Name of the file to save when downloaded.
   */
  readonly fileName?: Maybe<string>;
  /**
   * Blob to download.
   */
  readonly blob?: Maybe<Blob>;
  /**
   * Getter for the blob to download.
   */
  readonly loadBlob?: Maybe<Getter<PromiseOrValue<Maybe<Blob>>>>;
  /**
   * Whether or not to preload the blob from the blobGetter instead of waiting for the button to be moused over.
   *
   * Ignored if blobGetter is not provided.
   */
  readonly preloadBlob?: Maybe<boolean>;
}

/**
 * Button used for downloading an arbitrary blob based on the input configuration.
 */
@Component({
  selector: 'dbx-download-blob-button',
  template: `
    <a #downloadButton [ngClass]="{ 'pointer-disabled': !downloadReadySignal() }" e [href]="fileUrlSignal()" [attr.download]="fileNameSignal()"><dbx-button [buttonDisplay]="buttonDisplaySignal()" [buttonStyle]="buttonStyleSignal()" [working]="!downloadReadySignal()" [disabled]="!downloadReadySignal()"></dbx-button></a>
  `,
  standalone: true,
  imports: [NgClass, DbxActionModule, DbxActionButtonDirective, DbxButtonComponent, DbxButtonSpacerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxDownloadBlobButtonComponent extends AbstractSubscriptionDirective implements OnDestroy {
  private readonly _sanitizer = inject(DomSanitizer);

  private readonly _browserObjectUrl = browserObjectUrlRef();

  readonly config = input<Maybe<DbxDownloadBlobButtonConfig>>(undefined);

  readonly downloadButton = viewChild<string, Maybe<ElementRef>>('downloadButton', { read: ElementRef });

  readonly config$ = toObservable(this.config);

  readonly blob$: Observable<Maybe<Blob>> = this.config$.pipe(
    distinctUntilChanged((x, y) => safeCompareEquality(x, y, (a, b) => a?.blob === b?.blob && a?.loadBlob === b?.loadBlob)),
    switchMap((x) => {
      let obs: Observable<Maybe<Blob>>;

      if (x?.loadBlob) {
        obs = from(asPromise(x.loadBlob()));
      } else {
        obs = of(x?.blob);
      }

      return obs;
    }),
    shareReplay(1)
  );

  readonly blobSignal = toSignal(this.blob$);

  readonly fileUrlSignal = computed(() => {
    const blob = this.blobSignal();

    let fileUrl: Maybe<SafeResourceUrl> = undefined;

    if (blob) {
      const objectUrl = this._browserObjectUrl.createBrowserUrl(blob);
      fileUrl = this._sanitizer.bypassSecurityTrustResourceUrl(objectUrl);
    }

    return fileUrl;
  });

  readonly fileNameSignal = computed(() => this.config()?.fileName ?? 'File');

  readonly downloadReadySignal = computed(() => {
    const downloadButton = this.downloadButton();
    const fileName = this.fileNameSignal();
    const fileUrl = this.fileUrlSignal();
    return Boolean(downloadButton && fileName && fileUrl);
  });

  readonly buttonDisplaySignal = computed(() => {
    const config = this.config();
    const buttonDisplay = config?.buttonDisplay;

    const display: DbxButtonDisplay = buttonDisplay ?? {
      icon: 'download',
      text: 'Download'
    };

    return display;
  });

  readonly buttonStyleSignal = computed(() => {
    const buttonStyle = this.config()?.buttonStyle;

    const style: DbxButtonStyle = buttonStyle ?? {
      type: 'raised'
    };

    return style;
  });

  override ngOnDestroy() {
    super.ngOnDestroy();
    this._browserObjectUrl.destroy();
  }
}
