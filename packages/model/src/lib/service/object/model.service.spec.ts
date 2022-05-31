import { asGetter } from '@dereekb/util';
import { modelServiceRegistry } from './model.service';

const typeA = 'typeA';
const typeB = 'typeB';

type TEST_TYPES = typeof typeA | typeof typeB;

type TestService = {};

describe('modelServiceRegistry()', () => {
  it('should create a ModelServiceRegistryInstance with the types registered.', () => {
    const typeAService = {};
    const typeBService = {};

    const result = modelServiceRegistry<TestService, TEST_TYPES>({
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
