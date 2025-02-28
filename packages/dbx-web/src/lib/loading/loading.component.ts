import { BehaviorSubject, shareReplay, Observable, distinctUntilChanged, map, switchMap, combineLatest, of } from 'rxjs';
import { OnDestroy, Component, Input, ChangeDetectorRef, ChangeDetectionStrategy, inject } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { ProgressBarMode } from '@angular/material/progress-bar';
import { LoadingContext } from '@dereekb/rxjs';
import { ErrorInput, type Maybe } from '@dereekb/util';
import { tapSafeMarkForCheck } from '@dereekb/dbx-core';
import { DbxThemeColor } from '../layout/style/style';

export interface DbxLoadingComponentState {
  loading: boolean;
  error: Maybe<ErrorInput>;
}

/**
 * Loading View component that provides content sections for loading, error, and an error action.
 */
@Component({
  selector: 'dbx-loading',
  template: `
    <dbx-basic-loading [show]="show" [color]="color" [text]="text" [mode]="mode" [linear]="linear" [diameter]="diameter" [error]="error$ | async" [loading]="loading$ | async">
      <ng-content loading select="[loading]"></ng-content>
      <div class="dbx-loading-linear-done-padding" *ngIf="linear && padding && !(loading$ | async)"></div>
      <ng-content></ng-content>
      <ng-content error select="[error]"></ng-content>
      <ng-content errorAction select="[errorAction]"></ng-content>
    </dbx-basic-loading>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxLoadingComponent implements OnDestroy {
  readonly cdRef = inject(ChangeDetectorRef);

  private _context = new BehaviorSubject<Maybe<LoadingContext>>(undefined);
  private _inputLoading = new BehaviorSubject<Maybe<boolean>>(true);
  private _inputError = new BehaviorSubject<Maybe<ErrorInput>>(undefined);

  readonly state$: Observable<DbxLoadingComponentState> = combineLatest([this._inputLoading, this._inputError, this._context.pipe(switchMap((x) => (x != null ? x.stream$ : of(undefined))))]).pipe(
    map(([inputLoading, inputError, loadingState]) => {
      if (loadingState) {
        return loadingState as DbxLoadingComponentState;
      } else {
        return {
          loading: inputLoading ?? false,
          error: inputError
        };
      }
    }),
    distinctUntilChanged((a, b) => a.loading === b.loading && a.error === b.error),
    tapSafeMarkForCheck(this.cdRef),
    shareReplay(1)
  );

  readonly loading$ = this.state$.pipe(
    map((x) => x.loading),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly error$ = this.state$.pipe(
    map((x) => x.error),
    distinctUntilChanged(),
    shareReplay(1)
  );

  @Input()
  show?: Maybe<boolean>;

  @Input()
  text?: Maybe<string>;

  @Input()
  mode: ProgressBarMode = 'indeterminate';

  @Input()
  color: ThemePalette | DbxThemeColor = 'primary';

  @Input()
  diameter?: Maybe<number>;

  @Input()
  linear?: Maybe<boolean>;

  /**
   * Whether or not to add padding to the linear presentation when linear is complete. This prevents the linear bar from pushing content around.
   */
  @Input()
  padding?: Maybe<boolean>;

  ngOnDestroy() {
    this._context.complete();
    this._inputError.complete();
    this._inputLoading.complete();
  }

  @Input()
  get context(): Maybe<LoadingContext> {
    return this._context.value;
  }

  set context(context: Maybe<LoadingContext>) {
    this._context.next(context);
  }

  @Input()
  get loading(): Maybe<boolean> {
    return this._inputLoading.value;
  }

  set loading(loading: Maybe<boolean>) {
    this._inputLoading.next(loading ?? false);
  }

  @Input()
  get error(): Maybe<ErrorInput> {
    return this._inputError.value;
  }

  set error(error: Maybe<ErrorInput>) {
    this._inputError.next(error);
  }
}
