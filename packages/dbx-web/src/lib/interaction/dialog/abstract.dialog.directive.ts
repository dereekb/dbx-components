import { Directive, Inject, NgZone, Optional } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AbstractTransitionWatcherDirective, DbxRouterTransitionService } from '@dereekb/dbx-core';

/**
 * Abstract dialog component that closes when a transition is successful.
 */
@Directive()
export abstract class AbstractDialogDirective<R = any, D = any, T = any> extends AbstractTransitionWatcherDirective {

  constructor(
    @Optional() @Inject(MAT_DIALOG_DATA) readonly data: D,
    @Inject(MatDialogRef) readonly dialogRef: MatDialogRef<T, R>,
    dbNgxRouterTransitionService: DbxRouterTransitionService,
    ngZone: NgZone) {
    super(dbNgxRouterTransitionService, ngZone);
  }

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
