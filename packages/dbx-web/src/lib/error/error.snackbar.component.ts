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

export type DbxErrorSnackbarConfig = Omit<MatSnackBarConfig<any>, 'data' | 'viewContainerRef'>;

export interface DbxErrorSnackbarData<T extends ErrorInput = ErrorInput> {
  readonly error: T;
  readonly duration?: number;
}

@Component({
  selector: 'dbx-error-snackbar',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, DbxErrorViewComponent, DbxErrorComponent],
  template: `
    <div class="dbx-error-snackbar-content">
      <dbx-error [error]="error" (popoverOpened)="onPopoverOpened($event)"></dbx-error>
      <div class="dbx-spacer"></div>
      <button class="dbx-error-snackbar-content-button" mat-icon-button aria-label="dismiss error" (click)="dismiss()">
        <mat-icon>close</mat-icon>
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxErrorSnackbarComponent implements OnInit, OnDestroy {
  readonly snackBarRef = inject(MatSnackBarRef<DbxErrorSnackbarComponent>);
  readonly data = inject<DbxErrorSnackbarData>(MAT_SNACK_BAR_DATA);

  readonly error = this.data.error;
  private readonly _popoverOpen = signal(false);

  private readonly _timer = makeTimer(this.data.duration ?? MS_IN_MINUTE, Boolean(this.data.duration));
  private readonly _allowAutoDismiss = Boolean(this.data.duration);

  private readonly _popoverSyncEffect = effect(() => {
    toggleTimerRunning(this._timer, !this._popoverOpen());
  });

  private readonly _autoDismissEffect = from(this._timer.promise).subscribe(() => this.dismiss());

  ngOnInit(): void {
    if (!this._allowAutoDismiss) {
      this._popoverSyncEffect.destroy();
      this._autoDismissEffect.unsubscribe();
    }
  }

  ngOnDestroy(): void {
    this._autoDismissEffect.unsubscribe();
    this._timer.destroy();
  }

  onPopoverOpened(popover: NgPopoverRef) {
    this._popoverOpen.set(true);
    popover.afterClosed$.subscribe(() => this._popoverOpen.set(false));
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
