import { Component, Inject, OnDestroy } from '@angular/core';
import { MAT_SNACK_BAR_DATA, MatSnackBar, MatSnackBarConfig, MatSnackBarRef } from '@angular/material/snack-bar';
import { SubscriptionObject } from '@dereekb/rxjs';
import { ErrorInput, MS_IN_MINUTE, TimerInstance, toggleTimerRunning } from '@dereekb/util';
import { NgPopoverRef } from 'ng-overlay-container';
import { BehaviorSubject, from } from 'rxjs';

export type DbxErrorSnackbarConfig = Omit<MatSnackBarConfig<any>, 'data' | 'viewContainerRef'>;

export interface DbxErrorSnackbarData<T extends ErrorInput = ErrorInput> {
  /**
   * The error being passed to the error view.
   */
  readonly error: T;
  /**
   * Duration to show the error before closing while not interacting with the error view.
   *
   * While the error's info view is open the snackbar will not automatically be dismissed.
   */
  readonly duration?: number;
}

/**
 * A snackbar orientation for an error.
 */
@Component({
  templateUrl: './error.snackbar.component.html'
})
export class DbxErrorSnackbarComponent implements OnDestroy {
  private _allowAutoDismiss = Boolean(this.data.duration);

  private _popoverOpen = new BehaviorSubject<boolean>(false);
  private _autoDismissTimer = new TimerInstance(this.data.duration ?? MS_IN_MINUTE, this._allowAutoDismiss);

  private _popoverSub = new SubscriptionObject();
  private _popoverSyncSub = new SubscriptionObject(this._popoverOpen.subscribe((x) => toggleTimerRunning(this._autoDismissTimer, !x)));
  private _autoDismissSub = new SubscriptionObject(from(this._autoDismissTimer.promise).subscribe(() => this.dismiss()));

  get error() {
    return this.data.error;
  }

  constructor(readonly snackBarRef: MatSnackBarRef<DbxErrorSnackbarComponent>, @Inject(MAT_SNACK_BAR_DATA) readonly data: DbxErrorSnackbarData) {}

  ngOnInit(): void {
    if (!this._allowAutoDismiss) {
      this._popoverSyncSub.destroy();
      this._autoDismissSub.destroy();
    }
  }

  ngOnDestroy(): void {
    this._popoverOpen.complete();
    this._popoverSub.destroy();
    this._popoverSyncSub.destroy();
    this._autoDismissSub.destroy();
    this._autoDismissTimer.destroy();
  }

  static showErrorSnackbar(matSnackbar: MatSnackBar, error: ErrorInput, config?: DbxErrorSnackbarConfig) {
    matSnackbar.openFromComponent(DbxErrorSnackbarComponent, {
      ...config,
      duration: undefined, // do pass duration to matSnackbar. Component will handle it.
      panelClass: [...(config?.panelClass ?? []), 'dbx-error-snackbar'], // add the snackbar error class
      data: {
        error,
        duration: config?.duration
      }
    });
  }

  errorPopoverOpen(popover: NgPopoverRef) {
    this._popoverOpen.next(true);
    this._popoverSub.subscription = popover.afterClosed$.subscribe(() => {
      this._popoverOpen.next(false);
    });
  }

  dismiss() {
    return this.snackBarRef.dismiss();
  }
}
