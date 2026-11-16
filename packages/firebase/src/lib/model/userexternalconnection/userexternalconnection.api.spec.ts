import { describe, it, expect } from 'vitest';
import { type } from 'arktype';
import { readUserExternalConnectionAuthorizeStateParamsType, readUserExternalConnectionDataParamsType, updateUserExternalConnectionDataParamsType } from './userexternalconnection.api';

// the Firebase callable SDK encodes an undefined property as null, so every Maybe param must accept null
describe('readUserExternalConnectionAuthorizeStateParamsType', () => {
  it('should accept a null mode and scopePreset', () => {
    const result = readUserExternalConnectionAuthorizeStateParamsType({ providerType: 'trello', mode: null, scopePreset: null });
    expect(result instanceof type.errors).toBe(false);
  });

  it('should accept a scopePreset', () => {
    const result = readUserExternalConnectionAuthorizeStateParamsType({ providerType: 'microsoft', mode: 'connect', scopePreset: 'read' });
    expect(result instanceof type.errors).toBe(false);
  });

  it('should refuse an unknown mode', () => {
    const result = readUserExternalConnectionAuthorizeStateParamsType({ providerType: 'trello', mode: 'other' });
    expect(result instanceof type.errors).toBe(true);
  });

  it('should refuse a key', () => {
    const result = readUserExternalConnectionAuthorizeStateParamsType({ providerType: 'trello', key: 'uec/abc' });
    expect(result instanceof type.errors).toBe(true);
  });
});

describe('readUserExternalConnectionDataParamsType', () => {
  it('should accept null filters', () => {
    const result = readUserExternalConnectionDataParamsType({ providerType: null, dataType: null, itemKey: null, keysOnly: null });
    expect(result instanceof type.errors).toBe(false);
  });
});

describe('updateUserExternalConnectionDataParamsType', () => {
  it('should accept null set, unset and clear', () => {
    const result = updateUserExternalConnectionDataParamsType({ providerType: 'microsoft', set: null, unset: null, clear: null });
    expect(result instanceof type.errors).toBe(false);
  });

  it('should accept an unset with a null itemKey', () => {
    const result = updateUserExternalConnectionDataParamsType({ providerType: 'microsoft', unset: [{ dataType: 'signature', itemKey: null }] });
    expect(result instanceof type.errors).toBe(false);
  });
});
