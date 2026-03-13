import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Transition } from '@uirouter/angular';
import { DbxFirebaseAuthService, DbxFirebaseLoginComponent, DbxFirebaseLoginTermsComponent, DbxFirebaseRegisterComponent } from '@dereekb/dbx-firebase';
import { DbxFirebaseOAuthLoginComponent, DbxFirebaseOidcInteractionService } from '@dereekb/dbx-firebase/oidc';
import { DbxContentBoxDirective } from '@dereekb/dbx-web';
import { DbxLinkComponent } from '@dereekb/dbx-web';
import { filter, first, switchMap, Subscription } from 'rxjs';

/**
 * Demo container component for the OIDC login interaction.
 *
 * When the user arrives (redirected from the OIDC provider), this component:
 * 1. If already authenticated — immediately retrieves the Firebase ID token and submits it.
 * 2. If not authenticated — shows the Firebase Auth login UI.
 * 3. After successful sign-in — retrieves the ID token and submits it.
 *
 * The server responds with a redirect to complete the OIDC flow.
 */
@Component({
  template: `
    <dbx-content-box>
      <dbx-firebase-oauth-login></dbx-firebase-oauth-login>
    </dbx-content-box>
  `,
  standalone: true,
  imports: [DbxContentBoxDirective, DbxFirebaseOAuthLoginComponent]
})
export class DemoOAuthLoginComponent {}
