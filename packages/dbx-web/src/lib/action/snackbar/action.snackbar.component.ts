import { Component, AfterViewInit, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { filterMaybe, LoadingStateType } from '@dereekb/rxjs';
import { shareReplay, switchMap, startWith, Subject, of, filter, map } from 'rxjs';
import { MatSnackBarRef, MAT_SNACK_BAR_DATA } from '@angular/material/snack-bar';
import { MS_IN_SECOND, type Maybe } from '@dereekb/util';
import { DbxActionSnackbarDisplayConfig, DbxActionSnackbarActionConfig } from './action.snackbar';
import { cleanSubscription, DbxActionDirective, DbxActionValueStreamDirective, DbxActionSuccessHandlerFunction, DbxActionSourceDirective, DbxActionSuccessHandlerDirective, completeOnDestroy } from '@dereekb/dbx-core';
import { NgClass } from '@angular/common';
import { DbxButtonComponent } from '../../button/button.component';
import { DbxButtonSpacerDirective } from '../../button/button.spacer.directive';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxSpacerDirective } from '../../layout/style/spacer.directive';

/**
 * Component for a snackbar that contains an action.
 */
@Component({
  templateUrl: './action.snackbar.component.html',
  standalone: true,
  imports: [NgClass, DbxActionSourceDirective, DbxActionSuccessHandlerDirective, DbxButtonComponent, DbxButtonSpacerDirective, DbxSpacerDirective, DbxActionDirective, DbxActionValueStreamDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxActionSnackbarComponent implements AfterViewInit {
  readonly snackbarRef = inject(MatSnackBarRef<DbxActionSnackbarComponent>);
  readonly snackbarData = inject<DbxActionSnackbarDisplayConfig>(MAT_SNACK_BAR_DATA);

  private readonly _durationTimeout = completeOnDestroy(new Subject<void>());
  private readonly _actionRef = this.snackbarData.action?.reference;

  readonly sourceInstance$ = of(this._actionRef).pipe(
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

  readonly sourceInstanceSignal = toSignal(this.sourceInstance$);
  readonly completeSignal = toSignal(this.complete$);
  readonly loadingStateTypeSignal = toSignal(this.loadingStateType$);
  readonly snackbarStatusClassSignal = computed(() => {
    let classes = 'dbx-action-snackbar-';
    const loadingStateType = this.loadingStateTypeSignal();

    switch (loadingStateType) {
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
  });

  readonly button: Maybe<string> = this.snackbarData.action?.button ?? this.snackbarData.button;
  readonly action: Maybe<DbxActionSnackbarActionConfig> = this.snackbarData.action;
  readonly hasAction: boolean = Boolean(this.action?.reference);
  readonly message: Maybe<string> = this.snackbarData.message;
  readonly actionConfig: Maybe<DbxActionSnackbarActionConfig> = this.snackbarData.action;

  constructor() {
    // Subscribe and close if the duration is up and the action state is idle.
    cleanSubscription(
      this._durationTimeout
        .pipe(
          switchMap(() => this.loadingStateType$),
          filter((x) => x === LoadingStateType.IDLE)
        )
        .subscribe(() => {
          this.dismiss();
        })
    );
  }

  ngAfterViewInit(): void {
    // Responsible for hiding itself if it has an action.
    if (this.hasAction) {
      setTimeout(
        () => {
          this._durationTimeout.next();
        },
        this.snackbarData.action?.duration ?? MS_IN_SECOND * 10
      );
    }
  }

  dismissAfterActionCompletes: DbxActionSuccessHandlerFunction = (): void => {
    this.snackbarRef._dismissAfter(MS_IN_SECOND * 3);
  };

  dismiss = (): void => {
    this.snackbarRef.dismiss();
  };
}
