import { type Getter, type Maybe, type Milliseconds, type Pixels, type Vector } from '@dereekb/util';
import type * as MapboxGl from 'mapbox-gl';

// MARK: Config
/**
 * Default time the pointer must be held still for a long press to fire.
 */
export const DEFAULT_MAPBOX_LONG_PRESS_DURATION: Milliseconds = 2000;

/**
 * Default distance the pointer may drift from where the press started before the press is cancelled.
 *
 * Larger than mapbox's 3px click tolerance, since a held finger drifts more than a clicked mouse.
 */
export const DEFAULT_MAPBOX_LONG_PRESS_TOLERANCE: Pixels = 10;

/**
 * How long after touch activity mouse events are ignored.
 *
 * Browsers send compatibility ("ghost") mouse events after a touch, which must not start a second, mouse press.
 */
export const DBX_MAPBOX_LONG_PRESS_TOUCH_MOUSE_GUARD_TIME: Milliseconds = 1000;

/**
 * The {@link DbxMapboxLongPressEvent} type value.
 */
export const DBX_MAPBOX_LONG_PRESS_EVENT_TYPE = 'longpress';

/**
 * What the long press was made with.
 */
export type DbxMapboxLongPressSource = 'touch' | 'mouse';

/**
 * Configures the long press that opens the map's right-click menu.
 */
export interface DbxMapboxLongPressConfig {
  /**
   * How long the pointer must be held still. Defaults to {@link DEFAULT_MAPBOX_LONG_PRESS_DURATION}.
   */
  readonly duration?: Maybe<Milliseconds>;
  /**
   * How far the pointer may move from where the press started. Defaults to {@link DEFAULT_MAPBOX_LONG_PRESS_TOLERANCE}.
   */
  readonly tolerance?: Maybe<Pixels>;
  /**
   * Whether holding the left mouse button also counts, not only a touch. Defaults to true.
   */
  readonly mouse?: Maybe<boolean>;
}

/**
 * A {@link DbxMapboxLongPressConfig}, or false to turn the long press off.
 */
export type DbxMapboxLongPressConfigInput = Maybe<DbxMapboxLongPressConfig | false>;

/**
 * A {@link DbxMapboxLongPressConfig} with every default applied.
 */
export interface DbxMapboxResolvedLongPressConfig {
  readonly duration: Milliseconds;
  readonly tolerance: Pixels;
  readonly mouse: boolean;
}

export interface ResolveDbxMapboxLongPressConfigInput {
  /**
   * Config that takes precedence, such as one set on a single map's store.
   *
   * False turns the long press off. A config is merged over the base, and turns the long press on even when the base is false. Unset falls back to the base.
   */
  readonly override?: DbxMapboxLongPressConfigInput;
  /**
   * The app-wide config. False turns the long press off; unset uses the defaults.
   */
  readonly base?: DbxMapboxLongPressConfigInput;
}

/**
 * Resolves the long press config to use, applying the defaults.
 *
 * @param input - The override and base configs.
 * @returns The resolved config, or undefined when the long press is off.
 */
export function resolveDbxMapboxLongPressConfig(input: ResolveDbxMapboxLongPressConfigInput): Maybe<DbxMapboxResolvedLongPressConfig> {
  const { override, base } = input;
  let config: Maybe<DbxMapboxLongPressConfig>;

  if (override != null) {
    config = override === false ? undefined : { ...(base || undefined), ...override };
  } else if (base !== false) {
    config = base ?? {};
  }

  return config
    ? {
        duration: config.duration ?? DEFAULT_MAPBOX_LONG_PRESS_DURATION,
        tolerance: config.tolerance ?? DEFAULT_MAPBOX_LONG_PRESS_TOLERANCE,
        mouse: config.mouse ?? true
      }
    : undefined;
}

// MARK: Event
/**
 * Emitted when the pointer is held still on the map for the configured duration.
 *
 * Also emitted by the store's rightClickEvent$, so a long press opens the same menu a right-click does.
 */
