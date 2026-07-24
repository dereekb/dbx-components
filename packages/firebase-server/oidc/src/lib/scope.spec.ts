import { oidcCallModelScopePreAssert } from './scope';
import { CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE, CALL_MODEL_OIDC_SCOPES, CALL_MODEL_OIDC_SCOPE_FOR_CALL_TYPE, callModelOidcScopeForCallType, type KnownOnCallFunctionType, type OidcScopeTerm, type OnCallTypedModelParams } from '@dereekb/firebase';
import { getOidcScopesFromRequest } from './service/oidc.auth';
import { type AssertModelCrudRequestFunctionContext } from '@dereekb/firebase-server';

const KNOWN_CALL_TYPES: ReadonlyArray<KnownOnCallFunctionType> = ['create', 'read', 'update', 'delete', 'query', 'invoke'];

function buildContext(call: string | undefined, scope: string | undefined, requiredScope?: OidcScopeTerm, modelType = 'guestbook'): AssertModelCrudRequestFunctionContext<unknown, OnCallTypedModelParams> {
  const auth = scope === undefined ? undefined : { uid: 'user-1', token: { scope } };
  return {
    call: call as string,
    modelType,
    specifier: undefined,
    requiredScope,
    request: {
      auth,
      data: { call, modelType, data: {} }
    } as any
  };
}

function thrownErrorCode(fn: () => void): string | undefined {
  let caught: any;
  try {
    fn();
  } catch (e) {
    caught = e;
  }
  const details = caught?.details ?? caught?.errorInfo?.details ?? caught;
  return details?.code ?? caught?.code;
}

describe('callModelOidcScopeForCallType', () => {
  it('maps each known CRUD type to its model.* scope', () => {
    KNOWN_CALL_TYPES.forEach((call) => {
      expect(callModelOidcScopeForCallType(call)).toBe(CALL_MODEL_OIDC_SCOPE_FOR_CALL_TYPE[call]);
    });
  });

  it('returns undefined for unknown / custom call types', () => {
    expect(callModelOidcScopeForCallType('archive')).toBeUndefined();
    expect(callModelOidcScopeForCallType(undefined)).toBeUndefined();
    expect(callModelOidcScopeForCallType('')).toBeUndefined();
  });

  it('exposes a stable scope string per call type', () => {
    expect(CALL_MODEL_OIDC_SCOPES).toEqual(['model.create', 'model.read', 'model.update', 'model.delete', 'model.query', 'model.invoke']);
  });
});

describe('getOidcScopesFromRequest', () => {
  it('returns undefined when the request is unauthenticated', () => {
    expect(getOidcScopesFromRequest({ auth: undefined } as any)).toBeUndefined();
  });

  it('returns undefined when auth.token has no scope claim', () => {
    expect(getOidcScopesFromRequest({ auth: { token: {} } } as any)).toBeUndefined();
  });

  it('returns undefined when scope is not a string (Firebase ID-token caller)', () => {
    expect(getOidcScopesFromRequest({ auth: { token: { scope: 1 } } } as any)).toBeUndefined();
  });

  it('returns the parsed scope set when an OIDC scope string is present', () => {
    const scopes = getOidcScopesFromRequest({ auth: { token: { scope: 'openid model.read model.create' } } });
    expect(scopes).toEqual(new Set(['openid', 'model.read', 'model.create']));
  });

  it('returns an empty Set (not undefined) when scope is the empty string', () => {
    const scopes = getOidcScopesFromRequest({ auth: { token: { scope: '' } } });
    expect(scopes).toBeDefined();
    expect(scopes!.size).toBe(0);
  });

  it('drops empty tokens caused by repeated separators', () => {
    const scopes = getOidcScopesFromRequest({ auth: { token: { scope: '  model.read   model.update ' } } });
    expect(scopes).toEqual(new Set(['model.read', 'model.update']));
  });
});

