import { distinctUntilChanged, Observable } from 'rxjs';
import { shareReplay } from 'rxjs';
import { Component, Inject } from '@angular/core';
import { MatSnackBarRef, MAT_SNACK_BAR_DATA } from '@angular/material/snack-bar';
import { Maybe } from '@dereekb/util';
import ms from 'ms';
import { map } from 'rxjs/operators';
import { ActionContextStoreSourceInstance, ActionState, DbxActionSnackbarComponentConfig } from '@dereekb/dbx-core';

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
  `,
  // TODO: styleUrls: ['./action.scss']
})
export class DbxActionSnackbarComponent {

  constructor(
    readonly snackbar: MatSnackBarRef<DbxActionSnackbarComponent>,
    @Inject(MAT_SNACK_BAR_DATA) readonly data: DbxActionSnackbarComponentConfig
  ) {
    if (!data.actionSource) {
      throw new Error('No action was provided to ActionSnackbar.');
    }
  }

  readonly complete$ = this.actionSourceInstance.isSuccess$;
  readonly snackbarStatusClass$: Observable<string> = this.actionSourceInstance.actionState$.pipe(
    map((x) => {
      let classes = 'dbx-action-snackbar-';

      switch (x) {
        case ActionState.Rejected:
          classes += 'error';
          break;
        case ActionState.Success:
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

  get action(): string {
    return this.data.action;
  }

  get actionSourceInstance(): ActionContextStoreSourceInstance {
    return this.data.actionSource;
  }

  dismissEarly = (): void => {
    this.snackbar._dismissAfter(ms('3s'));
  }

  dismiss = (): void => {
    this.snackbar.dismiss();
  }

}
