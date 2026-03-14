import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { type OAuthConsentScope } from './oauth.consent.scope';

/**
 * Standalone presentational component that renders a list of OAuth consent scopes.
 *
 * @example
 * ```html
 * <dbx-firebase-oauth-consent-scope-list [scopes]="mappedScopes"></dbx-firebase-oauth-consent-scope-list>
 * ```
 */
@Component({
  selector: 'dbx-firebase-oauth-consent-scope-list',
  standalone: true,
  styleUrls: ['./oauth.consent.scope.list.component.scss'],
  template: `
    @for (scope of scopes(); track scope.name) {
      <div class="dbx-firebase-oauth-consent-scope-list-item dbx-mb2">
        <span class="dbx-firebase-oauth-consent-scope-name dbx-pb2">{{ scope.name }}</span>
        @if (scope.description) {
          <span class="dbx-firebase-oauth-consent-scope-description">{{ scope.description }}</span>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseOAuthConsentScopeListComponent {
  readonly scopes = input<OAuthConsentScope[]>([]);
}
