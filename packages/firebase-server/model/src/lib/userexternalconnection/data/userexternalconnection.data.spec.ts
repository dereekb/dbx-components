import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  microsoftMailSignatureUserExternalConnectionDataTypeConfig,
  USER_EXTERNAL_CONNECTION_DATA_ITEM_KEY_INVALID_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_DATA_TOO_LARGE_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_DATA_TYPE_NOT_ALLOWED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_DATA_VALUE_INVALID_ERROR_CODE,
  type UpdateUserExternalConnectionDataParams,
  userExternalConnectionDataTypeConfig
} from '@dereekb/firebase';
import { type ConfigService } from '@nestjs/config';
import { type FirebaseServerEnvService } from '@dereekb/firebase-server';
import { type } from 'arktype';
import { deriveUserExternalConnectionDataEncryptionSecret, type UserExternalConnectionData, type UserExternalConnectionStoredDataMap, userExternalConnectionDataConverter } from './userexternalconnection.data';
import { userExternalConnectionDataLimits, userExternalConnectionDataTypeRegistry } from './userexternalconnection.data.registry';
import { applyUserExternalConnectionDataUpdate, readUserExternalConnectionDataResult, userExternalConnectionProviderDataValues } from './userexternalconnection.data.action.server';
import { userExternalConnectionPrivateConverter } from '../userexternalconnection.private';
import { userExternalConnectionDataConverterConfigFromModuleConfig, userExternalConnectionModuleConfigFactory } from '../userexternalconnection.module';

const MICROSOFT = 'microsoft';
const OTHER = 'other';
const SENTINEL = 'SENTINEL-VALUE-8c1f0e';
const NOW = new Date('2026-11-13T00:00:00.000Z');

const registry = userExternalConnectionDataTypeRegistry([microsoftMailSignatureUserExternalConnectionDataTypeConfig(MICROSOFT), userExternalConnectionDataTypeConfig({ providerType: OTHER, dataType: 'prefs', label: 'Prefs', valueType: type({ color: 'string' }), maxItems: 2, maxValueBytes: 64 })]);
const limits = userExternalConnectionDataLimits();

function apply(params: Omit<UpdateUserExternalConnectionDataParams, 'key'>, current?: UserExternalConnectionStoredDataMap, overrides: { readonly maxDocumentBytes?: number; readonly maxOperations?: number } = {}) {
  return applyUserExternalConnectionDataUpdate({ current, params, registry, limits: { ...limits, ...overrides }, now: NOW });
}

function caught(fn: () => unknown): any {
  let error: any;

  try {
    fn();
  } catch (e) {
    error = e;
  }

  return error;
}

describe('userExternalConnectionDataConverter()', () => {
  const encryptionSecret = randomBytes(32).toString('hex');
  const converter = userExternalConnectionDataConverter({ encryptionSecret });
  const model: UserExternalConnectionData = { uid: 'u1', d: { microsoft: { mail_signature: { me: { v: { html: SENTINEL }, uat: NOW.toISOString() } } } }, uat: NOW };

  it('should store the whole map as one encrypted string', () => {
    const data = converter.mapFunctions.to(model);

    expect(typeof data.d).toBe('string');
    expect(data.d).not.toContain(SENTINEL);
  });

  it('should round-trip the map', () => {
    const result = converter.mapFunctions.from(converter.mapFunctions.to(model));
    expect(result.d['microsoft']['mail_signature']['me'].v).toEqual({ html: SENTINEL });
  });

  it('should throw when decrypted with another key', () => {
    const data = converter.mapFunctions.to(model);
    const other = userExternalConnectionDataConverter({ encryptionSecret: randomBytes(32).toString('hex') });
    expect(() => other.mapFunctions.from(data)).toThrow();
  });

  it('should not decrypt a uecp ciphertext copied into the data field', () => {
    const familySecret = randomBytes(32).toString('hex');
    const privateConverter = userExternalConnectionPrivateConverter({ encryptionSecret: familySecret });
    const dataConverter = userExternalConnectionDataConverter({ encryptionSecret: deriveUserExternalConnectionDataEncryptionSecret(familySecret) });
    const privateData = privateConverter.mapFunctions.to({ uid: 'u1', cr: { microsoft: { accessToken: SENTINEL, issuedAt: NOW.toISOString() } }, rl: {}, uat: NOW });

    expect(() => dataConverter.mapFunctions.from({ uid: 'u1', d: privateData.cr, uat: privateData.uat } as any)).toThrow();
  });
});

