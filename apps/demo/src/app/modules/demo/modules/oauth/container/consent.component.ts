import { Component, inject } from '@angular/core';
import { Transition } from '@uirouter/angular';
import { DbxOAuthConsentComponent } from '@dereekb/dbx-firebase/oidc';
import { DbxContentBoxDirective } from '@dereekb/dbx-web';

/**
 * Demo container component for the OIDC consent interaction.
 *
 * Receives the interaction UID, client name, and requested scopes from
 * query params (populated by the server redirect) and passes them to
 * the `DbxOAuthConsentComponent`.
 */
@Component({
  template: `
    <dbx-content-box>
      <dbx-oauth-consent [interactionUid]="uid" [clientName]="clientName" [scopes]="scopes"></dbx-oauth-consent>
    </dbx-content-box>
  `,
  standalone: true,
  imports: [DbxContentBoxDirective, DbxOAuthConsentComponent]
})
export class DemoOAuthConsentComponent {
  private readonly transition = inject(Transition);

  get uid(): string {
    return this.transition.params()['uid'] ?? '';
  }

  get clientName(): string {
    return this.transition.params()['client_name'] ?? '';
  }

  get scopes(): { name: string; description: string }[] {
    const scopeStr: string = this.transition.params()['scopes'] ?? '';

    if (!scopeStr) {
      return [];
    }

    return scopeStr.split(' ').map((name: string) => ({
      name,
      description: ''
    }));
  }
}
