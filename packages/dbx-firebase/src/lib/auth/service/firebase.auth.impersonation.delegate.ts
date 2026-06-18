import { Injectable, inject } from '@angular/core';
import { type AuthUserIdentifier, DbxAuthImpersonationDelegate, type DbxAuthImpersonationDetails } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { type Observable } from 'rxjs';
import { DbxFirebaseAuthService } from './firebase.auth.service';

/**
 * {@link DbxAuthImpersonationDelegate} implementation that loads details via the configured
 * {@link DbxFirebaseAuthServiceDelegate.loadImpersonationAuthDetails}.
 *
 * Registered for an app by {@link provideDbxFirebaseAuthImpersonation}.
 */
@Injectable()
export class DbxFirebaseAuthImpersonationDelegate extends DbxAuthImpersonationDelegate {
  private readonly _dbxFirebaseAuthService = inject(DbxFirebaseAuthService);

  loadImpersonationDetails(userId: AuthUserIdentifier): Observable<Maybe<DbxAuthImpersonationDetails>> {
    return this._dbxFirebaseAuthService.loadImpersonationAuthDetails(userId);
  }
}
