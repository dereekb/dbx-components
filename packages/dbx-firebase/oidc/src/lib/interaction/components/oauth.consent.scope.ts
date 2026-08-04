import { type OidcScope } from '@dereekb/firebase';

export interface OAuthConsentScope<T extends OidcScope = OidcScope> {
  readonly name: T;
  readonly description: string;
  /**
   * Whether the scope is always granted and cannot be deselected. Required scopes still render as
   * rows in the consent list — selected and disabled — so their description stays visible, but the
   * server enforces them regardless of the submitted payload.
   */
  readonly required?: boolean;
}
