import { type Maybe } from '@dereekb/util';

/**
 * Module-level slot for a single value of type `T`.
 *
 * Used to bridge yargs middleware (which assigns to argv) and command handlers (which read the
 * value) without having to thread the context through `argv` (where yargs strict mode would flag
 * unknown keys).
 */
export interface ContextSlot<T> {
  /**
   * Assigns the slot to `value` (or clears it if `null`/`undefined` is passed).
   */
  set(value: Maybe<T>): void;
  /**
   * Returns the current slot value, or `undefined` when unset.
   */
  get(): Maybe<T>;
  /**
   * Returns the current slot value, or throws when unset. Use this from command handlers that
   * require the auth middleware to have run.
   */
  require(): T;
}

export interface CreateContextSlotInput {
  /**
   * Custom error message thrown by {@link ContextSlot.require} when the slot is unset. Defaults
   * to a generic "context slot has not been initialized" message.
   */
  readonly notInitializedMessage?: string;
}

/**
 * Creates a typed module-level slot.
 *
 * Each CLI exposes its current per-invocation context (auth tokens, API clients, env config, ...)
 * via a slot so command handlers can read it without yargs strict-mode flagging unknown argv keys.
 *
 * Usage:
 * ```ts
 * const slot = createContextSlot<MyCliContext>({ notInitializedMessage: 'Auth middleware did not run.' });
 * // in middleware:
 * slot.set(buildContext(...));
 * // in handler:
 * const ctx = slot.require();
 * ```
 *
 * @param input - Optional slot configuration.
 * @param input.notInitializedMessage - Custom error message thrown by `require()` when the slot is unset.
 * @returns A new {@link ContextSlot} for type `T`.
 * @__NO_SIDE_EFFECTS__
 */
export function createContextSlot<T>(input?: CreateContextSlotInput): ContextSlot<T> {
  let _value: Maybe<T>;
  const notInitializedMessage = input?.notInitializedMessage ?? 'Context slot has not been initialized.';

  return {
    set: (value) => {
      _value = value;
    },
    get: () => _value,
    require: () => {
      if (_value == null) {
        throw new Error(notInitializedMessage);
      }

      return _value;
    }
  };
}
