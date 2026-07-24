import { type Maybe } from '@dereekb/util';
import { type FirestoreModelType, type OidcModelScopeRequirement, type OidcScope, type OidcScopeTerm, type OnCallFunctionType, CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE, callModelOidcScopeForCallType, oidcScopeTermSatisfied, oidcScopeTermsSatisfied, oidcScopesFromScopeClaim, resolveEffectiveOidcScopeTerms } from '@dereekb/firebase';
import { forbiddenError } from '../../../function/error';
import { type FirebaseServerAuthData } from '../auth.context.server';

// MARK: Config
/**
 * OIDC scope-grouping configuration for the model-api layer, mixed into {@link ModelApiDispatchConfig}
 * and read by both {@link ModelApiCallModelDispatchService} and {@link ModelApiGetService}.
 *
 * This is the model-api-layer home for the callModel group-scope requirements. Providing them here
 * enforces them uniformly across ALL three `ModelApiController` access patterns — path/direct
 * dispatch AND the `/get` direct reads — and
 * (via the MCP server routing through the same services) the MCP surface, without riding the shared
 * callModel function that also serves the app's first-party Firebase `onCall` path.
 *
 * With NEITHER field supplied, enforcement is byte-for-byte the pre-grouping behavior: an OIDC caller
 * still needs the per-verb `model.<call>` scope (plus any per-function `requiredScope` on dispatch),
 * and non-OIDC callers bypass entirely.
 */
export interface ModelApiOidcScopeConfig {
  /**
   * Group term required on EVERY model-api op unless a finer term overrides it (a per-function
   * `requiredScope`, then a {@link ModelApiOidcScopeConfig.modelRequiredScopes} entry). Lets an app
   * require e.g. `'hellosubs'` across all models without editing individual handlers. Set this to the
   * SAME value passed to the MCP `McpModuleConfig.defaultRequiredScope` so tool listing == callability.
   */
  readonly defaultRequiredScope?: OidcScopeTerm;
  /**
   * Per-model group-term overrides keyed by {@link FirestoreModelType}. The ONLY place a plain `/get`
   * read (which has no per-function handler) can be scope-gated beyond the per-verb `model.read` scope.
   * A verb-keyed entry can require different terms per verb (e.g. `lms` reads, `hellosubs` writes). Set
   * this to the SAME value passed to the MCP `McpModuleConfig.modelRequiredScopes` so tool listing ==
   * callability.
   */
  readonly modelRequiredScopes?: Record<FirestoreModelType, OidcModelScopeRequirement>;
}

// MARK: Scope Reading
/**
 * Reads the set of OIDC scopes carried by a model-api request's auth, or `undefined` for a non-OIDC
 * (regular Firebase ID-token) caller.
 *
 * The OIDC bearer-token middleware attaches the validated access-token claims at
 * `auth.oidcValidatedToken` (with the space-delimited `scope` string); a non-OIDC caller has neither
 * that field nor a `scope` on `auth.token`. Reading is defensive (the auth shape is only typed as
 * {@link FirebaseServerAuthData} here — the OIDC-specific `oidcValidatedToken` lives in the
 * `@dereekb/firebase-server/oidc` sub-package this core layer cannot import), delegating the actual
 * parse to the shared {@link oidcScopesFromScopeClaim} so there is no drift with `getOidcScopesFromRequest`.
 *
 * @param auth - The request auth data, or undefined for unauthenticated requests.
 * @returns The granted scope set, or `undefined` when the request carries no OIDC `scope` claim.
 */
export function oidcScopesFromModelApiAuth(auth: Maybe<FirebaseServerAuthData>): Maybe<Set<OidcScope>> {
  const oidcScope = (auth as Maybe<{ oidcValidatedToken?: { scope?: unknown } }>)?.oidcValidatedToken?.scope;
  const tokenScope = (auth as Maybe<{ token?: { scope?: unknown } }>)?.token?.scope;
  const scope = oidcScope ?? tokenScope;
  return oidcScopesFromScopeClaim(scope);
}

