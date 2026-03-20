import { type FactoryWithRequiredInput } from '../getter/getter';
import { type Maybe } from '../value/maybe.type';

/**
 * A function that tries an array of Promise factories one after another until one
 * produces a successful result. Returns `undefined` if none succeed.
 *
 * @param input - The input to pass to each factory.
 * @param config - Optional per-call configuration overrides.
 * @returns The first successful value, or `undefined` if no factory succeeds.
 */
export type TryWithPromiseFactoriesFunction<I, O> = (input: I, config?: TryWithPromiseFactoriesFunctionOptionalConfig<I, O>) => Promise<Maybe<O>>;

/**
 * Optional per-call configuration for {@link TryWithPromiseFactoriesFunction}.
 */
export interface TryWithPromiseFactoriesFunctionOptionalConfig<I, O> {
  /**
   * Whether or not to return a Maybe value if it is returned by one of the created promises.
   *
   * Defaults to false.
   */
  readonly successOnMaybe?: boolean;
  /**
   * Whether or not to throw errors.
   *
   * Defaults to false.
   */
  readonly throwErrors?: boolean;
}

/**
 * Configuration for creating a {@link TryWithPromiseFactoriesFunction} via {@link tryWithPromiseFactoriesFunction}.
 */
export interface TryWithPromiseFactoriesFunctionConfig<I, O> extends TryWithPromiseFactoriesFunctionOptionalConfig<I, O> {
  /**
   * Factories used to create new Promise valeus to test.
   *
   * Promises are generated one at a time.
   *
   * I.E. if the first factory's generated promise returns a non-successful value or throws an error, the next promise will be generated and tried.
   */
  readonly promiseFactories: FactoryWithRequiredInput<Promise<Maybe<O>>, I>[];
}

/**
 * Creates a {@link TryWithPromiseFactoriesFunction} that sequentially tries each promise factory
 * until one returns a non-null value (or a Maybe value if `successOnMaybe` is true).
 *
 * @param config - Configuration including the array of promise factories and default behavior options.
 * @returns A function that tries each factory in order for a given input.
 */
export function tryWithPromiseFactoriesFunction<I, O>(config: TryWithPromiseFactoriesFunctionConfig<I, O>): TryWithPromiseFactoriesFunction<I, O> {
  const { promiseFactories, successOnMaybe: defaultSuccessOnMaybe, throwErrors: defaultThrowErrors } = config;

  return async (input: I, config?: TryWithPromiseFactoriesFunctionOptionalConfig<I, O>) => {
    const { successOnMaybe: inputSuccessOnMaybe, throwErrors: inputThrowErrors } = config ?? {};
    const successOnMaybe = inputSuccessOnMaybe ?? defaultSuccessOnMaybe;
    const throwErrors = inputThrowErrors ?? defaultThrowErrors;

    let result: Maybe<O>;

    for (const factory of promiseFactories) {
      try {
        const nextPromise = factory(input);
        result = await nextPromise;

        if (result != null || successOnMaybe) {
          break; // end loop early
        }
      } catch (e) {
        if (throwErrors) {
          throw e; // throw the error if requested
        }
      }
    }

    return result;
  };
}
