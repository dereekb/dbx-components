import { Directive, Inject, NgZone } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { AbstractTransitionWatcherDirective, DbNgxRouterTransitionService } from '@dereekb/ngx-core';

/**
 * Abstract dialog component that closes when a transition is successful.
 */
@Directive()
export abstract class AbstractDialogDirective<T = any, R = any> extends AbstractTransitionWatcherDirective {

  constructor(
    @Inject(MatDialogRef) public readonly dialogRef: MatDialogRef<T, R>,
    dbNgxRouterTransitionService: DbNgxRouterTransitionService,
    ngZone: NgZone) {
    super(dbNgxRouterTransitionService, ngZone);
  }

  protected updateForSuccessfulTransition(): void {
    this.dialogRef.close();
  }

}
