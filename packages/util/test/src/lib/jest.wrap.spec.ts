import { makeTestBuilder, TestJestTestContextFixture } from "./jest.spec";
import { JestTestWrappedContextFactoryBuilder, wrapJestTestContextFactory } from "./jest.wrap";

export class WrappedTestJestTestContextFixture {

  constructor(readonly fixture: TestJestTestContextFixture) { }

}

export interface WrappedTestConfigureWrapperExampleConfig {
  somePotentialConfig?: boolean;
  onSetup?: () => void;
  onTeardown?: (effect: number) => void;
}

export function configureWrapperExample(config?: WrappedTestConfigureWrapperExampleConfig): JestTestWrappedContextFactoryBuilder<WrappedTestJestTestContextFixture, TestJestTestContextFixture> {
  return wrapJestTestContextFactory<WrappedTestJestTestContextFixture, TestJestTestContextFixture, number>({
    wrapFixture: (fixture) => new WrappedTestJestTestContextFixture(fixture),
    setupWrap: async (fixture: WrappedTestJestTestContextFixture) => {

      // Do nothing, but we could use the config here to initialize our new fixture for the tests it will be used it.
      config?.onSetup?.();

      // We return our effect. Is available within teardownWrap.
      return 0;
    },
    teardownWrap: async (fixture: WrappedTestJestTestContextFixture, effect: number) => {

      // Same here
      config?.onTeardown?.(effect);

    }
  });
}

describe('wrapJestTestContextFactory()', () => {

  const testBuilder = makeTestBuilder();

  function makeWrapper() {
    return configureWrapperExample({
      somePotentialConfig: true
    });
  }

  it('should create a function for wrapping a factory.', () => {
    const wrapper = makeWrapper();

    expect(wrapper).toBeDefined();
    expect(typeof wrapper).toBe('function');
  });

  describe('wrapper', () => {

    let wasSetup = false;

    const wrapper = configureWrapperExample({
      // Shows how we can configure the wrapper to do additional setup/teardown or add arbitrary interactions.
      onSetup: () => {
        wasSetup = true;
      },
      onTeardown: () => {
        wasSetup = false;
      }
    });

    it('should wrap a factory', () => {
      const factory = wrapper(testBuilder())

      expect(factory).toBeDefined();
      expect(typeof factory).toBe('function');
    });

    describe('wrapped factory', () => {

      const wrappedFactory = wrapper(testBuilder());

      describe('with tests executed within test context', () => {

        wrappedFactory(() => {

          it('should execute our setup wrap', () => {
            expect(wasSetup).toBe(true);
          });

        });

      });

      describe('with tests executed outside test context', () => {

        it('should not execute our setup wrap', () => {
          expect(wasSetup).toBe(false);
        });

      });

    });

  });

});
