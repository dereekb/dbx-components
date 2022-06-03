import { asGetter } from '@dereekb/util';
import { typedServiceRegistry } from './typed.service';

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
