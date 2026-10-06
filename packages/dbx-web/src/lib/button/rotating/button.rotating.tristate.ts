import { type Maybe } from '@dereekb/util';
import { type DbxButtonStyle } from '../button';
import { type DbxRotatingButtonConfig, type DbxRotatingButtonDefaultState, type DbxRotatingButtonState } from './button.rotating';

/**
 * Value of a three-state / 3-phase (default/on/off) choice.
 *
 * - `true` — explicitly on
 * - `false` — explicitly off
 * - `null`/`undefined` — no explicit choice; resolves to the default. Emitted as `null`, which means "clear".
 */
export type DbxTristateValue = Maybe<boolean>;

/**
 * Display state of a {@link DbxTristateValue}.
 */
export type DbxTristateState = 'on' | 'off' | 'default';

/**
 * Default icon for the explicit "on" state.
 */
export const DEFAULT_DBX_TRISTATE_ON_ICON = 'check_circle';

/**
 * Default icon for the explicit "off" state.
 */
export const DEFAULT_DBX_TRISTATE_OFF_ICON = 'block';

/**
 * Icon for the "default" state when the default value is unknown.
 */
export const DEFAULT_DBX_TRISTATE_UNKNOWN_DEFAULT_ICON = 'radio_button_unchecked';

/**
 * Default color for the explicit "on" state.
 */
export const DEFAULT_DBX_TRISTATE_ON_COLOR: DbxButtonStyle['color'] = 'primary';

/**
 * Default color for the explicit "off" state.
 */
export const DEFAULT_DBX_TRISTATE_OFF_COLOR: DbxButtonStyle['color'] = 'warn';

/**
 * Returns the display state for the input value.
 *
 * @param value - The tristate value.
 * @returns `'on'`, `'off'` or `'default'`.
 */
export function dbxTristateState(value: DbxTristateValue): DbxTristateState {
  let state: DbxTristateState;

  if (value === true) {
    state = 'on';
  } else if (value === false) {
    state = 'off';
  } else {
    state = 'default';
  }

  return state;
}

/**
 * Returns the effective value, resolving the default state to the default value.
 *
 * @param value - The tristate value.
 * @param defaultValue - What the default state resolves to.
 * @returns The effective value, or undefined if the value is the default and the default is unknown.
 */
export function dbxTristateEffectiveValue(value: DbxTristateValue, defaultValue?: Maybe<boolean>): Maybe<boolean> {
  return value ?? defaultValue;
}

/**
 * Rotation order of a tristate value: default, then on, then off.
 *
 * The first click skips moving between the default state and the state it resolves to (see
 * {@link DbxTristateRotatingButtonConfigInput.skipDefaultEquivalentOnFirstClick}), so it always flips the effective value;
 * later clicks follow this order.
 */
export const DBX_TRISTATE_CYCLE: readonly DbxTristateValue[] = [null, true, false];

/**
 * Per-state display configuration for {@link dbxTristateRotatingButtonConfig}.
 */
export interface DbxTristateStateDisplayConfig {
  /**
   * Icon to show for the state.
   */
  readonly icon?: Maybe<string>;
  /**
   * Label for the state.
   */
  readonly label?: Maybe<string>;
  /**
   * Color of the button for the state.
   */
  readonly color?: DbxButtonStyle['color'];
}

/**
 * Input for {@link dbxTristateStateLabel}.
 */
export interface DbxTristateStateLabelInput {
  /**
   * The current value.
   */
  readonly value: DbxTristateValue;
  /**
   * What the default state resolves to.
   */
  readonly defaultValue?: Maybe<boolean>;
  /**
   * Per-state label overrides.
   */
  readonly on?: Maybe<Pick<DbxTristateStateDisplayConfig, 'label'>>;
  readonly off?: Maybe<Pick<DbxTristateStateDisplayConfig, 'label'>>;
  readonly default?: Maybe<Pick<DbxTristateStateDisplayConfig, 'label'>>;
}

/**
 * Returns the label for the state of a tristate value: `On`, `Off`, `Default (On)`, `Default (Off)` or `Default`.
 *
 * @param input - The current value, default value and per-state labels.
 * @returns The state label.
 */
