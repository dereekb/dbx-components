import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type Maybe } from '@dereekb/util';
import {
  DBX_MAPBOX_LONG_PRESS_TOUCH_MOUSE_GUARD_TIME,
  DEFAULT_MAPBOX_LONG_PRESS_DURATION,
  DEFAULT_MAPBOX_LONG_PRESS_TOLERANCE,
  type DbxMapboxLongPressTracker,
  type DbxMapboxLongPressTrackerResult,
  type DbxMapboxResolvedLongPressConfig,
  dbxMapboxLongPressTracker,
  isDbxMapboxLongPressEvent,
  isTouchSourcedMouseEvent,
  resolveDbxMapboxLongPressConfig,
  suppressNextClickEvent
} from './mapbox.longpress';

describe('resolveDbxMapboxLongPressConfig()', () => {
  const DEFAULTS: DbxMapboxResolvedLongPressConfig = { duration: DEFAULT_MAPBOX_LONG_PRESS_DURATION, tolerance: DEFAULT_MAPBOX_LONG_PRESS_TOLERANCE, mouse: true };

  it('should use the defaults when nothing is configured', () => {
    expect(resolveDbxMapboxLongPressConfig({})).toEqual(DEFAULTS);
  });

  it('should be off when the base is false', () => {
    expect(resolveDbxMapboxLongPressConfig({ base: false })).toBeUndefined();
  });

  it('should be off when the override is false', () => {
    expect(resolveDbxMapboxLongPressConfig({ override: false, base: { duration: 500 } })).toBeUndefined();
  });

  it('should merge the override over the base', () => {
    expect(resolveDbxMapboxLongPressConfig({ override: { duration: 3000 }, base: { tolerance: 20, mouse: false } })).toEqual({ duration: 3000, tolerance: 20, mouse: false });
  });

  it('should turn the long press on when the override is set and the base is false', () => {
    expect(resolveDbxMapboxLongPressConfig({ override: { duration: 1000 }, base: false })).toEqual({ ...DEFAULTS, duration: 1000 });
  });
});

