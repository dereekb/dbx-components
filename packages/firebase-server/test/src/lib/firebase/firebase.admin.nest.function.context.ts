import { useJestFunctionFixture } from "@dereekb/util/test";
import { NestApplicationRunnableHttpFunctionFactory } from "@dereekb/firebase-server";
import { FirebaseAdminFunctionNestTestContext, wrapCloudFunctionForNestTestsGetter } from "./firebase.admin.nest.function";
import { WrappedCloudFunctionV1 } from "./firebase.function";

// MARK: V1
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
export function cloudFunctionTest<I>(config: CloudFunctionTestConfig<I>, buildTests: (fn: WrappedCloudFunctionV1<I>) => void) {
  const { f, fn } = config;

  useJestFunctionFixture<WrappedCloudFunctionV1<I>>({
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
export function describeCloudFunctionTest<I>(label: string, config: CloudFunctionTestConfig<I>, buildTests: (fn: WrappedCloudFunctionV1<I>) => void) {
  describe(label, () => {
    cloudFunctionTest(config, buildTests);
  });
}

// MARK: V2
// TODO
