import { ChangeDetectionStrategy, Component, inject, OnInit, OnDestroy } from '@angular/core';
import { MAT_SNACK_BAR_DATA, MatSnackBar, MatSnackBarConfig, MatSnackBarRef } from '@angular/material/snack-bar';
import { ErrorInput, MS_IN_MINUTE, makeTimer, toggleTimerRunning } from '@dereekb/util';
import { NgPopoverRef } from 'ng-overlay-container';
import { signal, effect } from '@angular/core';
import { DbxErrorViewComponent } from './error.view.component';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { from } from 'rxjs';
import { DbxErrorComponent } from './error.component';
import { SubscriptionObject } from '@dereekb/rxjs';

export type DbxErrorSnackbarConfig = Omit<MatSnackBarConfig<any>, 'data' | 'viewContainerRef'>;

export interface DbxErrorSnackbarData<T extends ErrorInput = ErrorInput> {
  readonly error: T;
  readonly duration?: number;
}

@Component({
  selector: 'dbx-error-snackbar',
  template: `
    <div class="dbx-error-snackbar-content">
      <dbx-error [error]="error" (popoverOpened)="onPopoverOpened($event)"></dbx-error>
      <div class="dbx-spacer"></div>
      <button class="dbx-error-snackbar-content-button" mat-icon-button aria-label="dismiss error" (click)="dismiss()">
        <mat-icon>close</mat-icon>
      </button>
    </div>
  `,
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, DbxErrorViewComponent, DbxErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxErrorSnackbarComponent implements OnInit, OnDestroy {
  readonly snackBarRef = inject(MatSnackBarRef<DbxErrorSnackbarComponent>);
  readonly data = inject<DbxErrorSnackbarData>(MAT_SNACK_BAR_DATA);

  readonly error = this.data.error;
  private readonly _popoverOpen = signal(false);

  private readonly _timer = makeTimer(this.data.duration ?? MS_IN_MINUTE, Boolean(this.data.duration));
  private readonly _allowAutoDismiss = this.data.duration != null;

  protected readonly _popoverSyncEffect = effect(() => toggleTimerRunning(this._timer, !this._popoverOpen()));

  private readonly _popoverAfterClosedSub = new SubscriptionObject();
  private readonly _autoDismissSub = new SubscriptionObject();

  ngOnInit(): void {
    if (this._allowAutoDismiss) {
      this._autoDismissSub.subscription = from(this._timer.promise).subscribe(() => this.dismiss());
    } else {
      this._popoverSyncEffect.destroy();
    }
  }

  ngOnDestroy(): void {
    this._autoDismissSub.destroy();
    this._timer.destroy();
  }

  onPopoverOpened(popover: NgPopoverRef) {
    this._popoverOpen.set(true);
    this._popoverAfterClosedSub.subscription = popover.afterClosed$.subscribe(() => this._popoverOpen.set(false));
  }

  dismiss() {
    this.snackBarRef.dismiss();
  }

  static showErrorSnackbar(matSnackbar: MatSnackBar, error: ErrorInput, config?: DbxErrorSnackbarConfig) {
    matSnackbar.openFromComponent(DbxErrorSnackbarComponent, {
      ...config,
      duration: undefined,
      panelClass: [...(config?.panelClass ?? []), 'dbx-error-snackbar'],
      data: {
        error,
        duration: config?.duration
      }
    });
  }
}
