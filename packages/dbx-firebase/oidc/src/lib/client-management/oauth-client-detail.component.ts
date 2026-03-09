import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { type OAuthClient } from './oauth-client-list.component';

/**
 * Component that displays details of a single OAuth client.
 * Provides a revoke action.
 */
@Component({
  selector: 'dbx-oauth-client-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dbx-oauth-client-detail">
      @if (client(); as c) {
        <h3>{{ c.client_name || 'OAuth Client' }}</h3>
        <dl>
          <dt>Client ID</dt>
          <dd>{{ c.client_id }}</dd>
          <dt>Redirect URIs</dt>
          <dd>
            @for (uri of c.redirect_uris; track uri) {
              <div>{{ uri }}</div>
            }
          </dd>
          <dt>Grant Types</dt>
          <dd>{{ c.grant_types.join(', ') }}</dd>
          @if (c.created_at) {
            <dt>Created</dt>
            <dd>{{ c.created_at }}</dd>
          }
        </dl>
        <button (click)="revoke.emit(c)">Revoke Client</button>
      }
    </div>
  `,
  host: {
    class: 'd-block dbx-oauth-client-detail'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxOAuthClientDetailComponent {
  readonly client = input<OAuthClient | null>(null);
  readonly revoke = output<OAuthClient>();
}