describe('dbxMapboxLongPressTracker()', () => {
  const DURATION = 2000;
  const TOLERANCE = 10;

  let config: Maybe<DbxMapboxResolvedLongPressConfig>;
  let results: DbxMapboxLongPressTrackerResult[];
  let tracker: DbxMapboxLongPressTracker;

  const touchEvent = {} as TouchEvent;
  const mouseEvent = {} as MouseEvent;

  beforeEach(() => {
    vi.useFakeTimers();
    config = { duration: DURATION, tolerance: TOLERANCE, mouse: true };
    results = [];
    tracker = dbxMapboxLongPressTracker({ getConfig: () => config, onLongPress: (x) => results.push(x) });
  });

  afterEach(() => {
    tracker.destroy();
    vi.useRealTimers();
  });

  it('should fire once the press is held for the duration', () => {
    expect(tracker.start({ source: 'touch', position: { x: 10, y: 10 }, event: touchEvent })).toBe(true);
    vi.advanceTimersByTime(DURATION - 1);
    expect(results).toHaveLength(0);
    expect(tracker.state).toBe('pending');

    vi.advanceTimersByTime(1);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ source: 'touch', position: { x: 10, y: 10 }, startEvent: touchEvent, duration: DURATION });
    expect(tracker.state).toBe('fired');
  });

  it('should report the latest position when the pointer drifted within the tolerance', () => {
    tracker.start({ source: 'touch', position: { x: 10, y: 10 }, event: touchEvent });
    tracker.move('touch', { x: 14, y: 13 });
    vi.advanceTimersByTime(DURATION);
    expect(results[0].position).toEqual({ x: 14, y: 13 });
  });

  it('should cancel when the pointer moves farther than the tolerance from where it started', () => {
    tracker.start({ source: 'touch', position: { x: 10, y: 10 }, event: touchEvent });
    tracker.move('touch', { x: 16, y: 16 }); // about 8.5px
    tracker.move('touch', { x: 10 + TOLERANCE + 1, y: 10 });
    vi.advanceTimersByTime(DURATION);
    expect(results).toHaveLength(0);
    expect(tracker.state).toBe('idle');
  });

  it('should cancel when released before the duration', () => {
    tracker.start({ source: 'mouse', position: { x: 0, y: 0 }, event: mouseEvent });
    vi.advanceTimersByTime(DURATION / 2);
    expect(tracker.end('mouse')).toBe(false);
    vi.advanceTimersByTime(DURATION);
    expect(results).toHaveLength(0);
  });

  it('should cancel when cancel() is called', () => {
    tracker.start({ source: 'touch', position: { x: 0, y: 0 }, event: touchEvent });
    tracker.cancel();
    vi.advanceTimersByTime(DURATION);
    expect(results).toHaveLength(0);
    expect(tracker.state).toBe('idle');
  });

  it('should return true from end() only for a press that fired', () => {
    tracker.start({ source: 'touch', position: { x: 0, y: 0 }, event: touchEvent });
    vi.advanceTimersByTime(DURATION);
    expect(tracker.end('touch')).toBe(true);
    expect(tracker.end('touch')).toBe(false);
  });

  it('should not start a mouse press when mouse presses are off', () => {
    config = { duration: DURATION, tolerance: TOLERANCE, mouse: false };
    expect(tracker.start({ source: 'mouse', position: { x: 0, y: 0 }, event: mouseEvent })).toBe(false);
    expect(tracker.start({ source: 'touch', position: { x: 0, y: 0 }, event: touchEvent })).toBe(true);
  });

  it('should not start when the long press is off', () => {
    config = undefined;
    expect(tracker.start({ source: 'touch', position: { x: 0, y: 0 }, event: touchEvent })).toBe(false);
    vi.advanceTimersByTime(DURATION);
    expect(results).toHaveLength(0);
  });

  it('should apply a changed config from the next press', () => {
    tracker.start({ source: 'touch', position: { x: 0, y: 0 }, event: touchEvent });
    config = { duration: 500, tolerance: TOLERANCE, mouse: true };
    vi.advanceTimersByTime(500);
    expect(results).toHaveLength(0);
    tracker.end('touch');

    tracker.start({ source: 'touch', position: { x: 0, y: 0 }, event: touchEvent });
    vi.advanceTimersByTime(500);
    expect(results).toHaveLength(1);
    expect(results[0].duration).toBe(500);
  });

  it('should ignore mouse events that come right after a touch', () => {
    tracker.start({ source: 'touch', position: { x: 0, y: 0 }, event: touchEvent });
    vi.advanceTimersByTime(DURATION);
    tracker.end('touch');
    expect(tracker.isTouchInteraction()).toBe(true);

    // the ghost mousedown neither starts a press nor clears the click suppression of the touch press
    expect(tracker.start({ source: 'mouse', position: { x: 0, y: 0 }, event: mouseEvent })).toBe(false);
    expect(tracker.shouldSuppressClick()).toBe(true);

    vi.advanceTimersByTime(DBX_MAPBOX_LONG_PRESS_TOUCH_MOUSE_GUARD_TIME);
    expect(tracker.isTouchInteraction()).toBe(false);
    expect(tracker.start({ source: 'mouse', position: { x: 0, y: 0 }, event: mouseEvent })).toBe(true);
  });

  it('should report a touch interaction while a touch is down', () => {
    expect(tracker.isTouchInteraction()).toBe(false);
    tracker.start({ source: 'touch', position: { x: 0, y: 0 }, event: touchEvent });
    vi.advanceTimersByTime(DBX_MAPBOX_LONG_PRESS_TOUCH_MOUSE_GUARD_TIME * 5);
    expect(tracker.isTouchInteraction()).toBe(true);
  });

  it('should suppress the click that ends a fired press until the next press starts', () => {
    tracker.start({ source: 'mouse', position: { x: 0, y: 0 }, event: mouseEvent });
    expect(tracker.shouldSuppressClick()).toBe(false);
    vi.advanceTimersByTime(DURATION);
    tracker.end('mouse');
    expect(tracker.shouldSuppressClick()).toBe(true);

    tracker.start({ source: 'mouse', position: { x: 0, y: 0 }, event: mouseEvent });
    expect(tracker.shouldSuppressClick()).toBe(false);
  });

  it('should clear the click suppression on the next press even when the long press was turned off', () => {
    tracker.start({ source: 'mouse', position: { x: 0, y: 0 }, event: mouseEvent });
    vi.advanceTimersByTime(DURATION);
    tracker.end('mouse');

    config = undefined;
    tracker.start({ source: 'mouse', position: { x: 0, y: 0 }, event: mouseEvent });
    expect(tracker.shouldSuppressClick()).toBe(false);
  });

  it('should clear the pending timer when destroyed', () => {
    tracker.start({ source: 'touch', position: { x: 0, y: 0 }, event: touchEvent });
    tracker.destroy();
    vi.advanceTimersByTime(DURATION);
    expect(results).toHaveLength(0);
  });
});

describe('isDbxMapboxLongPressEvent()', () => {
  it('should return true only for a long press event', () => {
    expect(isDbxMapboxLongPressEvent({ type: 'longpress' })).toBe(true);
    expect(isDbxMapboxLongPressEvent({ type: 'contextmenu' })).toBe(false);
    expect(isDbxMapboxLongPressEvent(undefined)).toBe(false);
  });
});

describe('isTouchSourcedMouseEvent()', () => {
  it('should return true for touch and pen pointer events', () => {
    expect(isTouchSourcedMouseEvent({ pointerType: 'touch' } as unknown as MouseEvent)).toBe(true);
    expect(isTouchSourcedMouseEvent({ pointerType: 'pen' } as unknown as MouseEvent)).toBe(true);
  });

  it('should return true when the source fires touch events', () => {
    expect(isTouchSourcedMouseEvent({ sourceCapabilities: { firesTouchEvents: true } } as unknown as MouseEvent)).toBe(true);
  });

  it('should return false for a mouse', () => {
    expect(isTouchSourcedMouseEvent({ pointerType: 'mouse' } as unknown as MouseEvent)).toBe(false);
    expect(isTouchSourcedMouseEvent({} as MouseEvent)).toBe(false);
  });
});

describe('suppressNextClickEvent()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should stop a click in the same task, and let later clicks through', () => {
    const listener = vi.fn();
    document.body.addEventListener('click', listener);

    suppressNextClickEvent();
    document.body.click();
    expect(listener).not.toHaveBeenCalled();

    suppressNextClickEvent();
    vi.advanceTimersByTime(0);
    document.body.click();
    expect(listener).toHaveBeenCalledTimes(1);

    document.body.removeEventListener('click', listener);
  });
});
