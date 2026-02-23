import { AbstractTestContextFixture, testContextBuilder, type TestContextBuilderFunction } from './shared';

export interface TestConfig {
  a: string;
}

export class TestInstance {
  constructor(readonly config?: TestConfig) {}
}

export class SharedTestContextFixture extends AbstractTestContextFixture<TestInstance> {}

export function makeTestBuilder() {
  return testContextBuilder<TestInstance, SharedTestContextFixture, TestConfig>({
    buildConfig: (input?: Partial<TestConfig>) => ({ a: '0', ...input }),
    buildFixture: () => new SharedTestContextFixture(),
    setupInstance: async (config) => new TestInstance(config),
    teardownInstance: async () => undefined
  });
}

describe('TestContextBuilder', () => {
  it('should return a builder function', () => {
    const testBuilder = makeTestBuilder();

    expect(testBuilder).toBeDefined();
    expect(typeof testBuilder).toBe('function');
  });

  describe('TestContextBuilderFunction', () => {
    const testBuilder: TestContextBuilderFunction<TestInstance, SharedTestContextFixture, TestConfig> = makeTestBuilder();

    it('should create a new test context with no config provided.', () => {
      const testContext = testBuilder();

      expect(testContext).toBeDefined();
      expect(typeof testContext).toBe('function');
    });

    describe('using test builder', () => {
      const testA = 'test';

      testBuilder({
        a: testA
      })((f) => {
        it('should be configured with the input configuration.', () => {
          expect(f.instance.config!.a).toBe(testA);
        });

        it('should provide access to the instance via the fixture', () => {
          expect(f.instance).toBeDefined();
          expect(f.instance instanceof TestInstance).toBe(true);
        });
      });
    });
  });
});
