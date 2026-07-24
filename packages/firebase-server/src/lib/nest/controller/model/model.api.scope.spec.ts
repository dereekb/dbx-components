import { type Maybe } from '@dereekb/util';
import { CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE, type OidcModelScopeRequirement, type OidcScope, type OidcScopeTerm, type OnCallFunctionType, oidcScopesFromScopeClaim } from '@dereekb/firebase';
import { assertModelApiOidcScope, oidcScopesFromModelApiAuth } from './model.api.scope';

// MARK: Helpers
function codeOfThrown(fn: () => void): string | undefined {
  let caught: any;

  try {
    fn();
  } catch (e) {
    caught = e;
  }

  const details = caught?.details ?? caught?.errorInfo?.details ?? caught;
  return details?.code ?? caught?.code;
}

interface RunScopeAssertInput {
  readonly call: OnCallFunctionType;
  readonly scope?: string; // undefined => non-OIDC caller (no scope claim)
  readonly modelType?: string;
  readonly requiredScope?: OidcScopeTerm;
  readonly defaultRequiredScope?: OidcScopeTerm;
  readonly modelRequiredScopes?: Record<string, OidcModelScopeRequirement>;
}

function runScopeAssert(input: RunScopeAssertInput): void {
  const grantedScopes: Maybe<Set<OidcScope>> = oidcScopesFromScopeClaim(input.scope);
  assertModelApiOidcScope({
    call: input.call,
    modelType: input.modelType ?? 'guestbook',
    requiredScope: input.requiredScope,
    defaultRequiredScope: input.defaultRequiredScope,
    modelRequiredScopes: input.modelRequiredScopes,
    grantedScopes
  });
}

// MARK: oidcScopesFromModelApiAuth
describe('oidcScopesFromModelApiAuth()', () => {
  it('returns undefined for an unauthenticated (undefined) auth', () => {
    expect(oidcScopesFromModelApiAuth(undefined)).toBeUndefined();
  });

  it('returns undefined for a non-OIDC caller (no scope claim anywhere)', () => {
    expect(oidcScopesFromModelApiAuth({ uid: 'u', token: {} } as any)).toBeUndefined();
  });

  it('reads the scope set from the OIDC-validated token (middleware shape)', () => {
    const scopes = oidcScopesFromModelApiAuth({ uid: 'u', oidcValidatedToken: { sub: 'u', scope: 'openid model.read lms' } } as any);
    expect(scopes).toEqual(new Set(['openid', 'model.read', 'lms']));
  });

  it('falls back to a scope on auth.token when there is no oidcValidatedToken', () => {
    const scopes = oidcScopesFromModelApiAuth({ uid: 'u', token: { scope: 'openid model.create' } } as any);
    expect(scopes).toEqual(new Set(['openid', 'model.create']));
  });

  it('returns an empty Set (not undefined) for an OIDC caller granted zero scopes', () => {
    const scopes = oidcScopesFromModelApiAuth({ uid: 'u', oidcValidatedToken: { sub: 'u', scope: '' } } as any);
    expect(scopes).toBeDefined();
    expect(scopes!.size).toBe(0);
  });
});

// MARK: assertModelApiOidcScope — back-compat (per-verb, no config)
describe('assertModelApiOidcScope() — per-verb enforcement (no config)', () => {
  const KNOWN: ReadonlyArray<OnCallFunctionType> = ['create', 'read', 'update', 'delete', 'query', 'invoke'];
  const SCOPE_FOR: Record<string, string> = { create: 'model.create', read: 'model.read', update: 'model.update', delete: 'model.delete', query: 'model.query', invoke: 'model.invoke' };

  it('bypasses a non-OIDC caller for every verb', () => {
    KNOWN.forEach((call) => expect(() => runScopeAssert({ call })).not.toThrow());
  });

  it('passes when the caller holds the matching model.<verb> scope', () => {
    KNOWN.forEach((call) => expect(() => runScopeAssert({ call, scope: `openid ${SCOPE_FOR[call]}` })).not.toThrow());
  });

  it('rejects with CALL_MODEL_MISSING_OIDC_SCOPE when the per-verb scope is absent', () => {
    KNOWN.forEach((call) => {
      const other = call === 'create' ? 'model.read' : 'model.create';
      expect(codeOfThrown(() => runScopeAssert({ call, scope: `openid ${other}` }))).toBe(CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE);
    });
  });

  it('rejects an OIDC caller granted zero scopes', () => {
    expect(codeOfThrown(() => runScopeAssert({ call: 'create', scope: '' }))).toBe(CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE);
  });

  it('short-circuits a custom (non-CRUD) verb with no requirement — bypasses even an OIDC caller', () => {
    expect(() => runScopeAssert({ call: 'archive', scope: 'openid' })).not.toThrow();
  });
});

