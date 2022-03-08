import { distinctUntilChanged, Observable, shareReplay } from 'rxjs';
import { Component, Inject } from '@angular/core';
import { MatSnackBarRef, MAT_SNACK_BAR_DATA } from '@angular/material/snack-bar';
import { Maybe } from '@dereekb/util';
import { map } from 'rxjs/operators';
import { DbxActionSnackbarDisplayConfig, DbxActionSnackbarActionConfig } from './action.snackbar';
import { DbxActionContextStoreSourceInstance, DbxActionState } from '@dereekb/dbx-core';
import ms from 'ms';

/**
 * Component for a snackbar that contains an action.
 */
@Component({
  template: `
    <div class="dbx-action-snackbar" [ngClass]="(snackbarStatusClass$ | async)!">
      <ng-container [ngSwitch]="complete$ | async">
        <ng-container *ngSwitchCase="true">
          <div class="spacer"></div>
          <dbx-button (buttonClick)="dismiss()" color="accent" icon="done" text="Success"></dbx-button>
        </ng-container>
        <ng-container *ngSwitchCase="false">
          <span>{{ message }}</span>
          <div class="spacer"></div>
          <dbx-action dbxActionValue [dbxActionSource]="actionSourceInstance" [dbxActionSuccess]="dismissEarly">
            <dbx-button dbxActionButton color="warn" [text]="action"></dbx-button>
          </dbx-action>
          <dbx-button-spacer></dbx-button-spacer>
          <dbx-button (buttonClick)="dismiss()" color="accent" icon="close"></dbx-button>
        </ng-container>
      </ng-container>
    </div>
  `
})
export class DbxActionSnackbarComponent {

  readonly action: Maybe<string>;

  constructor(
    readonly snackbar: MatSnackBarRef<DbxActionSnackbarComponent>,
    @Inject(MAT_SNACK_BAR_DATA) readonly data: DbxActionSnackbarDisplayConfig
  ) {
    this.action = this.data.action?.button ?? this.data.button;
  }

  readonly complete$ = this.actionSourceInstance.isSuccess$;
  readonly snackbarStatusClass$: Observable<string> = this.actionSourceInstance.actionState$.pipe(
    map((x) => {
      let classes = 'dbx-action-snackbar-';

      switch (x) {
        case DbxActionState.REJECTED:
          classes += 'error';
          break;
        case DbxActionState.SUCCESS:
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

  get message(): Maybe<string> {
    return this.data.message;
  }

  get actionConfig(): Maybe<DbxActionSnackbarActionConfig> {
    return this.data.action;
  }

  dismissEarly = (): void => {
    this.snackbar._dismissAfter(ms('3s'));
  }

  dismiss = (): void => {
    this.snackbar.dismiss();
  }

}
