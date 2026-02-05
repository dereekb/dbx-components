import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, computed, inject, input, viewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { WorkUsingObservable, LoadingState, loadingStateContext, successResult, valueFromFinishedLoadingState, MaybeObservableOrValue, maybeValueFromObservableOrValue } from '@dereekb/rxjs';
import { MS_IN_SECOND, type Maybe } from '@dereekb/util';
import { Observable, first, of, shareReplay, switchMap, tap } from 'rxjs';
import { Clipboard } from '@angular/cdk/clipboard';
import { DownloadTextContent } from './download.text';
import { AbstractSubscriptionDirective, DbxActionButtonDirective } from '@dereekb/dbx-core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DbxLoadingComponent } from '../../../loading/loading.component';
import { NgTemplateOutlet } from '@angular/common';
import { DbxButtonComponent } from '../../../button/button.component';
import { DbxActionModule } from '../../../action/action.module';
import { DbxButtonSpacerDirective } from '../../../button/button.spacer.directive';
import { browserObjectUrlRef } from '@dereekb/browser';
import { DbxDownloadBlobButtonComponent, DbxDownloadBlobButtonConfig } from '../blob/download.blob.button.component';
import { AbstractDbxClipboardDirective } from '../../../util/clipboard.directive';

/**
 * View for previewing and downloading arbitrary text content.
 */
@Component({
  templateUrl: './download.text.component.html',
  selector: 'dbx-download-text-view',
  standalone: true,
  imports: [NgTemplateOutlet, DbxLoadingComponent, DbxActionModule, DbxActionButtonDirective, DbxButtonComponent, DbxButtonSpacerDirective, DbxDownloadBlobButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxDownloadTextViewComponent extends AbstractDbxClipboardDirective implements OnDestroy {
  private readonly _browserObjectUrl = browserObjectUrlRef();

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
  readonly fileNameSignal = computed(() => this.contentSignal()?.name ?? 'download.txt');

  readonly downloadConfigSignal = computed(() => {
    const content = this.contentSignal();
    const fileName = this.fileNameSignal();
    let result: Maybe<DbxDownloadBlobButtonConfig> = undefined;

    if (content) {
      result = {
        blob: new Blob([content.content], { type: content.mimeType ?? 'application/octet-stream' }),
        fileName
      };
    }

    return result;
  });

  readonly context = loadingStateContext({ obs: this.contentLoadingState$ });

  readonly handleCopyToClipboard: WorkUsingObservable = () => {
    return this.content$.pipe(
      first(),
      switchMap((downloadTextContent: Maybe<DownloadTextContent>) => {
        if (downloadTextContent) {
          return this._copyToClipboard(downloadTextContent.content);
        } else {
          return of(false);
        }
      })
    );
  };

  ngOnDestroy() {
    this._browserObjectUrl.destroy();
  }
}