// MARK: Enforcement
/**
 * Inputs to {@link assertModelApiOidcScope}.
 *
 * Standalone (not extending {@link ModelApiOidcScopeConfig}) because the group fields here receive the
 * services' stored config values, which are {@link Maybe} (nullable) — matching the shipped
 * `ResolveEffectiveOidcScopeTermsInput` — whereas the config surface exposes them as plain optionals.
 */
export interface AssertModelApiOidcScopeInput {
  /**
   * The call verb being enforced (e.g. `create`, `read`). `/get` direct reads pass `'read'`.
   */
  readonly call: OnCallFunctionType;
  /**
   * The Firestore model type being targeted.
   */
  readonly modelType: FirestoreModelType;
  /**
   * The per-function `requiredScope` declared via `withApiDetails`, if resolvable (dispatch only — a
   * plain `/get` read has no per-function handler). The finest (highest-precedence) group term.
   */
  readonly requiredScope?: Maybe<OidcScopeTerm>;
  /**
   * The module-level default group term (see {@link ModelApiOidcScopeConfig.defaultRequiredScope}).
   */
  readonly defaultRequiredScope?: Maybe<OidcScopeTerm>;
  /**
   * The per-model group-term overrides (see {@link ModelApiOidcScopeConfig.modelRequiredScopes}).
   */
  readonly modelRequiredScopes?: Maybe<Record<FirestoreModelType, OidcModelScopeRequirement>>;
  /**
   * The scopes the caller was granted, or `undefined` for a non-OIDC caller (bypasses enforcement).
   */
  readonly grantedScopes: Maybe<ReadonlySet<OidcScope>>;
}

/**
 * Enforces the OIDC scope requirement for a single model-api op, throwing a `403`
 * {@link CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE} error when the caller does not satisfy it.
 *
 * The single home of callModel OIDC scope enforcement. It reuses the shipped composition + evaluation
 * (`resolveEffectiveOidcScopeTerms` / `oidcScopeTermsSatisfied`) so enforcement and the MCP
 * tool-visibility filter never drift. Enforcement is AND-of-ORs across the per-verb `model.<call>`
 * scope and the effective GROUP term (per-function `requiredScope` > per-model requirement >
 * configured default).
 *
 * Bypasses (no-op) when `grantedScopes` is `undefined` — i.e. a non-OIDC caller — and short-circuits
 * without any check when the op resolves no requirement at all (a custom, non-CRUD verb with no
 * per-function/model/default term).
 *
 * @param input - The verb, model type, per-function scope, group config, and the caller's granted scopes.
 * @throws A `403` forbidden error (code {@link CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE}) when an OIDC
 *   caller does not satisfy the effective requirement.
 */
export function assertModelApiOidcScope(input: AssertModelApiOidcScopeInput): void {
  const { call, modelType, requiredScope, defaultRequiredScope, modelRequiredScopes, grantedScopes } = input;

  const terms = resolveEffectiveOidcScopeTerms({
    perVerbScope: callModelOidcScopeForCallType(call),
    requiredScope,
    modelRequirement: modelRequiredScopes?.[modelType],
    call,
    defaultRequiredScope
  });

  if (terms.length > 0 && grantedScopes != null && !oidcScopeTermsSatisfied(terms, grantedScopes)) {
    const missingTerms = terms.filter((term) => !oidcScopeTermSatisfied(term, grantedScopes));
    throw forbiddenError({
      status: 403,
      code: CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE,
      message: `Missing required OIDC scope for callModel: ${missingTerms.map(formatModelApiScopeTerm).join(', ')}`,
      data: { requiredScopes: missingTerms, call }
    });
  }
}

/**
 * Renders a scope term for the human-readable error message: a single scope as-is, an OR-group as its
 * alternatives joined by `|` (so a single-scope term reads as itself).
 *
 * @param term - The unsatisfied scope term.
 * @returns The display string for the term.
 */
function formatModelApiScopeTerm(term: OidcScopeTerm): string {
  return typeof term === 'string' ? term : term.join('|');
}
