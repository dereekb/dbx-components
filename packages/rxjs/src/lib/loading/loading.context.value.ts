import { SimpleLoadingContext } from './loading.context.simple';

export type LoadingContextCheckCompletionFunction = () => any[];

export interface LoadingContextConfiguration {
  loading?: boolean;
  checkDone?: LoadingContextCheckCompletionFunction;
}

/**
 * Utility object for maintaining a loading stream$. Is triggered into loading, then can be triggered again to see if elements have all completed loading or not.
 */
export class ValuesLoadingContext extends SimpleLoadingContext {

  private _checkDone?: LoadingContextCheckCompletionFunction;

  constructor({ checkDone, loading = true }: LoadingContextConfiguration = {}) {
    super(loading);
    this._checkDone = checkDone;
  }

  /**
   * Check the array for objects to see if loading is completed.
   *
   * The loading state is always modified unless there is an error or no check function.
   */
  public check(): void {
    if (!this.hasError()) {
      if (this._checkDone) {
        const checkArray = this._checkDone();
        let loading = true;

        if (checkArray.length > 0) {
          const checkResult = checkArray.filter((x) => x === undefined);  // If any are undefined, still loading.
          loading = (checkResult.length > 0);
        }

        this.setLoading(loading);
      } else {
        throw new Error('Attempted to check without a check function set.');
      }
    }
  }

}
