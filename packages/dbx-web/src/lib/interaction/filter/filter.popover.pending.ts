import { type DestroyFunction, type Milliseconds, waitForMs } from '@dereekb/util';

/**
 * Applies a change that filter popover content has not applied yet. The returned promise resolves once the change is applied, or once there was nothing to apply.
 */
export type DbxFilterPopoverApplyPendingFunction = () => Promise<void>;

/**
 * Provided by a filter popover to its filter content, so the content can apply a pending change before the popover closes.
 *
 * Inject it optionally; content that is not rendered inside a filter popover gets nothing.
 */
export abstract class DbxFilterPopoverPendingChanges {
  /**
   * Registers a function that is awaited before the popover closes on its close button, on a filter change or on a click outside.
   *
   * @param applyPending - Function that applies the pending change.
   * @returns Removes the registration when called.
   */
  abstract registerApplyPending(applyPending: DbxFilterPopoverApplyPendingFunction): DestroyFunction;
}

/**
 * Default maximum time a filter popover waits for its registered {@link DbxFilterPopoverApplyPendingFunction}s before it closes anyway.
 */
export const DBX_FILTER_POPOVER_APPLY_PENDING_MAX_WAIT: Milliseconds = 3000;

/**
 * Registry of {@link DbxFilterPopoverApplyPendingFunction}s used by a filter popover.
 */
export class DbxFilterPopoverPendingChangesInstance implements DbxFilterPopoverPendingChanges {
  private readonly _applyPendingFunctions = new Set<DbxFilterPopoverApplyPendingFunction>();

  constructor(readonly maxWait: Milliseconds = DBX_FILTER_POPOVER_APPLY_PENDING_MAX_WAIT) {}

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
   * Runs every registered function and resolves once all of them have finished, or once {@link maxWait} has passed.
   *
   * @returns Resolves once the pending changes have been applied or the wait has timed out.
   */
  applyPending(): Promise<void> {
    // a function that fails still counts as finished, so a broken apply never keeps the popover open
    const applyAll = Promise.all(Array.from(this._applyPendingFunctions).map((x) => x().catch(() => undefined)));
    return Promise.race([applyAll, waitForMs(this.maxWait)]).then(() => undefined);
  }
}