describe('userExternalConnectionModuleConfigFactory() connection data key', () => {
  const familySecret = randomBytes(32).toString('hex');
  const configService = { get: () => familySecret } as unknown as ConfigService;
  const envService = { isTestingEnv: false } as FirebaseServerEnvService;

  it('should derive a key different from the family key', () => {
    const config = userExternalConnectionModuleConfigFactory(configService, envService);
    expect(config.userExternalConnectionDataConverterConfig?.encryptionSecret).toBe(deriveUserExternalConnectionDataEncryptionSecret(familySecret));
    expect(config.userExternalConnectionDataConverterConfig?.encryptionSecret).not.toBe(familySecret);
  });

  it('should derive the key for an app config without the data field', () => {
    const result = userExternalConnectionDataConverterConfigFromModuleConfig({ userExternalConnectionPrivateConverterConfig: { encryptionSecret: familySecret } });
    expect(result.encryptionSecret).toBe(deriveUserExternalConnectionDataEncryptionSecret(familySecret));
  });
});

describe('applyUserExternalConnectionDataUpdate()', () => {
  it('should set items with a normalized key and a timestamp', () => {
    const next = apply({ providerType: MICROSOFT, set: [{ dataType: 'mail_signature', itemKey: ' Support@Example.com ', value: { html: '<p>x</p>' } }] });
    expect(next['microsoft']['mail_signature']['support@example.com']).toEqual({ v: { html: '<p>x</p>' }, uat: NOW.toISOString() });
  });

  it('should apply unset before set', () => {
    const current = apply({ providerType: MICROSOFT, set: [{ dataType: 'mail_signature', itemKey: 'me', value: { text: 'a' } }] });
    const next = apply({ providerType: MICROSOFT, unset: [{ dataType: 'mail_signature' }], set: [{ dataType: 'mail_signature', itemKey: 'me', value: { text: 'b' } }] }, current);
    expect(next['microsoft']['mail_signature']['me'].v).toEqual({ text: 'b' });
  });

  it('should unset one item and prune empty maps', () => {
    const current = apply({ providerType: MICROSOFT, set: [{ dataType: 'mail_signature', itemKey: 'me', value: { text: 'a' } }] });
    const next = apply({ providerType: MICROSOFT, unset: [{ dataType: 'mail_signature', itemKey: 'ME' }] }, current);
    expect(next).toEqual({});
  });

  it('should clear only the named provider', () => {
    const current = { ...apply({ providerType: MICROSOFT, set: [{ dataType: 'mail_signature', itemKey: 'me', value: { text: 'a' } }] }), ...apply({ providerType: OTHER, set: [{ dataType: 'prefs', itemKey: 'x', value: { color: 'red' } }] }) };
    const next = apply({ providerType: MICROSOFT, clear: true }, current);

    expect(next['microsoft']).toBeUndefined();
    expect(next['other']['prefs']['x'].v).toEqual({ color: 'red' });
  });

  it('should refuse an unregistered data type or provider (fail closed)', () => {
    expect(caught(() => apply({ providerType: MICROSOFT, set: [{ dataType: 'nope', itemKey: 'me', value: { text: 'a' } }] })).details.code).toBe(USER_EXTERNAL_CONNECTION_DATA_TYPE_NOT_ALLOWED_ERROR_CODE);
    expect(caught(() => apply({ providerType: 'unknown', set: [{ dataType: 'mail_signature', itemKey: 'me', value: { text: 'a' } }] })).details.code).toBe(USER_EXTERNAL_CONNECTION_DATA_TYPE_NOT_ALLOWED_ERROR_CODE);
    expect(caught(() => applyUserExternalConnectionDataUpdate({ current: undefined, params: { providerType: MICROSOFT, set: [{ dataType: 'mail_signature', itemKey: 'me', value: { text: 'a' } }] }, registry: userExternalConnectionDataTypeRegistry([]), limits, now: NOW })).details.code).toBe(
      USER_EXTERNAL_CONNECTION_DATA_TYPE_NOT_ALLOWED_ERROR_CODE
    );
  });

  it('should refuse an invalid item key without echoing it', () => {
    const error = caught(() => apply({ providerType: MICROSOFT, set: [{ dataType: 'mail_signature', itemKey: SENTINEL, value: { text: 'a' } }] }));

    expect(error.details.code).toBe(USER_EXTERNAL_CONNECTION_DATA_ITEM_KEY_INVALID_ERROR_CODE);
    expect(JSON.stringify({ message: error.message, details: error.details })).not.toContain(SENTINEL);
  });

  it('should refuse an invalid value without echoing it', () => {
    const error = caught(() => apply({ providerType: MICROSOFT, set: [{ dataType: 'mail_signature', itemKey: 'me', value: { html: SENTINEL, text: SENTINEL } }] }));

    expect(error.details.code).toBe(USER_EXTERNAL_CONNECTION_DATA_VALUE_INVALID_ERROR_CODE);
    expect(JSON.stringify({ message: error.message, details: error.details })).not.toContain(SENTINEL);
  });

  it('should refuse a non-object value', () => {
    expect(caught(() => apply({ providerType: OTHER, set: [{ dataType: 'prefs', itemKey: 'x', value: [SENTINEL] as any }] })).details.code).toBe(USER_EXTERNAL_CONNECTION_DATA_VALUE_INVALID_ERROR_CODE);
  });

  it('should enforce the value, items, document and operation limits', () => {
    expect(caught(() => apply({ providerType: OTHER, set: [{ dataType: 'prefs', itemKey: 'x', value: { color: 'x'.repeat(100) } }] })).details.data.scope).toBe('value');
    expect(caught(() => apply({ providerType: OTHER, set: ['a', 'b', 'c'].map((itemKey) => ({ dataType: 'prefs', itemKey, value: { color: 'red' } })) })).details.data.scope).toBe('items');
    expect(caught(() => apply({ providerType: OTHER, set: [{ dataType: 'prefs', itemKey: 'x', value: { color: 'red' } }] }, undefined, { maxDocumentBytes: 10 })).details.data.scope).toBe('document');

    const error = caught(() => apply({ providerType: OTHER, unset: [{ dataType: 'prefs' }, { dataType: 'prefs' }] }, undefined, { maxOperations: 1 }));
    expect(error.details.code).toBe(USER_EXTERNAL_CONNECTION_DATA_TOO_LARGE_ERROR_CODE);
    expect(error.details.data.scope).toBe('operations');
  });
});

