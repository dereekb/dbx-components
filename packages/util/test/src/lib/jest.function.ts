import { forwardFunction, Getter } from "@dereekb/util";

export interface UseJestFunctionFixture<I extends (...args: any[]) => O, O = any> {
  fn: Getter<I>;
}

export type JestFunctionFixtureBuildTests<I> = (fn: I) => void;

/**
 * Creates a test context and jest configurations that provides a function to build tests based on the configuration.
 */
export function useJestFunctionFixture<I extends (...args: any[]) => O, O = any>(config: UseJestFunctionFixture<I, O>, buildTests: JestFunctionFixtureBuildTests<I>): void {
  const { fn } = config;

  const forward = forwardFunction(fn);
  buildTests(forward);
}
