import { FactoryWithInput, FactoryWithRequiredInput } from '../getter/getter';
import { Maybe } from '../value/maybe.type';

/**
 * Function that uses an array of Factories to produce Promises, one after the other, to attempt to return the value.
 *
 * Returns a Maybe value of the expected output, and returns null if no factory/promise returns the intended value.
 */
export type TryWithPromiseFactoriesFunction<I, O> = (input: I, config?: TryWithPromiseFactoriesFunctionOptionalConfig<I, O>) => Promise<Maybe<O>>;

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

export function tryWithPromiseFactoriesFunction<I, O>(config: TryWithPromiseFactoriesFunctionConfig<I, O>): TryWithPromiseFactoriesFunction<I, O> {
  const { promiseFactories, successOnMaybe: defaultSuccessOnMaybe, throwErrors: defaultThrowErrors } = config;

  return async (input: I, config?: TryWithPromiseFactoriesFunctionOptionalConfig<I, O>) => {
    const { successOnMaybe: inputSuccessOnMaybe, throwErrors: inputThrowErrors } = config ?? {};
    const successOnMaybe = inputSuccessOnMaybe ?? defaultSuccessOnMaybe;
    const throwErrors = inputThrowErrors ?? defaultThrowErrors;

    let result: Maybe<O>;

    for (let i = 0; i < promiseFactories.length; i += 1) {
      try {
        const nextPromise = promiseFactories[i](input);
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
