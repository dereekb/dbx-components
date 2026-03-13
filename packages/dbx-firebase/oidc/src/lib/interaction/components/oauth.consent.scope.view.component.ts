import { computed, inject } from '@angular/core';
import { DBX_INJECTION_COMPONENT_DATA } from '@dereekb/dbx-core';
import { type OidcScope } from '@dereekb/firebase';

/**
 * Data provided to consent scope view components via the `DBX_INJECTION_COMPONENT_DATA` token.
 *
 * Contains the scopes being requested and contextual information about the consent interaction.
 */
export interface DbxFirebaseOAuthConsentScopesViewData {
  readonly scopes: OidcScope[];
  readonly clientName: string;
}

/**
 * Abstract base class for consent scope view components.
 *
 * Provides typed access to the `DbxFirebaseOAuthConsentScopesViewData` injected
 * via `DBX_INJECTION_COMPONENT_DATA`. Subclasses only need to define a template.
 *
 * @example
 * ```typescript
 * @Component({ template: `...` })
 * export class MyCustomScopesViewComponent extends AbstractDbxFirebaseOAuthConsentScopeViewComponent {}
 * ```
 */
export abstract class AbstractDbxFirebaseOAuthConsentScopeViewComponent {
  private readonly data = inject<DbxFirebaseOAuthConsentScopesViewData>(DBX_INJECTION_COMPONENT_DATA);

  readonly scopes = computed(() => this.data?.scopes ?? []);
  readonly clientName = computed(() => this.data?.clientName ?? '');
}
