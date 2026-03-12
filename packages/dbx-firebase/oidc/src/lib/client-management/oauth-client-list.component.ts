import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { type OidcEntryOAuthClientPayloadData } from '@dereekb/firebase';

/**
 * Component that displays a list of registered OAuth clients.
 */
@Component({
  selector: 'dbx-oauth-client-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dbx-oauth-client-list">
      @if (clients().length === 0) {
        <p>No registered clients.</p>
      }
      @for (client of clients(); track client.client_id) {
        <div class="dbx-oauth-client-item" (click)="selectClient.emit(client)">
          <div class="dbx-oauth-client-name">{{ client.client_name || client.client_id }}</div>
          <div class="dbx-oauth-client-id">{{ client.client_id }}</div>
        </div>
      }
    </div>
  `,
  host: {
    class: 'd-block dbx-oauth-client-list'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxOAuthClientListComponent {
  readonly clients = input<OidcEntryOAuthClientPayloadData[]>([]);
  readonly selectClient = output<OidcEntryOAuthClientPayloadData>();
}
