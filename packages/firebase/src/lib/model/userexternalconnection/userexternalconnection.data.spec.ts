import { describe, expect, it } from 'vitest';
import { type } from 'arktype';
import {
  normalizeUserExternalConnectionDataItemKey,
  readUserExternalConnectionDataItem,
  userExternalConnectionDataTypeConfig,
  userExternalConnectionDataTypeConfigLookup,
  userExternalConnectionDataTypeSummary,
  userExternalConnectionDataValueByteLength,
  DEFAULT_USER_EXTERNAL_CONNECTION_DATA_MAX_ITEMS,
  type TypedUserExternalConnectionDataMap,
  type UserExternalConnectionDataTypings
} from './userexternalconnection.data';
import {
  MICROSOFT_MAIL_SIGNATURE_MAX_VALUE_BYTES,
  MICROSOFT_MAIL_SIGNATURE_USER_EXTERNAL_CONNECTION_DATA_TYPE,
  microsoftMailSignatureFromFile,
  microsoftMailSignatureItemKey,
  microsoftMailSignatureUserExternalConnectionDataTypeConfig,
  microsoftMailSignatureUserExternalConnectionDataValueType,
  type MicrosoftUserExternalConnectionDataTypes
} from './userexternalconnection.data.microsoft';
import { userExternalConnectionTokenApiPath } from './userexternalconnection.token';

const noteConfig = userExternalConnectionDataTypeConfig({ providerType: 'zoho', dataType: 'note', label: 'Note', valueType: type({ text: 'string' }) });

describe('userExternalConnectionDataTypeConfigLookup()', () => {
  it('should look up configs by provider and data type', () => {
    const microsoft = microsoftMailSignatureUserExternalConnectionDataTypeConfig();
    const lookup = userExternalConnectionDataTypeConfigLookup([microsoft, noteConfig]);
    expect(lookup.configFor('microsoft', MICROSOFT_MAIL_SIGNATURE_USER_EXTERNAL_CONNECTION_DATA_TYPE)).toBe(microsoft);
    expect(lookup.configFor('zoho', MICROSOFT_MAIL_SIGNATURE_USER_EXTERNAL_CONNECTION_DATA_TYPE)).toBeUndefined();
    expect(lookup.configsFor('zoho')).toEqual([noteConfig]);
    expect(lookup.configsFor('unknown')).toEqual([]);
    expect(lookup.configs.length).toBe(2);
  });

  it('should allow an empty registry', () => {
    const lookup = userExternalConnectionDataTypeConfigLookup(undefined);
    expect(lookup.configs).toEqual([]);
    expect(lookup.configFor('microsoft', 'mail_signature')).toBeUndefined();
  });

  it('should throw on a duplicate registration', () => {
    expect(() => userExternalConnectionDataTypeConfigLookup([noteConfig, noteConfig])).toThrow();
  });

  it('should throw on an invalid data type key', () => {
    expect(() => userExternalConnectionDataTypeConfigLookup([{ ...noteConfig, dataType: 'Bad-Key' }])).toThrow();
    expect(() => userExternalConnectionDataTypeConfigLookup([{ ...noteConfig, dataType: '1abc' }])).toThrow();
  });
});

describe('normalizeUserExternalConnectionDataItemKey()', () => {
  it('should trim by default', () => {
    expect(normalizeUserExternalConnectionDataItemKey(noteConfig, '  key ')).toBe('key');
  });

  it('should refuse an empty, too long or control-character key', () => {
    expect(normalizeUserExternalConnectionDataItemKey(noteConfig, '   ')).toBeUndefined();
    expect(normalizeUserExternalConnectionDataItemKey(noteConfig, 'a'.repeat(257))).toBeUndefined();
    expect(normalizeUserExternalConnectionDataItemKey(noteConfig, 'a\nb')).toBeUndefined();
  });

  it('should use the config normalizer', () => {
    const config = microsoftMailSignatureUserExternalConnectionDataTypeConfig();
    expect(normalizeUserExternalConnectionDataItemKey(config, ' Support@Example.COM ')).toBe('support@example.com');
    expect(normalizeUserExternalConnectionDataItemKey(config, 'not an address')).toBeUndefined();
  });
});

describe('userExternalConnectionDataValueByteLength()', () => {
  it('should count UTF-8 bytes of the JSON', () => {
    expect(userExternalConnectionDataValueByteLength({ a: 'b' })).toBe(9);
    expect(userExternalConnectionDataValueByteLength({ a: 'é' })).toBe(10);
    expect(userExternalConnectionDataValueByteLength(undefined)).toBe(0);
  });
});

