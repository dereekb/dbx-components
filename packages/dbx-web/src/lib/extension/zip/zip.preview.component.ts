import { ChangeDetectionStrategy, Component, input, OnDestroy, signal } from '@angular/core';
import { DbxInjectionComponent } from '@dereekb/dbx-core';
import { NgTemplateOutlet } from '@angular/common';
import { DbxLoadingComponent } from '../../loading';
import { Maybe, WebsiteUrlWithPrefix } from '@dereekb/util';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, distinctUntilChanged, from, Observable, of, shareReplay, switchMap } from 'rxjs';
import { beginLoading, errorResult, LoadingState, loadingStateContext, loadingStateFromObs, startWithBeginLoading, successResult, valueFromFinishedLoadingState } from '@dereekb/rxjs';
import { DbxZipBlobPreviewComponent } from './zip.blob.preview.component';

/**
 * Used to display a corresponding widget based on the input data.
 */
@Component({
  selector: 'dbx-zip-preview',
  template: `
    <dbx-loading [context]="context">
      <dbx-zip-blob-preview [downloadFileName]="downloadFileName()" [blob]="zipFileBlobSignal()"></dbx-zip-blob-preview>
    </dbx-loading>
  `,
  standalone: true,
  imports: [DbxInjectionComponent, DbxLoadingComponent, DbxZipBlobPreviewComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxZipPreviewComponent implements OnDestroy {
  /**
   * The URL to download the zip file from, if applicable.
   */
  readonly srcUrl = input<Maybe<WebsiteUrlWithPrefix>>();

  /**
   * The blob to use for the zip file, if applicable.
   */
  readonly blob = input<Maybe<Blob>>();

  /**
   * The file name to use for the zip file.
   */
  readonly downloadFileName = input<Maybe<string>>();

  readonly srcUrl$ = toObservable(this.srcUrl);
  readonly blob$ = toObservable(this.blob);

  readonly zipFileBlobLoadingState$ = combineLatest([this.srcUrl$, this.blob$]).pipe(
    switchMap(([srcUrl, blob]) => {
      let obs: Observable<LoadingState<Blob>>;

      if (blob) {
        obs = of(successResult(blob));
      } else if (srcUrl) {
        obs = from(
          fetch(srcUrl, { method: 'GET' }).then((x) =>
            x
              .blob()
              .then((y) => successResult(y))
              .catch((e) => errorResult<Blob>(e))
          )
        ).pipe(startWithBeginLoading());
      } else {
        obs = of(beginLoading<Blob>());
      }

      return obs;
    })
  );

  readonly zipFileBlob$ = this.zipFileBlobLoadingState$.pipe(valueFromFinishedLoadingState(), distinctUntilChanged(), shareReplay(1));
  readonly zipFileBlobSignal = toSignal(this.zipFileBlob$);

  readonly context = loadingStateContext({ obs: this.zipFileBlobLoadingState$ });

  ngOnDestroy(): void {
    this.context.destroy();
  }
}
