import { describe, expect, it } from 'vitest';
import { appFormSpaceTypeConfigService, DEFAULT_FORM_SPACE_TYPE_CONFIG, type FormSpaceTypeConfig, formSpaceTypeConfigRecord, UNKNOWN_FORM_SPACE_TYPE } from './formspace.type';

const configA: FormSpaceTypeConfig = { formSpaceType: 'a', name: 'A' };
const configB: FormSpaceTypeConfig = { formSpaceType: 'b', maxUploads: 2 };

describe('formSpaceTypeConfigRecord()', () => {
  it('should index the configs by type', () => {
    const record = formSpaceTypeConfigRecord([configA, configB]);
    expect(record['a']).toBe(configA);
    expect(record['b']).toBe(configB);
  });

  it('should throw on a duplicate type', () => {
    expect(() => formSpaceTypeConfigRecord([configA, { formSpaceType: 'a' }])).toThrow();
  });
});

describe('appFormSpaceTypeConfigService()', () => {
  const service = appFormSpaceTypeConfigService(formSpaceTypeConfigRecord([configA, configB]));

  it('should resolve a registered type', () => {
    expect(service.configForFormSpaceType('a')).toBe(configA);
  });

  it('should fall back to the default config for an unregistered type', () => {
    const config = service.configForFormSpaceType('nope');
    expect(config).toBe(DEFAULT_FORM_SPACE_TYPE_CONFIG);
    expect(config.formSpaceType).toBe(UNKNOWN_FORM_SPACE_TYPE);
  });

  it('should return null from registeredConfigForFormSpaceType() for an unregistered type', () => {
    expect(service.registeredConfigForFormSpaceType('nope')).toBeUndefined();
    expect(service.registeredConfigForFormSpaceType('a')).toBe(configA);
  });

  it('should list every known type and config', () => {
    expect(service.getAllKnownFormSpaceTypes()).toEqual(['a', 'b']);
    expect(service.getAllKnownFormSpaceTypeConfigs()).toEqual([configA, configB]);
  });
});
