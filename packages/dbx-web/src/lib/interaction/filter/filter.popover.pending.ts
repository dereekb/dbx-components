import { type DestroyFunction, type Maybe } from '@dereekb/util';

/**
 * Applies a change that filter popover content has not applied yet. Runs synchronously, right before the popover closes and destroys the content.
 */
export type DbxFilterPopoverApplyPendingFunction = () => void;

/**
 * Provided by a filter popover to its filter content, so the content can apply a pending change before the popover closes.
 *
 * Inject it optionally; content that is not rendered inside a filter popover gets nothing.
 */
export abstract class DbxFilterPopoverPendingChanges {
  /**
   * Registers a function that is called before the popover closes on its close button, on a filter change, on a transition or on a click outside.
   *
   * @param applyPending - Function that applies the pending change.
   * @returns Removes the registration when called.
   */
  abstract registerApplyPending(applyPending: DbxFilterPopoverApplyPendingFunction): DestroyFunction;
}

/**
 * Registry of {@link DbxFilterPopoverApplyPendingFunction}s used by a filter popover.
 */
export class DbxFilterPopoverPendingChangesInstance implements DbxFilterPopoverPendingChanges {
  private readonly _applyPendingFunctions = new Set<DbxFilterPopoverApplyPendingFunction>();

  /**
   * @param handleError - Receives an error thrown by a registered function. The remaining functions still run.
   */
  constructor(readonly handleError?: Maybe<(error: unknown) => void>) {}

  /**
   * Whether or not at least one function is registered.
   *
   * @returns `true` while at least one function is registered.
   */
  get hasApplyPending(): boolean {
    return this._applyPendingFunctions.size > 0;
  }

  registerApplyPending(applyPending: DbxFilterPopoverApplyPendingFunction): DestroyFunction {
    this._applyPendingFunctions.add(applyPending);

    return () => {
      this._applyPendingFunctions.delete(applyPending);
    };
  }

  /**
   * Runs every registered function.
   */
  applyPending(): void {
    // a function that fails does not stop the others, so a broken apply never keeps the popover open
    Array.from(this._applyPendingFunctions).forEach((applyPending) => {
      try {
        applyPending();
      } catch (error) {
        this.handleError?.(error);
      }
    });
  }
}