describe('userExternalConnectionDataTypeSummary()', () => {
  it('should fill in the default limits', () => {
    const summary = userExternalConnectionDataTypeSummary(noteConfig);
    expect(summary.maxItems).toBe(DEFAULT_USER_EXTERNAL_CONNECTION_DATA_MAX_ITEMS);
    expect(summary.acceptsFile).toBe(false);
    expect(userExternalConnectionDataTypeSummary(microsoftMailSignatureUserExternalConnectionDataTypeConfig()).acceptsFile).toBe(true);
  });
});

describe('readUserExternalConnectionDataItem()', () => {
  interface TestTypings extends UserExternalConnectionDataTypings {
    readonly microsoft: MicrosoftUserExternalConnectionDataTypes;
  }

  it('should read a typed item', () => {
    const data: TypedUserExternalConnectionDataMap<TestTypings> = { microsoft: { mail_signature: { me: { html: '<p>hi</p>' } } } };
    expect(readUserExternalConnectionDataItem(data, 'microsoft', 'mail_signature', 'me')?.html).toBe('<p>hi</p>');
    expect(readUserExternalConnectionDataItem(data, 'microsoft', 'mail_signature', 'other@example.com')).toBeUndefined();
    expect(readUserExternalConnectionDataItem<TestTypings, 'microsoft', 'mail_signature'>(undefined, 'microsoft', 'mail_signature', 'me')).toBeUndefined();
  });
});

describe('microsoft mail signature', () => {
  describe('microsoftMailSignatureUserExternalConnectionDataValueType', () => {
    function isValid(value: unknown): boolean {
      return !(microsoftMailSignatureUserExternalConnectionDataValueType(value) instanceof type.errors);
    }

    it('should accept exactly one non-empty html or text', () => {
      expect(isValid({ html: '<p>hi</p>' })).toBe(true);
      expect(isValid({ text: 'hi' })).toBe(true);
    });

    it('should refuse both, neither, empty or extra keys', () => {
      expect(isValid({ html: '<p>hi</p>', text: 'hi' })).toBe(false);
      expect(isValid({})).toBe(false);
      expect(isValid({ html: '' })).toBe(false);
      expect(isValid({ html: 'a', other: 'b' })).toBe(false);
      expect(isValid({ html: 1 })).toBe(false);
    });
  });

  describe('microsoftMailSignatureItemKey()', () => {
    it('should accept me and addresses, lowercased', () => {
      expect(microsoftMailSignatureItemKey('me')).toBe('me');
      expect(microsoftMailSignatureItemKey(' ME ')).toBe('me');
      expect(microsoftMailSignatureItemKey('Support@Example.com')).toBe('support@example.com');
    });

    it('should refuse anything else', () => {
      expect(microsoftMailSignatureItemKey('')).toBeUndefined();
      expect(microsoftMailSignatureItemKey('support')).toBeUndefined();
      expect(microsoftMailSignatureItemKey('a b@example.com')).toBeUndefined();
    });
  });

  describe('microsoftMailSignatureFromFile()', () => {
    it('should pack html files as html and others as text, trimmed', () => {
      expect(microsoftMailSignatureFromFile({ fileName: 'sig.HTML', content: ' <p>a</p>\n' })).toEqual({ html: '<p>a</p>' });
      expect(microsoftMailSignatureFromFile({ fileName: '/x/sig.htm', content: '<p>a</p>' })).toEqual({ html: '<p>a</p>' });
      expect(microsoftMailSignatureFromFile({ fileName: 'sig.txt', content: 'Best,\nMe\n' })).toEqual({ text: 'Best,\nMe' });
    });
  });

  it('should bind to the given provider type with the signature size cap', () => {
    const config = microsoftMailSignatureUserExternalConnectionDataTypeConfig('microsoft_admin');
    expect(config.providerType).toBe('microsoft_admin');
    expect(config.maxValueBytes).toBe(MICROSOFT_MAIL_SIGNATURE_MAX_VALUE_BYTES);
    expect(microsoftMailSignatureUserExternalConnectionDataTypeConfig().providerType).toBe('microsoft');
  });
});

describe('userExternalConnectionTokenApiPath()', () => {
  it('should add include=data only when asked', () => {
    expect(userExternalConnectionTokenApiPath('microsoft')).toBe('/session/external/microsoft');
    expect(userExternalConnectionTokenApiPath('microsoft', { includeData: true })).toBe('/session/external/microsoft?include=data');
    expect(userExternalConnectionTokenApiPath('microsoft', { includeData: false })).toBe('/session/external/microsoft');
  });
});
