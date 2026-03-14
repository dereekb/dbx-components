import { type OidcScope } from '@dereekb/firebase';

export interface OAuthConsentScope<T extends OidcScope = OidcScope> {
  readonly name: T;
  readonly description: string;
}
