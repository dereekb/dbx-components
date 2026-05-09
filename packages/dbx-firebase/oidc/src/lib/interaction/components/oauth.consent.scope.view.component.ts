import { computed, inject } from '@angular/core';
import { DBX_INJECTION_COMPONENT_DATA } from '@dereekb/dbx-core';
import { type OAuthInteractionLoginDetails, type OidcScope } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';

/**
 * Data provided to consent scope view components via the
 * `DBX_INJECTION_COMPONENT_DATA` token.
 *
 * Carries the requested scopes plus surrounding interaction context. The
 * form value (current granted scopes) is no longer carried here — the
 * scope view's form is wired up via `dbxActionForm` to the parent's
 * `dbxAction`, so the value pipeline runs through the action store at
 * trigger time.
 */
export interface DbxFirebaseOAuthConsentScopesViewData {
  readonly details?: Maybe<OAuthInteractionLoginDetails>;
  readonly scopes: OidcScope[];
  readonly clientName: string;
  /**
   * Scopes that must always be granted. Surfaced separately so the scope
   * view can render them as a static "Always granted" hint instead of
   * making them user-selectable.
   */
  readonly requiredScopes?: readonly OidcScope[];
}

/**
 * Abstract base class for consent scope view components.
 *
 * Provides typed access to the `DbxFirebaseOAuthConsentScopesViewData`
 * injected via `DBX_INJECTION_COMPONENT_DATA`. Subclasses define the
 * template that renders the requested scopes and (optionally) hosts a
 * forge form decorated with `dbxActionForm`.
 *
 * @example
 * ```typescript
 * @Component({ template: `...` })
 * export class MyCustomScopesViewComponent extends AbstractDbxFirebaseOAuthConsentScopeViewComponent {}
 * ```
 */
export abstract class AbstractDbxFirebaseOAuthConsentScopeViewComponent {
  private readonly data = inject<DbxFirebaseOAuthConsentScopesViewData>(DBX_INJECTION_COMPONENT_DATA);

  readonly details = computed(() => this.data?.details);
  readonly scopes = computed(() => this.data?.scopes ?? []);
  readonly clientName = computed(() => this.data?.clientName ?? '');
  readonly clientUri = computed(() => this.data?.details?.client_uri);
  readonly logoUri = computed(() => this.data?.details?.logo_uri);

  readonly requiredScopes = computed<readonly OidcScope[]>(() => this.data?.requiredScopes ?? []);

  isScopeRequired(scope: OidcScope): boolean {
    return this.requiredScopes().includes(scope);
  }
}
