import { asGetter } from '@dereekb/util';
import { typedConfigRegistry, typedServiceRegistry } from './typed.service';

const typeA = 'typeA';
const typeB = 'typeB';

type TEST_TYPES = typeof typeA | typeof typeB;

type TestService = object;

describe('typedServiceRegistry()', () => {
  it('should create a ModelServiceRegistryInstance with the types registered.', () => {
    const typeAService = {};
    const typeBService = {};

    const result = typedServiceRegistry<TestService, TEST_TYPES>({
      services: {
        typeA: typeAService,
        typeB: asGetter(typeBService)
      }
    });

    expect(result).toBeDefined();
    expect(result.serviceForType('typeA')).toBeDefined();
    expect(result.serviceForType('typeA')).toBe(typeAService);

    expect(result.serviceForType('typeB')).toBeDefined();
    expect(result.serviceForType('typeB')).toBe(typeBService);
  });
});

describe('typedConfigRegistry()', () => {
  type TestType = 'a' | 'b' | 'c';

  interface TestConfig {
    readonly type: string;
    readonly label: string;
  }

  const configA: TestConfig = { type: 'a', label: 'A' };
  const configB: TestConfig = { type: 'b', label: 'B' };

  function makeRegistry() {
    return typedConfigRegistry<TestConfig, TestType>({
      configs: { a: configA, b: configB } as Record<TestType, TestConfig>,
      defaultConfigForType: (type) => ({ type, label: 'default' })
    });
  }

  it('should return the registered config by identity', () => {
    const registry = makeRegistry();
    expect(registry.configForType('a')).toBe(configA);
    expect(registry.registeredConfigForType('b')).toBe(configB);
  });

  it('should return the default config for an unknown type', () => {
    const defaultConfigForType = vi.fn((type: TestType) => ({ type, label: 'default' }));
    const registry = typedConfigRegistry<TestConfig, TestType>({ configs: { a: configA } as Record<TestType, TestConfig>, defaultConfigForType });

    expect(registry.configForType('c')).toEqual({ type: 'c', label: 'default' });
    expect(defaultConfigForType).toHaveBeenCalledWith('c');
  });

  it('should return undefined from registeredConfigForType() for unknown types and Object.prototype members', () => {
    const registry = typedConfigRegistry<TestConfig>({ configs: { a: configA }, defaultConfigForType: (type) => ({ type, label: 'default' }) });

    expect(registry.registeredConfigForType('c')).toBeUndefined();
    expect(registry.registeredConfigForType('toString')).toBeUndefined();
    expect(registry.registeredConfigForType('constructor')).toBeUndefined();
    expect(registry.configForType('constructor')).toEqual({ type: 'constructor', label: 'default' });
  });

  it('should list the known types and configs in registration order', () => {
    const registry = makeRegistry();
    expect(registry.getAllKnownTypes()).toEqual(['a', 'b']);
    expect(registry.getAllKnownConfigs()).toEqual([configA, configB]);
  });

  it('should return copies of the known types and configs', () => {
    const registry = makeRegistry();

    registry.getAllKnownTypes().push('c');
    registry.getAllKnownConfigs().pop();

    expect(registry.getAllKnownTypes()).toEqual(['a', 'b']);
    expect(registry.getAllKnownConfigs()).toEqual([configA, configB]);
  });

  it('should work with detached members', () => {
    const { configForType, registeredConfigForType, getAllKnownTypes, getAllKnownConfigs } = makeRegistry();

    expect(configForType('a')).toBe(configA);
    expect(configForType('c').label).toBe('default');
    expect(registeredConfigForType('b')).toBe(configB);
    expect(getAllKnownTypes()).toEqual(['a', 'b']);
    expect(getAllKnownConfigs()).toEqual([configA, configB]);
  });

  it('should expose the passed record as configs', () => {
    const configs = { a: configA } as Record<TestType, TestConfig>;
    const registry = typedConfigRegistry<TestConfig, TestType>({ configs, defaultConfigForType: (type) => ({ type, label: 'default' }) });
    expect(registry.configs).toBe(configs);
  });
});
