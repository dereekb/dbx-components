import { ChangeDetectionStrategy, Component, type ElementRef, signal } from '@angular/core';
import { type Milliseconds, type TimeUnit, TIME_UNIT_SHORT_LABEL_MAP, timeUnitToMilliseconds } from '@dereekb/util';
import { type TimeDurationData, durationDataToMilliseconds, getDurationDataValue, millisecondsToDurationData, setDurationDataValue } from '@dereekb/date';
import { AbstractPopoverDirective, type DbxPopoverService } from '@dereekb/dbx-web';
import { type NgPopoverRef } from 'ng-overlay-container';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

/**
 * Default popover key for the duration picker.
 */
export const DEFAULT_DURATION_PICKER_POPOVER_KEY = 'durationpicker';

/**
 * Callback invoked on every +/- click in the duration picker.
 */
export type DbxDurationPickerChangeCallback = (data: TimeDurationData) => void;

/**
 * Data passed to the duration picker popover.
 */
export interface DbxDurationPickerPopoverData {
  /**
   * The current duration values.
   */
  readonly current: TimeDurationData;
  /**
   * Which time unit columns to show.
   */
  readonly units: TimeUnit[];
  /**
   * Optional callback invoked on every +/- change for live updates.
   */
  readonly onChange?: DbxDurationPickerChangeCallback;
  /**
   * Minimum total value in milliseconds. Used to disable decrement buttons.
   */
  readonly minMs?: Milliseconds;
  /**
   * Maximum total value in milliseconds. Used to disable increment buttons.
   */
  readonly maxMs?: Milliseconds;
  /**
   * Whether values should carry over to the next larger unit when they overflow
   * (e.g., 60 seconds → 1 minute). Only carries into units present in `units`.
   *
   * Defaults to false.
   */
  readonly carryOver?: boolean;
}

/**
 * Popover component that displays a horizontal duration picker with +/- buttons for each time unit.
 *
 * Each column shows the unit label, an increment button, the current value, and a decrement button.
 * Buttons are disabled when incrementing/decrementing would exceed min/max constraints.
 * Changes are applied immediately via the onChange callback and returned when the popover closes.
 *
 * @example
 * ```typescript
 * DbxDurationPickerPopoverComponent.openPopover(popoverService, {
 *   origin: elementRef,
 *   data: { current: { hours: 1, minutes: 30 }, units: ['h', 'min', 's'] }
 * });
 * ```
 */
