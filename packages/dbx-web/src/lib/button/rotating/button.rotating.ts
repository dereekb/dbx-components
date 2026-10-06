import { type Maybe } from '@dereekb/util';
import { type DbxButtonDisplayStylePair, type DbxButtonStyle } from '../button';

/**
 * A single state of a {@link DbxRotatingButtonDirective}.
 *
 * The `display` (icon/text) and `style` (color, type, …) are applied to the host `dbx-button` while the state is active.
 */
export interface DbxRotatingButtonState<T> extends DbxButtonDisplayStylePair {
  /**
   * Value the state represents.
   */
  readonly value: T;
  /**
   * Label for the state, e.g. "On". Used in the button's aria-label ("{label}: {state label}") and the change announcement.
   */
  readonly label?: Maybe<string>;
  /**
   * What the state is equivalent to, when that differs from its value. For example, a "Default" state whose value is
   * `null` but that resolves to `true`. Defaults to the state's `value`.
   *
   * Used by {@link DbxRotatingButtonConfig.skipEquivalentStatesOnFirstClick}.
   */
  readonly equivalentValue?: unknown;
}

/**
 * Function that compares two rotating button values.
 */
export type DbxRotatingButtonValueIsEqualFunction<T> = (a: Maybe<T>, b: Maybe<T>) => boolean;

/**
 * Configuration for a {@link DbxRotatingButtonDirective}.
 */
export interface DbxRotatingButtonConfig<T> {
  /**
   * States to rotate through, in order. Each click moves to the next state, wrapping back to the first.
   */
  readonly states: DbxRotatingButtonState<T>[];
  /**
   * Label for the thing being changed, e.g. "Email". Prefixes the state label in the aria-label and announcements.
   */
  readonly label?: Maybe<string>;
  /**
   * Base style for every state. Each state's `style` is merged over it.
   *
   * The directive sets the button's `buttonStyle`, so pass the base style here instead of binding `buttonStyle` on the button.
   */
  readonly style?: Maybe<DbxButtonStyle>;
  /**
   * Whether to announce each change through the LiveAnnouncer. True by default.
   */
  readonly announceChanges?: Maybe<boolean>;
  /**
   * Compares values to find the current state. Defaults to {@link isEqualDbxRotatingButtonValue}.
   */
  readonly isEqual?: Maybe<DbxRotatingButtonValueIsEqualFunction<T>>;
  /**
   * Whether the first click skips states whose {@link DbxRotatingButtonState.equivalentValue} matches the current state's,
   * so the first click always visibly changes the value. Later clicks rotate through every state. False by default.
   */
  readonly skipEquivalentStatesOnFirstClick?: Maybe<boolean>;
}

/**
 * Default value comparison for a {@link DbxRotatingButtonConfig}. Strict equality, treating `null` and `undefined` as equal.
 *
 * @param a - The first value.
 * @param b - The second value.
 * @returns True if the values are equal.
 */
export function isEqualDbxRotatingButtonValue<T>(a: Maybe<T>, b: Maybe<T>): boolean {
  return (a ?? null) === (b ?? null);
}

/**
 * Returns the index of the state that matches the value, or -1 if no state matches.
 *
 * @param config - The rotating button configuration.
 * @param value - The value to find.
 * @returns The index of the matching state, or -1.
 */
export function dbxRotatingButtonStateIndex<T>(config: Pick<DbxRotatingButtonConfig<T>, 'states' | 'isEqual'>, value: Maybe<T>): number {
  const isEqual = config.isEqual ?? isEqualDbxRotatingButtonValue;
  return config.states.findIndex((state) => isEqual(state.value, value));
}

/**
 * Returns what a state is equivalent to: its `equivalentValue`, or its `value` when that is not set.
 *
 * @param state - The rotating button state.
 * @returns The state's equivalent value.
 */
export function dbxRotatingButtonStateEquivalentValue<T>(state: DbxRotatingButtonState<T>): unknown {
  return state.equivalentValue === undefined ? state.value : state.equivalentValue;
}

/**
 * Returns the state after the state matching the value, wrapping back to the first state. A value that matches no state
 * starts at the first state.
 *
 * When `skipEquivalentStates` is true, states equivalent to the current state are skipped, so the returned state always
 * changes the equivalent value. If every other state is equivalent, the next state is returned.
 *
 * @param config - The rotating button configuration.
 * @param value - The current value.
 * @param skipEquivalentStates - Whether to skip states equivalent to the current state.
 * @returns The next state, or undefined if there are no states.
 */
export function nextDbxRotatingButtonState<T>(config: Pick<DbxRotatingButtonConfig<T>, 'states' | 'isEqual'>, value: Maybe<T>, skipEquivalentStates?: Maybe<boolean>): Maybe<DbxRotatingButtonState<T>> {
  const { states } = config;
  const index = dbxRotatingButtonStateIndex(config, value);
  let nextState: Maybe<DbxRotatingButtonState<T>> = states.length ? states[(index + 1) % states.length] : undefined;

  if (skipEquivalentStates && index !== -1) {
    const currentEquivalentValue = dbxRotatingButtonStateEquivalentValue(states[index]) ?? null;
    const followingStates = Array.from({ length: states.length - 1 }, (_, i) => states[(index + i + 1) % states.length]);
    nextState = followingStates.find((state) => (dbxRotatingButtonStateEquivalentValue(state) ?? null) !== currentEquivalentValue) ?? nextState;
  }

  return nextState;
}

/**
 * Returns the aria-label for a rotating button state: "{label}: {state label}", or whichever of the two is set.
 *
 * @param label - The rotating button label.
 * @param state - The current state.
 * @returns The aria-label, or undefined if neither label is set.
 */
export function dbxRotatingButtonAriaLabel<T>(label: Maybe<string>, state: Maybe<DbxRotatingButtonState<T>>): Maybe<string> {
  const stateLabel = state?.label;
  return label && stateLabel ? `${label}: ${stateLabel}` : (label ?? stateLabel ?? undefined);
}
