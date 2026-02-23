import { AbstractVitestTestContextFixture, vitestTestContextBuilder, type VitestTestContextBuilderFunction } from './vitest';

export interface TestConfig {
  a: string;
}

export class TestInstance {
  constructor(readonly config?: TestConfig) {}
}

export class TestVitestTestContextFixture extends AbstractVitestTestContextFixture<TestInstance> {}

export function makeTestBuilder() {
  return vitestTestContextBuilder<TestInstance, TestVitestTestContextFixture, TestConfig>({
    buildConfig: (input?: Partial<TestConfig>) => ({ a: '0', ...input }),
    buildFixture: () => new TestVitestTestContextFixture(),
    setupInstance: async (config) => new TestInstance(config),
    teardownInstance: async () => undefined
  });
}

describe('vitestTestContextBuilder', () => {
  it('should return a builder function', () => {
    const testBuilder = makeTestBuilder();

    expect(testBuilder).toBeDefined();
    expect(typeof testBuilder).toBe('function');
  });

  describe('VitestTestContextBuilderFunction', () => {
    const testBuilder: VitestTestContextBuilderFunction<TestInstance, TestVitestTestContextFixture, TestConfig> = makeTestBuilder();

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
