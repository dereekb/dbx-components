import { AbstractJestTestContextFixture, jestTestContextBuilder, JestTestContextBuilderFunction } from "./jest";

export interface TestConfig {
  a: string;
}

export class TestInstance {
  constructor(readonly config?: TestConfig) { }
}

export class TestJestTestContextFixture extends AbstractJestTestContextFixture<TestInstance> { }

export function makeTestBuilder() {
  return jestTestContextBuilder<TestInstance, TestJestTestContextFixture, TestConfig>({
    buildConfig: (input?: Partial<TestConfig>) => ({ a: '0', ...input }),
    buildFixture: () => new TestJestTestContextFixture(),
    setupInstance: async (config) => new TestInstance(config),
    teardownInstance: async () => undefined
  });
}

describe('jestTestContextBuilder', () => {

  it('should return a builder function', () => {

    const testBuilder = makeTestBuilder();

    expect(testBuilder).toBeDefined();
    expect(typeof testBuilder).toBe('function');
  });

  describe('JestTestContextBuilderFunction', () => {

    const testBuilder: JestTestContextBuilderFunction<TestInstance, TestJestTestContextFixture, TestConfig> = makeTestBuilder();

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

  })

});