// MARK: assertModelApiOidcScope — per-function requiredScope
describe('assertModelApiOidcScope() — per-function requiredScope (AND, finest wins)', () => {
  it('passes when the caller holds both the per-verb and the per-function scope', () => {
    expect(() => runScopeAssert({ call: 'create', scope: 'openid model.create lms', requiredScope: 'lms' })).not.toThrow();
  });

  it('rejects when the per-function scope is missing (per-verb present)', () => {
    expect(codeOfThrown(() => runScopeAssert({ call: 'create', scope: 'openid model.create', requiredScope: 'lms' }))).toBe(CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE);
  });

  it('is additive: rejects when the per-verb scope is missing even though the per-function scope is present', () => {
    expect(codeOfThrown(() => runScopeAssert({ call: 'create', scope: 'openid lms', requiredScope: 'lms' }))).toBe(CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE);
  });

  it('OR-group per-function term passes when ANY alternative is held', () => {
    expect(() => runScopeAssert({ call: 'create', scope: 'openid model.create lms', requiredScope: ['hellosubs', 'lms'] })).not.toThrow();
    expect(codeOfThrown(() => runScopeAssert({ call: 'create', scope: 'openid model.create', requiredScope: ['hellosubs', 'lms'] }))).toBe(CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE);
  });
});

// MARK: assertModelApiOidcScope — default + model-map
describe('assertModelApiOidcScope() — default + model-level requirements', () => {
  const config = {
    defaultRequiredScope: 'hellosubs' as OidcScopeTerm,
    modelRequiredScopes: {
      workerAcademyProgress: ['hellosubs', 'lms'],
      worker: { read: ['hellosubs', 'lms'], default: 'hellosubs' }
    } as Record<string, OidcModelScopeRequirement>
  };

  function run(call: OnCallFunctionType, scope: string, modelType: string): void {
    runScopeAssert({ call, scope, modelType, ...config });
  }

  it('applies the default group scope to an untagged model', () => {
    expect(() => run('create', 'openid model.create hellosubs', 'guestbook')).not.toThrow();
    expect(codeOfThrown(() => run('create', 'openid model.create lms', 'guestbook'))).toBe(CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE);
  });

  it('OR-group model requirement is satisfied by ANY alternative', () => {
    expect(() => run('create', 'openid model.create lms', 'workerAcademyProgress')).not.toThrow();
    expect(() => run('create', 'openid model.create hellosubs', 'workerAcademyProgress')).not.toThrow();
    expect(codeOfThrown(() => run('create', 'openid model.create', 'workerAcademyProgress'))).toBe(CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE);
  });

  it('verb-keyed requirement resolves per verb (lms reads, hellosubs writes)', () => {
    expect(() => run('read', 'openid model.read lms', 'worker')).not.toThrow();
    expect(codeOfThrown(() => run('create', 'openid model.create lms', 'worker'))).toBe(CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE);
    expect(() => run('create', 'openid model.create hellosubs', 'worker')).not.toThrow();
  });

  it('lists the unsatisfied OR-group in the thrown error data', () => {
    let caught: any;

    try {
      run('create', 'openid model.create', 'workerAcademyProgress');
    } catch (e) {
      caught = e;
    }

    const details = caught?.details ?? caught?.errorInfo?.details ?? caught;
    expect(details?.data?.requiredScopes).toEqual([['hellosubs', 'lms']]);
  });

  it('bypasses a non-OIDC caller even with a default + model map configured', () => {
    expect(() => runScopeAssert({ call: 'read', modelType: 'guestbook', ...config })).not.toThrow();
  });
});
