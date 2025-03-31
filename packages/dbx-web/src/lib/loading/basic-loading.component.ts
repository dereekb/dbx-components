import { map, BehaviorSubject, delay } from 'rxjs';
import { OnDestroy, Component, ViewChild, ElementRef, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { ProgressBarMode } from '@angular/material/progress-bar';
import { ErrorInput, type Maybe } from '@dereekb/util';
import { checkNgContentWrapperHasContent } from '@dereekb/dbx-core';
import { ProgressSpinnerMode } from '@angular/material/progress-spinner';
import { DbxThemeColor } from '../layout/style/style';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxErrorComponent } from '../error/error.component';
import { DbxLoadingProgressComponent } from './loading-progress.component';

/**
 * DbxBasicLoadingComponent loading state.
 */
export type LoadingComponentState = 'none' | 'loading' | 'content' | 'error';

/**
 * Basic loading component.
 */
@Component({
  selector: 'dbx-basic-loading',
  templateUrl: './basic-loading.component.html',
  imports: [DbxErrorComponent, DbxLoadingProgressComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxBasicLoadingComponent implements OnDestroy {
  // TODO: Test that the delay that is used by the behavior subjects is no longer needed to properly compute the result
  /**
  private readonly _customErrorViewChild = viewChild('customError');
  private readonly _customLoadingViewChild = viewChild('customLoading');
   */

  private readonly _customErrorContent = new BehaviorSubject<Maybe<ElementRef>>(undefined);
  private readonly _customLoadingContent = new BehaviorSubject<Maybe<ElementRef>>(undefined);

  readonly diameter = input<Maybe<number>>();
  readonly mode = input<ProgressBarMode | ProgressSpinnerMode>('indeterminate');
  readonly color = input<ThemePalette | DbxThemeColor>('primary');
  readonly text = input<Maybe<string>>();
  readonly linear = input<Maybe<boolean>>(false);

  readonly show = input<Maybe<boolean>>(true);
  readonly loading = input<Maybe<boolean>>();
  readonly error = input<Maybe<ErrorInput>>();

  readonly stateSignal = computed<LoadingComponentState>(() => {
    const loading = this.loading();
    const error = this.error();
    const show = this.show() ?? true; // default to true if not defined

    let state: LoadingComponentState;

    if (error) {
      state = 'error';
    } else if (loading == null) {
      // If loading has not yet been defined and no error has occured, we're waiting for some input on loading or error.
      state = 'none';
    } else if (loading || !show) {
      state = 'loading';
    } else {
      state = 'content';
    }

    return state;
  });

  readonly hasNoCustomErrorSignal = toSignal(
    this._customErrorContent.pipe(
      delay(0),
      map((x) => !checkNgContentWrapperHasContent(x))
    )
  );
  readonly hasNoCustomLoadingSignal = toSignal(
    this._customLoadingContent.pipe(
      delay(0),
      map((x) => !checkNgContentWrapperHasContent(x))
    )
  );

  ngOnDestroy() {
    this._customErrorContent.complete();
    this._customLoadingContent.complete();
  }

  @ViewChild('customError')
  set customErrorContent(customErrorContent: Maybe<ElementRef>) {
    this._customErrorContent.next(customErrorContent);
  }

  @ViewChild('customLoading')
  set customLoadingContent(customLoadingContent: Maybe<ElementRef>) {
    this._customLoadingContent.next(customLoadingContent);
  }
}