@Component({
  templateUrl: 'duration.picker.popover.component.html',
  imports: [MatIconModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxDurationPickerPopoverComponent extends AbstractPopoverDirective<TimeDurationData, DbxDurationPickerPopoverData> {
  readonly durationData = signal<TimeDurationData>(this.popover.data?.current ?? {});
  readonly units: TimeUnit[] = [...(this.popover.data?.units ?? ['d', 'h', 'min', 's'])].reverse();

  private readonly _onChange = this.popover.data?.onChange;
  private readonly _minMs = this.popover.data?.minMs;
  private readonly _maxMs = this.popover.data?.maxMs;
  private readonly _carryOver = this.popover.data?.carryOver ?? false;

  constructor() {
    super();
    this.popover.getClosingValueFn = () => this.durationData();
  }

  /**
   * Opens the duration picker popover.
   *
   * @param popoverService - The popover service to use
   * @param config - Configuration with origin element and picker data
   * @param config.origin - The element to anchor the popover to
   * @param config.data - The picker data including current values and which units to show
   * @returns A reference to the opened popover
   */
  static openPopover(popoverService: DbxPopoverService, config: { origin: ElementRef; data: DbxDurationPickerPopoverData }): NgPopoverRef {
    return popoverService.open({
      key: DEFAULT_DURATION_PICKER_POPOVER_KEY,
      origin: config.origin,
      componentClass: DbxDurationPickerPopoverComponent,
      data: config.data,
      width: `${Math.max(200, config.data.units.length * 64 + 32)}px`,
      height: '260px'
    });
  }

  /**
   * Gets the short label for a time unit.
   *
   * @param unit - The time unit
   * @returns The short label string
   */
  unitLabel(unit: TimeUnit): string {
    return TIME_UNIT_SHORT_LABEL_MAP[unit];
  }

  /**
   * Gets the current value for a specific time unit.
   *
   * @param unit - The time unit to read
   * @returns The current value for that unit
   */
  getValue(unit: TimeUnit): number {
    return getDurationDataValue(this.durationData(), unit);
  }

  /**
   * Returns true if incrementing the given unit by 1 would not exceed the maximum.
   *
   * @param unit - The time unit to check
   * @returns Whether incrementing is allowed
   */
  canIncrement(unit: TimeUnit): boolean {
    if (this._maxMs == null) {
      return true;
    }

    const currentMs = durationDataToMilliseconds(this.durationData());
    const incrementMs = timeUnitToMilliseconds(1, unit);
    return currentMs + incrementMs <= this._maxMs;
  }

  /**
   * Returns true if decrementing the given unit by 1 would not go below the minimum (or below 0).
   *
   * @param unit - The time unit to check
   * @returns Whether decrementing is allowed
   */
  canDecrement(unit: TimeUnit): boolean {
    if (this._carryOver) {
      // With carryOver, allow decrement as long as total ms after decrement >= minMs (or 0)
      const currentMs = durationDataToMilliseconds(this.durationData());
      const decrementMs = timeUnitToMilliseconds(1, unit);
      const minMs = this._minMs ?? 0;
      return currentMs - decrementMs >= minMs;
    }

    const current = getDurationDataValue(this.durationData(), unit);

    if (current <= 0) {
      return false;
    }

    if (this._minMs == null) {
      return true;
    }

    const currentMs = durationDataToMilliseconds(this.durationData());
    const decrementMs = timeUnitToMilliseconds(1, unit);
    return currentMs - decrementMs >= this._minMs;
  }

  /**
   * Increments the value for a specific time unit.
   * Holding shift doubles the step.
   *
   * @param unit - The time unit to increment
   * @param step - The amount to increment by (defaults to 1)
   */
  increment(unit: TimeUnit, step = 1): void {
    const current = getDurationDataValue(this.durationData(), unit);
    const updated = this._normalizeIfCarryOver(setDurationDataValue(this.durationData(), unit, current + step));
    this.durationData.set(updated);
    this._onChange?.(updated);
  }

  /**
   * Decrements the value for a specific time unit.
   * Holding shift doubles the step.
   *
   * @param unit - The time unit to decrement
   * @param step - The amount to decrement by (defaults to 1)
   */
  decrement(unit: TimeUnit, step = 1): void {
    const current = getDurationDataValue(this.durationData(), unit);
    const newValue = this._carryOver ? current - step : Math.max(0, current - step);
    const updated = this._normalizeIfCarryOver(setDurationDataValue(this.durationData(), unit, newValue));
    this.durationData.set(updated);
    this._onChange?.(updated);
  }

  /**
   * Returns the step size — 2 if shift is held, 1 otherwise.
   *
   * @param event - The mouse or keyboard event
   * @returns The step multiplier
   */
  stepFromEvent(event?: Event): number {
    if (event && 'shiftKey' in event) {
      return (event as MouseEvent | KeyboardEvent).shiftKey ? 2 : 1;
    }

    return 1;
  }

  /**
   * When carryOver is enabled, normalizes the data by converting to total milliseconds
   * and decomposing back into the picker's units (e.g., 60s becomes 1m, 7d becomes 1w).
   *
   * @param data - The duration data to normalize
   * @returns Normalized or original data
   */
  private _normalizeIfCarryOver(data: TimeDurationData): TimeDurationData {
    if (!this._carryOver) {
      return data;
    }

    const ms = durationDataToMilliseconds(data);
    return millisecondsToDurationData(Math.max(0, ms), this.units);
  }

  // MARK: Hold-to-repeat
  private _holdInterval: ReturnType<typeof setInterval> | undefined;
  private _holdTimeout: ReturnType<typeof setTimeout> | undefined;
  private _holdActive = false;
  private _shiftHeld = false;

  /**
   * Fires one action immediately and starts hold-to-repeat.
   * Used by both mousedown and keydown.
   *
   * @param action - The action to perform
   * @param unit - The time unit
   * @param event - The triggering event (for shift detection)
   */
  onHoldStart(action: 'increment' | 'decrement', unit: TimeUnit, event: Event): void {
    // Only preventDefault for keyboard events (prevents page scroll).
    // Don't preventDefault on mousedown — it blocks focus transfer to the button.
    if (event instanceof KeyboardEvent) {
      event.preventDefault();
      this._shiftHeld = event.shiftKey;
    } else if (event instanceof MouseEvent) {
      this._shiftHeld = event.shiftKey;
    }

    if (this._holdActive) {
      return;
    }

    this._doAction(action, unit, this._currentStep);

    this._holdActive = true;
    this._holdTimeout = setTimeout(() => {
      this._holdInterval = setInterval(() => {
        if (!this._doAction(action, unit, this._currentStep)) {
          this.stopHold();
        }
      }, 80);
    }, 300);
  }

  /**
   * Returns the current step based on whether shift is held.
   *
   * @returns 2 when shift is held for larger increments, 1 otherwise
   */
  private get _currentStep(): number {
    return this._shiftHeld ? 2 : 1;
  }

  /**
   * Stops the hold-to-repeat interval.
   */
  /**
   * Handles keyup events. Only stops the hold when an arrow key is released.
   * Releasing modifier keys (shift, ctrl, etc.) does not stop the hold.
   *
   * @param event - The keyboard event
   */
  onKeyUp(event: KeyboardEvent): void {
    this._shiftHeld = event.shiftKey;

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      this.stopHold();
    }
  }

  stopHold(): void {
    this._holdActive = false;

    if (this._holdTimeout) {
      clearTimeout(this._holdTimeout);
      this._holdTimeout = undefined;
    }

    if (this._holdInterval) {
      clearInterval(this._holdInterval);
      this._holdInterval = undefined;
    }
  }

  /**
   * Executes an increment or decrement action if allowed.
   *
   * @param action - Whether to increment or decrement the value
   * @param unit - The time unit to adjust (e.g. 'h', 'm', 's')
   * @param step - The step multiplier for the action
   * @returns True if the action was performed
   */
  private _doAction(action: 'increment' | 'decrement', unit: TimeUnit, step: number): boolean {
    if (action === 'increment' && this.canIncrement(unit)) {
      this.increment(unit, step);
      return true;
    } else if (action === 'decrement' && this.canDecrement(unit)) {
      this.decrement(unit, step);
      return true;
    }

    return false;
  }
}