describe('oidcCallModelScopePreAssert', () => {
  const preAssert = oidcCallModelScopePreAssert();

  it('does nothing when the request has no OIDC scope claim (regular Firebase auth)', () => {
    KNOWN_CALL_TYPES.forEach((call) => {
      expect(() => preAssert(buildContext(call, undefined))).not.toThrow();
    });
  });

  it('passes when the OIDC token carries the matching model.* scope', () => {
    KNOWN_CALL_TYPES.forEach((call) => {
      const required = CALL_MODEL_OIDC_SCOPE_FOR_CALL_TYPE[call];
      expect(() => preAssert(buildContext(call, `openid ${required}`))).not.toThrow();
    });
  });

  it('rejects with CALL_MODEL_MISSING_OIDC_SCOPE when the matching model.* scope is absent', () => {
    KNOWN_CALL_TYPES.forEach((call) => {
      const otherScope = call === 'create' ? 'model.read' : 'model.create';
      let caught: any;
      try {
        preAssert(buildContext(call, `openid ${otherScope}`));
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeDefined();
      const details = caught?.details ?? caught?.errorInfo?.details ?? caught;
      expect(details?.code ?? caught?.code).toBe(CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE);
    });
  });

  it('rejects when the OIDC token grants no scopes at all', () => {
    expect(() => preAssert(buildContext('create', ''))).toThrow();
  });

  it('bypasses non-CRUD (custom) call types even when an OIDC token is present', () => {
    expect(() => preAssert(buildContext('archive', 'openid'))).not.toThrow();
  });
});

describe('oidcCallModelScopePreAssert (per-function requiredScope)', () => {
  const preAssert = oidcCallModelScopePreAssert();

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

  it('passes when the OIDC token carries both the per-verb and the per-function scope', () => {
    expect(() => preAssert(buildContext('create', 'openid model.create lms', 'lms'))).not.toThrow();
  });

  it('rejects with CALL_MODEL_MISSING_OIDC_SCOPE when the per-function scope is absent (per-verb present)', () => {
    expect(codeOfThrown(() => preAssert(buildContext('create', 'openid model.create', 'lms')))).toBe(CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE);
  });

  it('is additive: rejects when the per-verb scope is absent even though the per-function scope is present', () => {
    expect(codeOfThrown(() => preAssert(buildContext('create', 'openid lms', 'lms')))).toBe(CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE);
  });

  it('bypasses the per-function scope for a non-OIDC caller (no scope claim)', () => {
    expect(() => preAssert(buildContext('create', undefined, 'lms'))).not.toThrow();
  });

  it('enforces a per-function scope even on an otherwise-unrestricted custom call type', () => {
    expect(() => preAssert(buildContext('archive', 'openid lms', 'lms'))).not.toThrow();
    expect(codeOfThrown(() => preAssert(buildContext('archive', 'openid', 'lms')))).toBe(CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE);
  });
});

describe('oidcCallModelScopePreAssert (default required scope)', () => {
  const preAssert = oidcCallModelScopePreAssert({ defaultRequiredScope: 'hellosubs' });

  it('rejects when the configured default group scope is missing (per-verb held)', () => {
    expect(thrownErrorCode(() => preAssert(buildContext('read', 'openid model.read')))).toBe(CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE);
  });

  it('passes when the caller holds both the per-verb scope and the default group scope', () => {
    expect(() => preAssert(buildContext('read', 'openid model.read hellosubs'))).not.toThrow();
  });

  it('still AND-s the per-verb scope: rejects when only the default group scope is held', () => {
    expect(thrownErrorCode(() => preAssert(buildContext('read', 'openid hellosubs')))).toBe(CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE);
  });

  it('applies the default to a custom (non-CRUD) verb too', () => {
    expect(() => preAssert(buildContext('archive', 'openid hellosubs'))).not.toThrow();
    expect(thrownErrorCode(() => preAssert(buildContext('archive', 'openid')))).toBe(CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE);
  });

  it('a per-function requiredScope overrides the default (finest wins)', () => {
    // requires model.read AND lms — NOT hellosubs — because the per-function term wins.
    expect(() => preAssert(buildContext('read', 'openid model.read lms', 'lms'))).not.toThrow();
    expect(thrownErrorCode(() => preAssert(buildContext('read', 'openid model.read hellosubs', 'lms')))).toBe(CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE);
  });

  it('bypasses entirely for a non-OIDC caller even with a default configured', () => {
    expect(() => preAssert(buildContext('read', undefined))).not.toThrow();
  });
});

describe('oidcCallModelScopePreAssert (model-level requirements + OR-groups)', () => {
  const preAssert = oidcCallModelScopePreAssert({
    defaultRequiredScope: 'hellosubs',
    modelRequiredScopes: {
      // WorkerAcademyProgress is wholly LMS — hellosubs OR lms for every verb.
      workerAcademyProgress: ['hellosubs', 'lms'],
      // Worker allows lms reads, but requires hellosubs for every other verb.
      worker: { read: ['hellosubs', 'lms'], default: 'hellosubs' }
    }
  });

  it('OR-group: passes when the caller holds ANY alternative (lms, no hellosubs)', () => {
    expect(() => preAssert(buildContext('create', 'openid model.create lms', undefined, 'workerAcademyProgress'))).not.toThrow();
    expect(() => preAssert(buildContext('create', 'openid model.create hellosubs', undefined, 'workerAcademyProgress'))).not.toThrow();
  });

  it('OR-group: rejects when the caller holds NONE of the alternatives', () => {
    expect(thrownErrorCode(() => preAssert(buildContext('create', 'openid model.create', undefined, 'workerAcademyProgress')))).toBe(CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE);
  });

  it('enforces a PLAIN READ (no per-function handler) via the model map', () => {
    // A plain read carries no requiredScope, yet the model-map OR-group still gates it.
    expect(() => preAssert(buildContext('read', 'openid model.read lms', undefined, 'workerAcademyProgress'))).not.toThrow();
    expect(thrownErrorCode(() => preAssert(buildContext('read', 'openid model.read', undefined, 'workerAcademyProgress')))).toBe(CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE);
  });

  it('verb-keyed entry resolves per verb: lms allowed for read, hellosubs required for write', () => {
    expect(() => preAssert(buildContext('read', 'openid model.read lms', undefined, 'worker'))).not.toThrow();
    // create falls back to the verb-map default (hellosubs); lms alone is not enough.
    expect(thrownErrorCode(() => preAssert(buildContext('create', 'openid model.create lms', undefined, 'worker')))).toBe(CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE);
    expect(() => preAssert(buildContext('create', 'openid model.create hellosubs', undefined, 'worker'))).not.toThrow();
  });

  it('model map beats the default for a tagged model, default applies to an untagged model', () => {
    // guestbook is untagged → the default (hellosubs) applies.
    expect(() => preAssert(buildContext('create', 'openid model.create hellosubs', undefined, 'guestbook'))).not.toThrow();
    expect(thrownErrorCode(() => preAssert(buildContext('create', 'openid model.create lms', undefined, 'guestbook')))).toBe(CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE);
    // workerAcademyProgress is tagged → lms satisfies it despite the hellosubs default.
    expect(() => preAssert(buildContext('create', 'openid model.create lms', undefined, 'workerAcademyProgress'))).not.toThrow();
  });

  it('lists the unsatisfied OR-group in the error data', () => {
    let caught: any;
    try {
      preAssert(buildContext('create', 'openid model.create', undefined, 'workerAcademyProgress'));
    } catch (e) {
      caught = e;
    }
    const details = caught?.details ?? caught?.errorInfo?.details ?? caught;
    expect(details?.data?.requiredScopes).toEqual([['hellosubs', 'lms']]);
  });
});
