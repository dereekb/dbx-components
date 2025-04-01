import { ChangeDetectionStrategy, Component, ElementRef, Input, ViewChild, computed, inject, input, viewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { WorkUsingObservable, LoadingState, filterMaybe, loadingStateContext, successResult, valueFromFinishedLoadingState, switchMapToDefault } from '@dereekb/rxjs';
import { MS_IN_SECOND, type Maybe } from '@dereekb/util';
import { BehaviorSubject, Observable, combineLatest, distinctUntilChanged, first, map, of, shareReplay, switchMap, tap } from 'rxjs';
import { Clipboard } from '@angular/cdk/clipboard';
import { DownloadTextContent } from './download.text';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * DbxStructureDirective used specifically on the body of the app.
 */
@Component({
  templateUrl: './download.text.component.html',
  selector: 'dbx-download-text-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxDownloadTextViewComponent extends AbstractSubscriptionDirective {
  private readonly _clipboard = inject(Clipboard);
  private readonly _matSnackbar = inject(MatSnackBar);
  private readonly _sanitizer = inject(DomSanitizer);

  readonly downloadButton = viewChild<ElementRef>('downloadButton');

  readonly loadingText = input<Maybe<string>>(undefined);
  readonly linear = input<Maybe<boolean>>(undefined);
  readonly showTitle = input<boolean>(true);
  readonly showPreview = input<boolean>(true);

  readonly content = input<Maybe<DownloadTextContent>>(undefined);
  readonly contentState = input<Maybe<LoadingState<DownloadTextContent>>>(undefined);

  readonly contentLoadingStateSignal = computed(() => {
    const content = this.content();
    const contentState = this.contentState();

    let result: Maybe<LoadingState<DownloadTextContent>>;

    if (contentState) {
      result = contentState;
    } else if (content) {
      result = successResult(content);
    }

    return result;
  });

  readonly contentLoadingState$ = toObservable(this.contentLoadingStateSignal);
  readonly content$: Observable<Maybe<DownloadTextContent>> = this.contentLoadingState$.pipe(
    switchMap((x) => {
      if (x) {
        return of(x).pipe(valueFromFinishedLoadingState());
      } else {
        return of(undefined);
      }
    })
  );

  readonly contentData$ = this.content$.pipe(map((x) => x?.content));

  readonly context = loadingStateContext({ obs: this.contentLoadingState$ });

  readonly fileName$ = this.content$.pipe(
    map((x) => x?.name ?? 'File'),
    shareReplay(1)
  );

  readonly fileUrl$: Observable<Maybe<SafeResourceUrl>> = this.content$.pipe(
    map((content) => {
      let fileUrl: Maybe<SafeResourceUrl> = undefined;

      if (content) {
        const blob = new Blob([content.content], { type: content.mimeType ?? 'application/octet-stream' });
        fileUrl = this._sanitizer.bypassSecurityTrustResourceUrl(window.URL.createObjectURL(blob));
      }

      return fileUrl;
    }),
    shareReplay(1)
  );

  readonly downloadReady$ = combineLatest([toObservable(this.downloadButton), this.fileName$, this.fileUrl$]).pipe(
    map(([button, name, url]) => Boolean(button && name && url)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly handleCopyToClipboard: WorkUsingObservable = () => {
    return this.content$.pipe(
      first(),
      switchMap((downloadTextContent: Maybe<DownloadTextContent>) => {
        if (downloadTextContent) {
          return new Promise<boolean>((resolve, reject) => {
            const pending = this._clipboard.beginCopy(downloadTextContent.content);

            let secondsRemainingForCopy = 20; // attempt to copy for up to 20 seconds

            const attempt = () => {
              const copyIsFinished = pending.copy();

              if (!copyIsFinished && --secondsRemainingForCopy) {
                setTimeout(attempt, MS_IN_SECOND);
              } else {
                // Remember to destroy when you're done!
                pending.destroy();

                if (copyIsFinished) {
                  resolve(true);
                } else {
                  reject(false);
                }
              }
            };

            attempt();
          });
        } else {
          return of(false);
        }
      }),
      tap((success) => {
        if (success) {
          this._matSnackbar.open('Copied to clipboard', undefined, { duration: 3 * MS_IN_SECOND });
        } else {
          this._matSnackbar.open('Content failed to copy...', undefined, { duration: 3 * MS_IN_SECOND });
        }
      })
    );
  };
}
