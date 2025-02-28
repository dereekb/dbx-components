import { startWith, distinctUntilChanged, shareReplay, combineLatest, map, BehaviorSubject } from 'rxjs';
import { OnDestroy, Component, Input, ViewChild, ElementRef } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { ProgressBarMode } from '@angular/material/progress-bar';
import { ErrorInput, type Maybe } from '@dereekb/util';
import { checkNgContentWrapperHasContent } from '@dereekb/dbx-core';
import { ProgressSpinnerMode } from '@angular/material/progress-spinner';
import { DbxThemeColor } from '../layout/style/style';

/**
 * DbxBasicLoadingComponent loading state.
 */
export enum LoadingComponentState {
  NONE = -1,
  LOADING = 0,
  CONTENT = 1,
  ERROR = 2
}

/**
 * Basic loading component.
 */
@Component({
  selector: 'dbx-basic-loading',
  templateUrl: './basic-loading.component.html'
})
export class DbxBasicLoadingComponent implements OnDestroy {
  private _loading = new BehaviorSubject<Maybe<boolean>>(undefined);
  private _show = new BehaviorSubject<boolean>(true);
  private _error = new BehaviorSubject<Maybe<ErrorInput>>(undefined);

  private _customErrorContent = new BehaviorSubject<Maybe<ElementRef>>(undefined);
  private _customLoadingContent = new BehaviorSubject<Maybe<ElementRef>>(undefined);

  readonly state$ = combineLatest([this._loading, this._show, this._error]).pipe(
    map(([loading, show, error]) => {
      let state: LoadingComponentState;

      if (error) {
        state = LoadingComponentState.ERROR;
      } else if (loading == null) {
        // If loading has not yet been defined and no error has occured, we're waiting for some input on loading or error.
        state = LoadingComponentState.NONE;
      } else if (loading || !show) {
        state = LoadingComponentState.LOADING;
      } else {
        state = LoadingComponentState.CONTENT;
      }

      return state;
    }),
    distinctUntilChanged(),
    startWith(LoadingComponentState.NONE),
    shareReplay(1)
  );

  readonly error$ = this._error.asObservable();

  readonly hasNoCustomError$ = this._customErrorContent.pipe(map((x) => !checkNgContentWrapperHasContent(x)));
  readonly hasNoCustomLoading$ = this._customLoadingContent.pipe(map((x) => !checkNgContentWrapperHasContent(x)));

  @Input()
  diameter?: Maybe<number>;

  @Input()
  mode: ProgressBarMode | ProgressSpinnerMode = 'indeterminate';

  @Input()
  color: ThemePalette | DbxThemeColor = 'primary';

  @Input()
  text?: Maybe<string>;

  @Input()
  linear: Maybe<boolean> = false;

  ngOnDestroy() {
    this._error.complete();
    this._loading.complete();
    this._show.complete();
    this._customErrorContent.complete();
    this._customLoadingContent.complete();
  }

  @Input()
  get show(): boolean {
    return this._show.value;
  }

  set show(show: Maybe<boolean>) {
    this._show.next(show ?? true);
  }

  @Input()
  get loading(): Maybe<boolean> {
    return this._loading.value;
  }

  set loading(loading: Maybe<boolean>) {
    this._loading.next(loading);
  }

  @Input()
  get error(): Maybe<ErrorInput> {
    return this._error.value;
  }

  set error(error: Maybe<ErrorInput>) {
    this._error.next(error);
  }

  @ViewChild('customError')
  set customErrorContent(customErrorContent: Maybe<ElementRef>) {
    setTimeout(() => {
      this._customErrorContent.next(customErrorContent);
    }, 0);
  }

  @ViewChild('customLoading')
  set customLoadingContent(customLoadingContent: Maybe<ElementRef>) {
    setTimeout(() => {
      this._customLoadingContent.next(customLoadingContent);
    }, 0);
  }
}
