import { SimpleLoadingContext } from './loading.context.simple';

/**
 * Function that returns an array of values to check for completion.
 * If any element is `undefined`, the check considers loading to still be in progress.
 */
export type LoadingContextCheckCompletionFunction = () => unknown[];

/**
 * Configuration for {@link ValuesLoadingContext}.
 */
export interface LoadingContextConfiguration {
  /**
   * Initial loading state. Defaults to `true`.
   */
  loading?: boolean;
  /**
   * Function that returns values to check for loading completion.
   */
  checkDone?: LoadingContextCheckCompletionFunction;
}

/**
 * A {@link SimpleLoadingContext} that determines loading completion by checking whether
 * all values returned by a check function are defined.
 *
 * Useful when loading depends on multiple values arriving asynchronously — call {@link check}
 * to re-evaluate whether all required values are present.
 *
 * @example
 * ```ts
 * let valueA: string | undefined;
 * let valueB: string | undefined;
 *
 * const context = new ValuesLoadingContext({
 *   checkDone: () => [valueA, valueB]
 * });
 * // context.stream$ emits { loading: true }
 *
 * valueA = 'hello';
 * context.check(); // still loading (valueB is undefined)
 *
 * valueB = 'world';
 * context.check(); // loading complete (both defined)
 * // context.stream$ emits { loading: false }
 *
 * context.destroy();
 * ```
 */
export class ValuesLoadingContext extends SimpleLoadingContext {
  private _checkDone?: LoadingContextCheckCompletionFunction;

  constructor({ checkDone, loading = true }: LoadingContextConfiguration = {}) {
    super(loading);
    this._checkDone = checkDone;
  }

  /**
   * Re-evaluates the check function to determine whether all values are loaded.
   *
   * Sets loading to `false` when every element in the check array is defined.
   * Does nothing if the context currently has an error.
   *
   * @throws {Error} When no check function was provided in the constructor configuration.
   */
  public check(): void {
    if (!this.hasError()) {
      if (this._checkDone) {
        const checkArray = this._checkDone();
        let loading = true;

        if (checkArray.length > 0) {
          const checkResult = checkArray.filter((x) => x === undefined); // If any are undefined, still loading.
          loading = checkResult.length > 0;
        }

        this.setLoading(loading);
      } else {
        throw new Error('Attempted to check without a check function set.');
      }
    }
  }
}
