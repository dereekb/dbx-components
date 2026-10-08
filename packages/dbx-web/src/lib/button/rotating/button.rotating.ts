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
   * to, so the first click always changes the resolved value. The skipped state is visited last instead, so the button still
   * rotates through every state before returning to where it started. See {@link dbxRotatingButtonRotationOrder}. False by default.
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
 * Returns the order the states rotate in, as indexes of the config's states.
 *
 * This is the configured order, unless `skipDefaultEquivalent` is true, the config has a `defaultState`, and the move from the
 * state matching the value is between the default state and the state it resolves to, which would not change the resolved value.
 * That move is then skipped, and the skipped state is visited last instead, just before returning to the state matching the value.
 * For example, a tristate whose default resolves to On rotates Default -> Off -> On -> Default. With only two states, or a value
 * that matches no state, the configured order is returned.
 *
 * @param config - The rotating button configuration.
 * @param value - The current value, where the rotation starts.
 * @param skipDefaultEquivalent - Whether to skip the move between the default state and its equivalent state.
 * @returns The state indexes in rotation order.
 */
export function dbxRotatingButtonRotationOrder<T>(config: Pick<DbxRotatingButtonConfig<T>, 'states' | 'isEqual' | 'defaultState'>, value: Maybe<T>, skipDefaultEquivalent?: Maybe<boolean>): number[] {
  const { states, defaultState } = config;
  const isEqual = config.isEqual ?? isEqualDbxRotatingButtonValue;
  const count = states.length;
  const index = dbxRotatingButtonStateIndex(config, value);
  let rotationOrder = states.map((_, i) => i);

  if (skipDefaultEquivalent && defaultState && index !== -1 && count > 2) {
    const skippedIndex = (index + 1) % count;
    const currentValue = states[index].value;
    const nextValue = states[skippedIndex].value;
    const isDefaultToEquivalent = isEqual(currentValue, defaultState.value) && isEqual(nextValue, defaultState.equivalentValue);
    const isEquivalentToDefault = isEqual(currentValue, defaultState.equivalentValue) && isEqual(nextValue, defaultState.value);

    if (isDefaultToEquivalent || isEquivalentToDefault) {
      // start at the current state, visit the states after the skipped state, then the skipped state
      rotationOrder = [index, ...Array.from({ length: count - 2 }, (_, i) => (index + 2 + i) % count), skippedIndex];
    }
  }

  return rotationOrder;
}

/**
 * Returns the state after the state matching the value in the rotation order, wrapping back to the start. A value that matches
 * no state starts at the first state.
 *
 * @param config - The rotating button configuration.
 * @param value - The current value.
 * @param rotationOrder - The state indexes in rotation order, from {@link dbxRotatingButtonRotationOrder}. Defaults to the configured order.
 * @returns The next state, or undefined if there are no states.
 */
export function nextDbxRotatingButtonState<T>(config: Pick<DbxRotatingButtonConfig<T>, 'states' | 'isEqual'>, value: Maybe<T>, rotationOrder?: Maybe<readonly number[]>): Maybe<DbxRotatingButtonState<T>> {
  const { states } = config;
  const index = dbxRotatingButtonStateIndex(config, value);
  let nextState: Maybe<DbxRotatingButtonState<T>>;

  if (index === -1 || !rotationOrder?.length) {
    nextState = states.length ? states[(index + 1) % states.length] : undefined;
  } else {
    const position = rotationOrder.indexOf(index);
    nextState = states[rotationOrder[(position + 1) % rotationOrder.length]];
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