export interface DbxMapboxLongPressEvent {
  readonly type: typeof DBX_MAPBOX_LONG_PRESS_EVENT_TYPE;
  /**
   * The map the press was made on.
   */
  readonly target: MapboxGl.Map;
  readonly source: DbxMapboxLongPressSource;
  /**
   * The DOM event that started the press.
   */
  readonly originalEvent: MouseEvent | TouchEvent;
  /**
   * Position of the pointer on the map canvas when the press fired.
   */
  readonly point: MapboxGl.Point;
  /**
   * Map coordinates of the pointer when the press fired.
   */
  readonly lngLat: MapboxGl.LngLat;
  /**
   * How long the pointer was held.
   */
  readonly duration: Milliseconds;
}

/**
 * Returns true if the event is a {@link DbxMapboxLongPressEvent}, as opposed to a mapbox mouse event.
 *
 * @param event - The event to check.
 * @returns True for a long press event.
 */
export function isDbxMapboxLongPressEvent(event: Maybe<{ readonly type: string }>): event is DbxMapboxLongPressEvent {
  return event?.type === DBX_MAPBOX_LONG_PRESS_EVENT_TYPE;
}

/**
 * Returns true if a mouse event (such as contextmenu) was produced by a touch or pen rather than a mouse.
 *
 * Chromium sends contextmenu as a PointerEvent with a pointerType; sourceCapabilities covers the rest.
 *
 * @param event - The mouse event.
 * @returns True if the event came from a touch or pen.
 */
export function isTouchSourcedMouseEvent(event: MouseEvent): boolean {
  const pointerType = (event as Partial<PointerEvent>).pointerType;
  const firesTouchEvents = (event as { readonly sourceCapabilities?: Maybe<{ readonly firesTouchEvents?: boolean }> }).sourceCapabilities?.firesTouchEvents;
  return pointerType === 'touch' || pointerType === 'pen' || firesTouchEvents === true;
}

/**
 * Stops the next click event, if it happens in the current task.
 *
 * Used after the mouse is released on a press that already fired, so the release does not also click the map. Same approach as mapbox's own click suppression after a drag.
 */
export function suppressNextClickEvent(): void {
  const suppressClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    window.removeEventListener('click', suppressClick, true);
  };

  window.addEventListener('click', suppressClick, true);
  setTimeout(() => window.removeEventListener('click', suppressClick, true), 0);
}

// MARK: Tracker
export type DbxMapboxLongPressTrackerState = 'idle' | 'pending' | 'fired';

export interface DbxMapboxLongPressTrackerStart {
  readonly source: DbxMapboxLongPressSource;
  /**
   * Client (viewport) position of the pointer.
   */
  readonly position: Vector;
  /**
   * The DOM event that started the press.
   */
  readonly event: MouseEvent | TouchEvent;
}

export interface DbxMapboxLongPressTrackerResult {
  readonly source: DbxMapboxLongPressSource;
  /**
   * Latest client (viewport) position of the pointer.
   */
  readonly position: Vector;
  /**
   * The DOM event that started the press.
   */
  readonly startEvent: MouseEvent | TouchEvent;
  readonly duration: Milliseconds;
}

export interface DbxMapboxLongPressTrackerConfig {
  /**
   * Returns the config to use. Read when each press starts, so a changed config applies from the next press. Undefined turns the long press off.
   */
  readonly getConfig: Getter<Maybe<DbxMapboxResolvedLongPressConfig>>;
  /**
   * Called when a press has been held for the configured duration.
   */
  readonly onLongPress: (result: DbxMapboxLongPressTrackerResult) => void;
}

/**
 * Tracks presses on the map and reports the ones held still for the configured duration.
 *
 * It only tracks positions and time; the caller feeds it pointer events and decides what a long press does.
 */
