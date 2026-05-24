import { oidcCallModelScopePreAssert } from './scope';
import { CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE, CALL_MODEL_OIDC_SCOPES, CALL_MODEL_OIDC_SCOPE_FOR_CALL_TYPE, callModelOidcScopeForCallType, type KnownOnCallFunctionType, type OnCallTypedModelParams } from '@dereekb/firebase';
import { getOidcScopesFromRequest } from './service/oidc.auth';
import { type AssertModelCrudRequestFunctionContext } from '@dereekb/firebase-server';

const KNOWN_CALL_TYPES: ReadonlyArray<KnownOnCallFunctionType> = ['create', 'read', 'update', 'delete', 'query', 'invoke'];

function buildContext(call: string | undefined, scope: string | undefined): AssertModelCrudRequestFunctionContext<unknown, OnCallTypedModelParams> {
  const auth = scope === undefined ? undefined : { uid: 'user-1', token: { scope } };
  return {
    call: call as string,
    modelType: 'guestbook',
    specifier: undefined,
    request: {
      auth,
      data: { call, modelType: 'guestbook', data: {} }
    } as any
  };
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
