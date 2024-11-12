import { Directive, inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AbstractTransitionWatcherDirective } from '@dereekb/dbx-core';

/**
 * Abstract dialog component that closes when a transition is successful.
 */
@Directive()
export abstract class AbstractDialogDirective<R = unknown, D = unknown, T = unknown> extends AbstractTransitionWatcherDirective {
  readonly data: D = inject(MAT_DIALOG_DATA, { optional: true });
  readonly dialogRef = inject(MatDialogRef<T, R>);

  protected updateForSuccessfulTransition(): void {
    this.close();
  }

  returnValue(value?: R) {
    this.close(value);
  }

  close(value?: R) {
    this.dialogRef.close(value);
  }
}