export interface DbxMapboxLongPressTracker {
  readonly state: DbxMapboxLongPressTrackerState;
  /**
   * What the current press was made with, if a press is pending or fired.
   */
  readonly source: Maybe<DbxMapboxLongPressSource>;
  /**
   * Starts a press, replacing any current one.
   *
   * @param input - The pointer position and the event that started the press.
   * @returns True if a press was started. False when the long press is off, the source is a mouse and mouse presses are off, or the mouse event came right after a touch.
   */
  start(input: DbxMapboxLongPressTrackerStart): boolean;
  /**
   * Updates the pointer position. Cancels the pending press if the pointer moved farther than the tolerance from where it started.
   */
  move(source: DbxMapboxLongPressSource, position: Vector): void;
  /**
   * Ends the press when the pointer is released.
   *
   * @returns True if the press had already fired.
   */
  end(source: DbxMapboxLongPressSource): boolean;
  /**
   * Cancels the current press, such as when the user starts zooming.
   */
  cancel(): void;
  /**
   * Whether a touch is down, or was recently, so mouse events are likely touch compatibility events.
   */
  isTouchInteraction(): boolean;
  /**
   * Whether the next click should be ignored because it ends a press that fired.
   */
  shouldSuppressClick(): boolean;
  destroy(): void;
}

interface DbxMapboxLongPressTrackerPress {
  readonly source: DbxMapboxLongPressSource;
  readonly startPosition: Vector;
  readonly position: Vector;
  readonly startEvent: MouseEvent | TouchEvent;
  readonly duration: Milliseconds;
  readonly tolerance: Pixels;
}

/**
 * Creates a {@link DbxMapboxLongPressTracker}.
 *
 * @param config - The config getter and the long press callback.
 * @returns A new tracker.
 */
export function dbxMapboxLongPressTracker(config: DbxMapboxLongPressTrackerConfig): DbxMapboxLongPressTracker {
  const { getConfig, onLongPress } = config;

  let state: DbxMapboxLongPressTrackerState = 'idle';
  let press: Maybe<DbxMapboxLongPressTrackerPress>;
  let timeout: Maybe<ReturnType<typeof setTimeout>>;
  let isTouchDown = false;
  let lastTouchTime: Maybe<number>;
  let suppressClick = false;

  function reset() {
    if (timeout != null) {
      clearTimeout(timeout);
      timeout = undefined;
    }

    state = 'idle';
    press = undefined;
  }

  function isWithinTouchGuard() {
    return lastTouchTime != null && Date.now() - lastTouchTime < DBX_MAPBOX_LONG_PRESS_TOUCH_MOUSE_GUARD_TIME;
  }

  function fire() {
    timeout = undefined;

    if (press && state === 'pending') {
      state = 'fired';
      suppressClick = true;
      onLongPress({ source: press.source, position: press.position, startEvent: press.startEvent, duration: press.duration });
    }
  }

  return {
    get state() {
      return state;
    },
    get source() {
      return press?.source;
    },
    start(input: DbxMapboxLongPressTrackerStart) {
      const { source, position, event } = input;
      const isGhostMouse = source === 'mouse' && isWithinTouchGuard();
      let started = false;

      if (source === 'touch') {
        isTouchDown = true;
        lastTouchTime = Date.now();
      }

      // a ghost mouse event is part of a touch that already happened, so it must not reset that touch's state
      if (!isGhostMouse) {
        suppressClick = false;
        const resolved = getConfig();

        if (resolved && (source === 'touch' || resolved.mouse)) {
          reset();
          press = { source, startPosition: position, position, startEvent: event, duration: resolved.duration, tolerance: resolved.tolerance };
          state = 'pending';
          timeout = setTimeout(fire, resolved.duration);
          started = true;
        }
      }

      return started;
    },
    move(source: DbxMapboxLongPressSource, position: Vector) {
      if (source === 'touch') {
        lastTouchTime = Date.now();
      }

      if (press && state === 'pending' && press.source === source) {
        const distance = Math.hypot(position.x - press.startPosition.x, position.y - press.startPosition.y);

        if (distance > press.tolerance) {
          reset();
        } else {
          press = { ...press, position };
        }
      }
    },
    end(source: DbxMapboxLongPressSource) {
      let fired = false;

      if (source === 'touch') {
        isTouchDown = false;
        lastTouchTime = Date.now();
      }

      if (press?.source === source) {
        fired = state === 'fired';
        reset();
      }

      return fired;
    },
    cancel() {
      reset();
    },
    isTouchInteraction() {
      return isTouchDown || isWithinTouchGuard();
    },
    shouldSuppressClick() {
      return suppressClick;
    },
    destroy() {
      reset();
    }
  };
}
