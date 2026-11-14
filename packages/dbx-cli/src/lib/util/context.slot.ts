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
  /**
   * Opt-in process-wide key. When set, the value lives on `globalThis` under `Symbol.for(globalKey)` instead of in
   * this module, so every copy of the module in the process — a plugin that bundled its own copy of a CLI library,
   * say — reads and writes the same slot. Leave it unset for a slot private to this module copy.
   */
  readonly globalKey?: string;
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
  const globalKey = input?.globalKey;
  const symbol = globalKey == null ? undefined : Symbol.for(globalKey);
  const globalStore = globalThis as unknown as Record<symbol, Maybe<T>>;

  const get = (): Maybe<T> => (symbol == null ? _value : globalStore[symbol]);

  return {
    set: (value) => {
      if (symbol == null) {
        _value = value;
      } else {
        globalStore[symbol] = value;
      }
    },
    get,
    require: () => {
      const value = get();

      if (value == null) {
        throw new Error(notInitializedMessage);
      }

      return value;
    }
  };
}
