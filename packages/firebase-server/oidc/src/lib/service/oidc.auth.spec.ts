import { describe, it, expect } from 'vitest';
import { CALL_MODEL_OIDC_SCOPES, CALL_MODEL_OIDC_SCOPE_FOR_CALL_TYPE, callModelOidcScopeForCallType, type KnownOnCallFunctionType } from '@dereekb/firebase';
import { getOidcScopesFromRequest } from './oidc.auth';

const KNOWN_CALL_TYPES: ReadonlyArray<KnownOnCallFunctionType> = ['create', 'read', 'update', 'delete', 'query', 'invoke'];

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
