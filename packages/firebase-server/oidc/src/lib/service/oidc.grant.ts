import { type Grant } from 'oidc-provider';

/**
 * Splits a space-delimited scope string into its non-empty entries.
 *
 * @param scope - The space-delimited scope string.
 * @returns The scope entries.
 */
function splitScope(scope: string | undefined): string[] {
  return (scope ?? '').split(' ').filter(Boolean);
}

/**
 * Removes previously-rejected OIDC scopes from a Grant's rejected set.
 *
 * oidc-provider exposes `rejectOIDCScope()` but no inverse, and a rejected scope is subtracted from
 * `getOIDCScope()` on every read — so `addOIDCScope()` alone cannot put a once-rejected scope back in
 * force. `rejected` is plain persisted data (`Pick<Grant, 'openid' | 'resources'>`), which is what
 * makes editing it directly the supported shape of an un-reject.
 *
 * @param grant - The grant to edit in place.
 * @param scopes - The scopes to un-reject. Scopes not currently rejected are ignored.
 */
export function unrejectOIDCScopes(grant: Grant, scopes: Iterable<string>): void {
  const rejected = grant.rejected?.openid;

  if (rejected?.scope) {
    const remove = new Set(scopes);
    const remaining = splitScope(rejected.scope).filter((scope) => !remove.has(scope));
    rejected.scope = remaining.length > 0 ? remaining.join(' ') : undefined;
  }
}

/**
 * Removes previously-rejected OIDC claims from a Grant's rejected set.
 *
 * @param grant - The grant to edit in place.
 * @param claims - The claims to un-reject. Claims not currently rejected are ignored.
 * @see unrejectOIDCScopes
 */
export function unrejectOIDCClaims(grant: Grant, claims: Iterable<string>): void {
  const rejected = grant.rejected?.openid;

  if (rejected?.claims?.length) {
    const remove = new Set(claims);
    const remaining = rejected.claims.filter((claim) => !remove.has(claim));
    rejected.claims = remaining.length > 0 ? remaining : undefined;
  }
}

/**
 * Removes previously-rejected resource scopes for one resource indicator from a Grant's rejected set.
 *
 * @param grant - The grant to edit in place.
 * @param resource - The resource indicator.
 * @param scopes - The scopes to un-reject. Scopes not currently rejected for the resource are ignored.
 * @see unrejectOIDCScopes
 */
export function unrejectResourceScopes(grant: Grant, resource: string, scopes: Iterable<string>): void {
  const rejectedResources = grant.rejected?.resources;

  if (rejectedResources?.[resource]) {
    const remove = new Set(scopes);
    const remaining = splitScope(rejectedResources[resource]).filter((scope) => !remove.has(scope));

    if (remaining.length > 0) {
      rejectedResources[resource] = remaining.join(' ');
    } else {
      delete rejectedResources[resource];
    }
  }
}

/**
 * Input for {@link reconsiderRejectedValues}.
 */
export interface ReconsiderRejectedValuesInput {
  /**
   * Values oidc-provider reports as still undecided for this consent (e.g. `prompt.details.missingOIDCScope`).
   */
  readonly missing: readonly string[];
  /**
   * Values the existing Grant has already decided — granted or rejected.
   */
  readonly encountered: readonly string[];
  /**
   * The subset of `encountered` the existing Grant has REJECTED.
   */
  readonly rejected: readonly string[];
  /**
   * Values the current authorization request asks for. Only a rejected value the request names again is
   * reconsidered; a rejection from an earlier, wider request stays in force.
   */
  readonly requested: ReadonlySet<string>;
}

/**
 * Output of {@link reconsiderRejectedValues}.
 */
export interface ReconsiderRejectedValuesResult {
  /**
   * `missing` plus the reconsidered values, so a consent decides them again.
   */
  readonly missing: string[];
  /**
   * `encountered` minus the reconsidered values, so they are no longer treated as settled no-ops.
   */
  readonly encountered: string[];
  /**
   * The values moved from `encountered` back into `missing`: rejected on the Grant and named by the
   * current request. A consent that grants one of these must un-reject it on the Grant as well.
   */
  readonly reconsidered: string[];
}

/**
 * Moves previously-rejected values the current request asks for again from the "encountered" set back into
 * the "missing" set, so a re-consent decides them afresh.
 *
 * oidc-provider counts a rejected value as encountered: it never reappears in the prompt's `missing*`
 * details, so without this a consent that names it again is a silent no-op and the value can never be
 * granted on that Grant — even when the user explicitly ticks it. Values the Grant has GRANTED are left in
 * `encountered`: they are already in force and need no re-application.
 *
 * @param input - The missing, encountered, rejected, and requested sets.
 * @returns The adjusted missing/encountered sets plus the reconsidered values.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function reconsiderRejectedValues(input: ReconsiderRejectedValuesInput): ReconsiderRejectedValuesResult {
  const { missing, encountered, rejected, requested } = input;
  const missingSet = new Set(missing);
  const reconsidered = rejected.filter((value) => requested.has(value) && !missingSet.has(value));
  const reconsideredSet = new Set(reconsidered);

  return {
    missing: [...missing, ...reconsidered],
    encountered: encountered.filter((value) => !reconsideredSet.has(value)),
    reconsidered
  };
}

/**
 * Names every claim an authorization request's `claims` parameter asks for, across `id_token` and `userinfo`.
 *
 * @param claimsParam - The raw `claims` request parameter (a JSON string), or undefined.
 * @returns The requested claim names; empty when the parameter is absent or malformed.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function requestedOIDCClaimNames(claimsParam: unknown): Set<string> {
  const names = new Set<string>();

  if (typeof claimsParam === 'string' && claimsParam.length > 0) {
    let parsed: unknown;

    try {
      parsed = JSON.parse(claimsParam);
    } catch {
      parsed = undefined;
    }

    if (parsed != null && typeof parsed === 'object') {
      for (const key of ['id_token', 'userinfo']) {
        const section = (parsed as Record<string, unknown>)[key];

        if (section != null && typeof section === 'object') {
          for (const claim of Object.keys(section as object)) {
            names.add(claim);
          }
        }
      }
    }
  }

  return names;
}

/**
 * Normalizes an authorization request's `resource` parameter to its list of resource indicators.
 *
 * @param resourceParam - The raw `resource` request parameter (a string, an array of strings, or undefined).
 * @returns The resource indicators; empty when the parameter is absent.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function requestedResourceIndicators(resourceParam: unknown): string[] {
  let indicators: string[];

  if (typeof resourceParam === 'string') {
    indicators = [resourceParam];
  } else if (Array.isArray(resourceParam)) {
    indicators = resourceParam.filter((value): value is string => typeof value === 'string');
  } else {
    indicators = [];
  }

  return indicators;
}
