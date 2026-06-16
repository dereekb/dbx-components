import { Injectable, inject } from '@angular/core';
import { createEffect } from '@ngrx/effects';
import { map } from 'rxjs';
import { authUserIdentifier } from '../../auth.user';
import { DbxAuthImpersonationService } from '../../impersonation/impersonation.service';
import { onDbxAppAuth } from '../';

/**
 * NgRx effects class that bridges {@link DbxAuthImpersonationService.events$} into the `app.auth` impersonation slice.
 *
 * One-directional service → store, mirroring {@link DbxAppAuthEffects}. Registered only when an app opts in via
 * `provideDbxAuthImpersonation({ ngrx: true })`, so the slice stays empty unless impersonation is actually enabled.
 *
 * @see {@link DbxAuthImpersonationService}
 * @see {@link DbxAppAuthImpersonationActions}
 */
@Injectable()
export class DbxAppAuthImpersonationEffects {
  private readonly dbxAuthImpersonationService = inject(DbxAuthImpersonationService);

  /**
   * Dispatches the started/stopped impersonation action for each lifecycle event emitted by the service.
   */
  readonly syncImpersonationState = createEffect(() => this.dbxAuthImpersonationService.events$.pipe(map((event) => (event.type === 'start' ? onDbxAppAuth.DbxAppAuthImpersonationActions.startedImpersonating({ userId: authUserIdentifier(event.impersonatedUserId), previousUserId: event.previousImpersonatedUserId }) : onDbxAppAuth.DbxAppAuthImpersonationActions.stoppedImpersonating({ previousUserId: event.previousImpersonatedUserId })))));
}
