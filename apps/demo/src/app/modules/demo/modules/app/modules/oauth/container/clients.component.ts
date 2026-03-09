import { Component, signal } from '@angular/core';
import { DbxOAuthClientListComponent, DbxOAuthClientDetailComponent, type OAuthClient } from '@dereekb/dbx-firebase/oidc';
import { DbxSectionComponent, DbxContentBoxDirective } from '@dereekb/dbx-web';

/**
 * Demo container for OAuth client management.
 *
 * Displays a list of registered OAuth clients and allows
 * viewing details or revoking individual clients.
 */
@Component({
  templateUrl: './clients.component.html',
  standalone: true,
  imports: [DbxSectionComponent, DbxContentBoxDirective, DbxOAuthClientListComponent, DbxOAuthClientDetailComponent]
})
export class DemoOAuthClientsComponent {
  /**
   * Placeholder client list. In a real implementation this would
   * come from an API call.
   */
  readonly clients = signal<OAuthClient[]>([]);

  readonly selectedClient = signal<OAuthClient | null>(null);

  onSelectClient(client: OAuthClient): void {
    this.selectedClient.set(client);
  }

  onRevokeClient(client: OAuthClient): void {
    // TODO: call revocation API
    this.clients.update((list) => list.filter((c) => c.client_id !== client.client_id));
    this.selectedClient.set(null);
  }
}
