import { OnInit, Component, Inject, OnDestroy, AfterViewInit } from '@angular/core';
import { filterMaybe, LoadingStateType } from '@dereekb/rxjs';
import { distinctUntilChanged, Observable, shareReplay, BehaviorSubject, switchMap, startWith, Subject, of, filter, map } from 'rxjs';
import { MatSnackBarRef, MAT_SNACK_BAR_DATA } from '@angular/material/snack-bar';
import { Maybe } from '@dereekb/util';
import { DbxActionSnackbarDisplayConfig, DbxActionSnackbarActionConfig } from './action.snackbar';
import { DbxActionContextSourceReference, AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import ms from 'ms';

/**
 * Component for a snackbar that contains an action.
 */
@Component({
  templateUrl: './action.snackbar.component.html'
})
export class DbxActionSnackbarComponent extends AbstractSubscriptionDirective implements OnInit, AfterViewInit, OnDestroy {
  private _durationTimeout = new Subject<void>();
  private _actionRef = new BehaviorSubject<Maybe<DbxActionContextSourceReference>>(undefined);

  readonly value$ = of(0); // value passed to the action.
  readonly sourceInstance$ = this._actionRef.pipe(
    filterMaybe(),
    map((x) => x?.sourceInstance)
  );
  readonly complete$ = this.sourceInstance$.pipe(
    switchMap((x) => x.isSuccess$),
    startWith(false),
    shareReplay(1)
  );
  readonly loadingStateType$ = this.sourceInstance$.pipe(
    switchMap((x) => x.loadingStateType$),
    startWith(LoadingStateType.IDLE),
    shareReplay(1)
  );
  readonly snackbarStatusClass$: Observable<string> = this.loadingStateType$.pipe(
    map((x) => {
      let classes = 'dbx-action-snackbar-';

      switch (x) {
        case LoadingStateType.ERROR:
          classes += 'error';
          break;
        case LoadingStateType.SUCCESS:
          classes += 'success';
          break;
        default:
          classes += 'idle';
          break;
      }

      return classes;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly button: Maybe<string>;

  get action() {
    return this.data.action;
  }

  get hasAction(): boolean {
    return Boolean(this._actionRef.value);
  }

  get message(): Maybe<string> {
    return this.data.message;
  }

  get actionConfig(): Maybe<DbxActionSnackbarActionConfig> {
    return this.data.action;
  }

  constructor(readonly snackbar: MatSnackBarRef<DbxActionSnackbarComponent>, @Inject(MAT_SNACK_BAR_DATA) readonly data: DbxActionSnackbarDisplayConfig) {
    super();
    this.button = this.data.action?.button ?? this.data.button;
    this._actionRef.next(this.data.action?.reference);
  }

  ngOnInit(): void {
    // Subscribe and close if the duration is up and the action state is idle.
    this.sub = this._durationTimeout
      .pipe(
        switchMap(() => this.loadingStateType$),
        filter((x) => x === LoadingStateType.IDLE)
      )
      .subscribe(() => {
        this.dismiss();
      });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._actionRef.value?.destroy();
    this._actionRef.complete();
    this._durationTimeout.complete();
  }

  ngAfterViewInit(): void {
    // Responsible for hiding itself if it has an action.
    if (this.hasAction) {
      setTimeout(() => {
        this._durationTimeout.next();
      }, this.action?.duration ?? ms('10s'));
    }
  }

  dismissAfterActionCompletes = (): void => {
    this.snackbar._dismissAfter(ms('3s'));
  };

  dismiss = (): void => {
    this.snackbar.dismiss();
  };
}
