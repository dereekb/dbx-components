import { useJestFunctionFixture } from "@dereekb/util/test";
import { NestApplicationRunnableHttpFunctionFactory } from "@dereekb/firebase-server";
import { WrappedCloudFunction } from "./firebase.admin";
import { FirebaseAdminFunctionNestTestContext, wrapCloudFunctionForNestTestsGetter } from "./firebase.admin.nest.function";

export interface CloudFunctionTestConfig<I> {
  f: FirebaseAdminFunctionNestTestContext;
  fn: NestApplicationRunnableHttpFunctionFactory<I>;
}

/**
 * Used to provide a test builder that exposes a WrappedCloudFunction using the input configuration.
 * 
 * @param config 
 * @param buildTests 
 */
export function cloudFunctionTest<I>(config: CloudFunctionTestConfig<I>, buildTests: (fn: WrappedCloudFunction<I>) => void) {
  const { f, fn } = config;

  useJestFunctionFixture<WrappedCloudFunction<I>>({
    fn: () => {
      const x = wrapCloudFunctionForNestTestsGetter(f, fn)();
      return x;
    }
  }, buildTests);
}

/**
 * Convenience function that calls describe and cloudFunctionContext together.
 * 
 * @param label 
 * @param config 
 * @param buildTests 
 */
export function describeCloudFunctionTest<I>(label: string, config: CloudFunctionTestConfig<I>, buildTests: (fn: WrappedCloudFunction<I>) => void) {
  describe(label, () => {
    cloudFunctionTest(config, buildTests);
  });
}
