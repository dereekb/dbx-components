import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

// MARK: Types
export interface OAuthClient {
  readonly client_id: string;
  readonly client_name?: string;
  readonly redirect_uris: string[];
  readonly grant_types: string[];
  readonly created_at?: string;
}

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
  readonly clients = input<OAuthClient[]>([]);
  readonly selectClient = output<OAuthClient>();
}
