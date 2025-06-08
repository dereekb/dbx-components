import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, viewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { WorkUsingObservable, LoadingState, loadingStateContext, successResult, valueFromFinishedLoadingState, MaybeObservableOrValue, maybeValueFromObservableOrValue } from '@dereekb/rxjs';
import { MS_IN_SECOND, type Maybe } from '@dereekb/util';
import { Observable, first, of, shareReplay, switchMap, tap } from 'rxjs';
import { Clipboard } from '@angular/cdk/clipboard';
import { DownloadTextContent } from './download.text';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AbstractSubscriptionDirective, DbxActionButtonDirective } from '@dereekb/dbx-core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DbxLoadingComponent } from '../../../loading/loading.component';
import { NgTemplateOutlet } from '@angular/common';
import { DbxButtonComponent } from '../../../button/button.component';
import { DbxActionModule } from '../../../action/action.module';
import { DbxButtonSpacerDirective } from '../../../button/button.spacer.directive';

/**
 * DbxStructureDirective used specifically on the body of the app.
 */
@Component({
  templateUrl: './download.text.component.html',
  selector: 'dbx-download-text-view',
  standalone: true,
  imports: [NgTemplateOutlet, DbxLoadingComponent, DbxActionModule, DbxActionButtonDirective, DbxButtonComponent, DbxButtonSpacerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxDownloadTextViewComponent extends AbstractSubscriptionDirective {
  private readonly _clipboard = inject(Clipboard);
  private readonly _matSnackbar = inject(MatSnackBar);
  private readonly _sanitizer = inject(DomSanitizer);

  readonly downloadButton = viewChild<string, Maybe<ElementRef>>('downloadButton', { read: ElementRef });

  readonly loadingText = input<Maybe<string>>(undefined);
  readonly linear = input<Maybe<boolean>>(undefined);
  readonly showTitle = input<boolean>(true);
  readonly showPreview = input<boolean>(true);

  readonly content = input<Maybe<DownloadTextContent>>(undefined);
  readonly contentState = input<MaybeObservableOrValue<LoadingState<DownloadTextContent>>>(undefined);

  readonly contentState$ = toObservable(this.contentState).pipe(maybeValueFromObservableOrValue(), shareReplay(1));

  readonly contentStateSignal = toSignal(this.contentState$);

  readonly contentLoadingStateSignal = computed(() => {
    const content = this.content();
    const contentState = this.contentStateSignal();

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

  readonly contentSignal = toSignal(this.content$);

  readonly contentDataSignal = computed(() => this.contentSignal()?.content);

  readonly fileUrlSignal = computed(() => {
    const content = this.contentSignal();

    let fileUrl: Maybe<SafeResourceUrl> = undefined;

    if (content) {
      const blob = new Blob([content.content], { type: content.mimeType ?? 'application/octet-stream' });
      fileUrl = this._sanitizer.bypassSecurityTrustResourceUrl(window.URL.createObjectURL(blob));
    }

    return fileUrl;
  });

  readonly fileNameSignal = computed(() => this.contentSignal()?.name ?? 'File');

  readonly downloadReadySignal = computed(() => {
    const downloadButton = this.downloadButton();
    const fileName = this.fileNameSignal();
    const fileUrl = this.fileUrlSignal();
    return Boolean(downloadButton && fileName && fileUrl);
  });

  readonly context = loadingStateContext({ obs: this.contentLoadingState$ });

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