export function dbxTristateStateLabel(input: DbxTristateStateLabelInput): string {
  const { value, defaultValue } = input;
  const onLabel = input.on?.label ?? 'On';
  const offLabel = input.off?.label ?? 'Off';
  let label: string;

  switch (dbxTristateState(value)) {
    case 'on':
      label = onLabel;
      break;
    case 'off':
      label = offLabel;
      break;
    default: {
      const defaultLabel = input.default?.label ?? 'Default';
      const resolvedLabel = defaultValue ? onLabel : offLabel;
      label = defaultValue == null ? defaultLabel : `${defaultLabel} (${resolvedLabel})`;
      break;
    }
  }

  return label;
}

/**
 * Input for {@link dbxTristateRotatingButtonConfig}.
 */
export interface DbxTristateRotatingButtonConfigInput {
  /**
   * Label for the thing being changed, e.g. "Email".
   */
  readonly label?: Maybe<string>;
  /**
   * What the default state resolves to.
   */
  readonly defaultValue?: Maybe<boolean>;
  /**
   * Display for the explicit "on" state.
   */
  readonly on?: Maybe<DbxTristateStateDisplayConfig>;
  /**
   * Display for the explicit "off" state.
   */
  readonly off?: Maybe<DbxTristateStateDisplayConfig>;
  /**
   * Display for the default state. The icon defaults to the resolved on/off icon, with no color.
   */
  readonly default?: Maybe<DbxTristateStateDisplayConfig>;
  /**
   * Base button style for every state.
   */
  readonly style?: Maybe<DbxButtonStyle>;
  /**
   * Whether to announce each change through the LiveAnnouncer. True by default.
   */
  readonly announceChanges?: Maybe<boolean>;
  /**
   * Whether the first click skips moving between the default state and the state it resolves to, such as from "Default (On)"
   * to "On", so the first click always flips the effective value. Has no effect when the default value is unknown. True by default.
   */
  readonly skipDefaultEquivalentOnFirstClick?: Maybe<boolean>;
}

/**
 * Creates a {@link DbxRotatingButtonConfig} for a three-state / 3-phase (default/on/off) toggle.
 *
 * The states rotate in {@link DBX_TRISTATE_CYCLE} order (default, on, off). A known default value sets the config's
 * `defaultState`, so by default the first click skips the state that would look like no change. Explicit choices are
 * colored; the default state shows the resolved on/off icon without a color.
 *
 * @param input - The labels, default value and per-state display.
 * @returns A rotating button configuration whose default state has the value `null`.
 *
 * @example
 * ```ts
 * const config = dbxTristateRotatingButtonConfig({ label: 'Text', defaultValue: false });
 * ```
 */
export function dbxTristateRotatingButtonConfig(input: DbxTristateRotatingButtonConfigInput): DbxRotatingButtonConfig<DbxTristateValue> {
  const { label, defaultValue, on, off, style, announceChanges, skipDefaultEquivalentOnFirstClick } = input;
  const onIcon = on?.icon ?? DEFAULT_DBX_TRISTATE_ON_ICON;
  const offIcon = off?.icon ?? DEFAULT_DBX_TRISTATE_OFF_ICON;
  let resolvedDefaultIcon: string;

  if (defaultValue == null) {
    resolvedDefaultIcon = DEFAULT_DBX_TRISTATE_UNKNOWN_DEFAULT_ICON;
  } else {
    resolvedDefaultIcon = defaultValue ? onIcon : offIcon;
  }

  const states: DbxRotatingButtonState<DbxTristateValue>[] = DBX_TRISTATE_CYCLE.map((value) => {
    let icon: string;
    let color: DbxButtonStyle['color'];

    switch (dbxTristateState(value)) {
      case 'on':
        icon = onIcon;
        color = on?.color ?? DEFAULT_DBX_TRISTATE_ON_COLOR;
        break;
      case 'off':
        icon = offIcon;
        color = off?.color ?? DEFAULT_DBX_TRISTATE_OFF_COLOR;
        break;
      default:
        icon = input.default?.icon ?? resolvedDefaultIcon;
        color = input.default?.color;
        break;
    }

    return {
      value,
      label: dbxTristateStateLabel({ value, defaultValue, on, off, default: input.default }),
      display: { icon },
      style: { color }
    };
  });

  // an unknown default resolves to neither on nor off
  const defaultState: Maybe<DbxRotatingButtonDefaultState<DbxTristateValue>> = defaultValue == null ? undefined : { value: null, equivalentValue: defaultValue };

  return { states, label, style, announceChanges, defaultState, skipDefaultEquivalentOnFirstClick: skipDefaultEquivalentOnFirstClick ?? true };
}
