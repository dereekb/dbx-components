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
}

/**
 * Identifies the "Default" state of a {@link DbxRotatingButtonConfig} and the state it resolves to. For example, a tristate
 * "Default" state whose value is `null` but that resolves to On (`true`).
 */
export interface DbxRotatingButtonDefaultState<T> {
  /**
   * Value of the default state.
   */
  readonly value: T;
  /**
   * Value of the state the default state resolves to.
   */
  readonly equivalentValue: T;
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
   * The default state and the state it resolves to. Used by {@link DbxRotatingButtonConfig.skipDefaultEquivalentOnFirstClick}.
   */
  readonly defaultState?: Maybe<DbxRotatingButtonDefaultState<T>>;
  /**
   * Whether the first click skips moving between the {@link DbxRotatingButtonConfig.defaultState} and the state it resolves
   * to, so the first click always changes the resolved value. Later clicks rotate through every state. False by default.
   */
  readonly skipDefaultEquivalentOnFirstClick?: Maybe<boolean>;
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
 * Returns the state after the state matching the value, wrapping back to the first state. A value that matches no state
 * starts at the first state.
 *
 * When `skipDefaultEquivalent` is true and the config has a `defaultState`, moving from the default state to the state it
 * resolves to (or from that state to the default state) skips ahead one more state, since that move would not change the
 * resolved value. With only two states, the next state is returned.
 *
 * @param config - The rotating button configuration.
 * @param value - The current value.
 * @param skipDefaultEquivalent - Whether to skip the state equivalent to the default state.
 * @returns The next state, or undefined if there are no states.
 */
export function nextDbxRotatingButtonState<T>(config: Pick<DbxRotatingButtonConfig<T>, 'states' | 'isEqual' | 'defaultState'>, value: Maybe<T>, skipDefaultEquivalent?: Maybe<boolean>): Maybe<DbxRotatingButtonState<T>> {
  const { states, defaultState } = config;
  const isEqual = config.isEqual ?? isEqualDbxRotatingButtonValue;
  const index = dbxRotatingButtonStateIndex(config, value);
  let nextState: Maybe<DbxRotatingButtonState<T>> = states.length ? states[(index + 1) % states.length] : undefined;

  if (skipDefaultEquivalent && defaultState && nextState && index !== -1 && states.length > 2) {
    const currentValue = states[index].value;
    const nextValue = nextState.value;
    const isDefaultToEquivalent = isEqual(currentValue, defaultState.value) && isEqual(nextValue, defaultState.equivalentValue);
    const isEquivalentToDefault = isEqual(currentValue, defaultState.equivalentValue) && isEqual(nextValue, defaultState.value);

    if (isDefaultToEquivalent || isEquivalentToDefault) {
      nextState = states[(index + 2) % states.length];
    }
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