describe('readUserExternalConnectionDataResult()', () => {
  const stored: UserExternalConnectionStoredDataMap = {
    ...apply({ providerType: MICROSOFT, set: [{ dataType: 'mail_signature', itemKey: 'me', value: { text: 'mine' } }] }),
    ...apply({ providerType: OTHER, set: [{ dataType: 'prefs', itemKey: 'x', value: { color: 'red' } }] })
  };

  it('should return values, summaries and the allowed data types', () => {
    const result = readUserExternalConnectionDataResult({ stored, params: {}, registry });

    expect(result.data?.['microsoft']?.['mail_signature']?.['me']).toEqual({ text: 'mine' });
    expect(result.items.map((x) => `${x.providerType}/${x.dataType}/${x.itemKey}`)).toEqual(['microsoft/mail_signature/me', 'other/prefs/x']);
    expect(result.dataTypes.length).toBe(2);
  });

  it('should hide providers the caller may not use', () => {
    const result = readUserExternalConnectionDataResult({ stored, params: {}, registry, isProviderAllowed: (p) => p !== MICROSOFT });

    expect(result.data?.['microsoft']).toBeUndefined();
    expect(result.dataTypes.every((x) => x.providerType === OTHER)).toBe(true);
  });

  it('should return no values with keysOnly', () => {
    const result = readUserExternalConnectionDataResult({ stored, params: { keysOnly: true }, registry });

    expect(result.data).toBeUndefined();
    expect(result.items.length).toBe(2);
  });

  it('should hide data types that are no longer registered', () => {
    const result = readUserExternalConnectionDataResult({ stored, params: {}, registry: userExternalConnectionDataTypeRegistry([]) });

    expect(result.items).toEqual([]);
    expect(result.dataTypes).toEqual([]);
  });

  it('should filter by item key with the data type normalizer', () => {
    const result = readUserExternalConnectionDataResult({ stored, params: { providerType: MICROSOFT, dataType: 'mail_signature', itemKey: 'ME' }, registry });
    expect(result.items.length).toBe(1);
  });
});

describe('userExternalConnectionProviderDataValues()', () => {
  it('should unwrap the registered values of one provider', () => {
    const stored = apply({ providerType: MICROSOFT, set: [{ dataType: 'mail_signature', itemKey: 'me', value: { text: 'mine' } }] });
    expect(userExternalConnectionProviderDataValues({ stored: stored['microsoft'], providerType: MICROSOFT, registry })).toEqual({ mail_signature: { me: { text: 'mine' } } });
    expect(userExternalConnectionProviderDataValues({ stored: undefined, providerType: MICROSOFT, registry })).toEqual({});
  });
});
