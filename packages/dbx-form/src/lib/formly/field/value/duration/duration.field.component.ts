import { Component, type OnInit, type OnDestroy, ChangeDetectionStrategy, ElementRef, inject, viewChild } from '@angular/core';
import { FieldType } from '@ngx-formly/material';
import { type FieldTypeConfig, type FormlyFieldProps } from '@ngx-formly/core';
import { type HoursAndMinutes, type TimeUnit, ALL_TIME_UNITS, hoursAndMinutesToTimeUnit, millisecondsToTimeUnit, minutesToHoursAndMinutes, timeUnitToMilliseconds } from '@dereekb/util';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SubscriptionObject } from '@dereekb/rxjs';
import { distinctUntilChanged, startWith } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { type TimeDurationFieldValueMode } from './duration.field';
import { type TimeDurationData, durationDataToMilliseconds, formatDurationString, millisecondsToDurationData, parseDurationString } from '@dereekb/date';
import { DbxPopoverService } from '@dereekb/dbx-web';
import { DbxDurationPickerPopoverComponent } from './duration.picker.popover.component';

/**
 * Formly field props for the time duration component.
 */
export interface TimeDurationFormlyFieldProps extends FormlyFieldProps {
  /**
   * The unit of the output value. Defaults to `'ms'`.
   */
  readonly outputUnit?: TimeUnit;
  /**
   * Output value mode. Defaults to `'number'`.
   */
  readonly valueMode?: TimeDurationFieldValueMode;
  /**
   * The time units available for the field. Controls which units the parser recognizes
   * and which columns appear in the popover picker.
   *
   * Defaults to all time units.
   */
  readonly allowedUnits?: TimeUnit[];
  /**
   * Which units to show in the popover picker.
   *
   * Defaults to allowedUnits filtered to exclude 'ms'.
   */
  readonly pickerUnits?: TimeUnit[];
  /**
   * Minimum output value (in the output unit). Used for validation.
   */
  readonly min?: number;
  /**
   * Maximum output value (in the output unit). Used for validation.
   */
  readonly max?: number;
  /**
   * Whether the popover picker carries over values to the next larger unit.
   */
  readonly carryOver?: boolean;
}

/**
 * Formly custom field type for time duration input with text parsing and a popover picker.
 *
 * The text input accepts duration strings like "3d10h5m8s", "2 hours 30 minutes", etc.
 * A picker button opens a popover with +/- columns for each time unit.
 *
 * Registered as Formly type `'timeduration'`.
 */
@Component({
  templateUrl: 'duration.field.component.html',
  imports: [MatInputModule, MatFormFieldModule, MatIconModule, MatButtonModule, FormsModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxTimeDurationFieldComponent extends FieldType<FieldTypeConfig<TimeDurationFormlyFieldProps>> implements OnInit, OnDestroy {
  private readonly _popoverService = inject(DbxPopoverService);

  private readonly _inputSync = new SubscriptionObject();
  private readonly _outputSync = new SubscriptionObject();

  private _suppressOutputSync = false;
  private _currentDurationData: TimeDurationData = {};

  readonly textCtrl = new FormControl<string>('');
  readonly pickerButtonElement = viewChild<string, ElementRef>('pickerButton', { read: ElementRef });

  get outputUnit(): TimeUnit {
    return this.props.outputUnit ?? 'ms';
  }

  get valueMode(): TimeDurationFieldValueMode {
    return this.props.valueMode ?? 'number';
  }

  get allowedUnits(): TimeUnit[] {
    return this.props.allowedUnits ?? (ALL_TIME_UNITS as unknown as TimeUnit[]);
  }

  get pickerUnits(): TimeUnit[] {
    return this.props.pickerUnits ?? this.allowedUnits.filter((u) => u !== 'ms');
  }

  /**
   * Units used for decomposing/displaying duration text.
   * Includes 'ms' if the smallest picker unit would leave a remainder.
   *
   * @returns The array of time units used for displaying duration text
   */
  get displayUnits(): TimeUnit[] {
    const units = [...this.pickerUnits];

    if (!units.includes('ms')) {
      units.push('ms');
    }

    return units;
  }

  ngOnInit(): void {
    // Input sync: outer formControl -> text display
    this._inputSync.subscription = this.formControl.valueChanges.pipe(startWith(this.formControl.value), distinctUntilChanged()).subscribe((inputValue) => {
      this._suppressOutputSync = true;

      try {
        if (inputValue == null) {
          this._currentDurationData = {};
          this.textCtrl.setValue('');
        } else {
          const ms = this._outputValueToMilliseconds(inputValue);
          this._currentDurationData = millisecondsToDurationData(ms, this.displayUnits);
          this.textCtrl.setValue(formatDurationString(this._currentDurationData));
        }
      } finally {
        this._suppressOutputSync = false;
      }
    });

    // Text change sync: parse text on value changes (debounced via blur/enter)
    // We don't auto-parse on every keystroke — only on blur or enter
  }

  /**
   * Called when the text input loses focus. Parses the text and updates the output.
   */
  onTextBlur(): void {
    this._parseAndSync();
  }

  /**
   * Called when Enter is pressed in the text input.
   *
   * @param event - The keyboard event triggered by pressing Enter
   */
  onTextEnter(event: Event): void {
    event.preventDefault();
    this._parseAndSync();
  }

  /**
   * Opens the duration picker popover.
   */
  openPicker(): void {
    const origin = this.pickerButtonElement();

    if (!origin) {
      return;
    }

    const existingMs = this._currentDurationData.milliseconds;

    const onPickerChange = (data: TimeDurationData) => {
      // Preserve milliseconds from the existing data since the popover doesn't show them
      const merged: TimeDurationData = existingMs ? { ...data, milliseconds: existingMs } : data;
      this._currentDurationData = merged;
      this.textCtrl.setValue(formatDurationString(merged));
      this._syncOutputFromDurationData(merged);
    };

    const { min, max } = this.props;
    const minMs = min != null ? timeUnitToMilliseconds(min, this.outputUnit) : undefined;
    const maxMs = max != null ? timeUnitToMilliseconds(max, this.outputUnit) : undefined;

    DbxDurationPickerPopoverComponent.openPopover(this._popoverService, {
      origin,
      data: {
        current: this._currentDurationData,
        units: this.pickerUnits,
        onChange: onPickerChange,
        minMs,
        maxMs,
        carryOver: this.props.carryOver
      }
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._inputSync.destroy();
    this._outputSync.destroy();
  }

  /**
   * Parses the current text input and syncs the output value.
   */
  private _parseAndSync(): void {
    if (this._suppressOutputSync) {
      return;
    }

    const text = this.textCtrl.value?.trim();

    if (!text) {
      this._currentDurationData = {};
      this.formControl.setValue(undefined);
      this.formControl.markAsDirty();
      this.formControl.markAsTouched();
      return;
    }

    const parsed = parseDurationString(text);
    this._currentDurationData = parsed;

    // Re-format the display text to normalize it
    this.textCtrl.setValue(formatDurationString(parsed), { emitEvent: false });

    this._syncOutputFromDurationData(parsed);
  }

  /**
   * Converts duration data to the output value and sets it on the form control.
   *
   * @param data - The parsed duration data containing time unit values
   */
  private _syncOutputFromDurationData(data: TimeDurationData): void {
    const ms = durationDataToMilliseconds(data);

    let outputValue: unknown;

    if (this.valueMode === 'duration_data') {
      outputValue = data;
    } else if (this.valueMode === 'hours_and_minutes') {
      const totalMinutes = ms / 60000;
      outputValue = minutesToHoursAndMinutes(Math.round(totalMinutes));
    } else {
      outputValue = millisecondsToTimeUnit(ms, this.outputUnit);
    }

    this.formControl.setValue(outputValue);
    this.formControl.markAsDirty();
    this.formControl.markAsTouched();
  }

  /**
   * Converts an output value (number, HoursAndMinutes, or TimeDurationData) to milliseconds.
   *
   * @param value - The output value to convert, interpreted based on the current valueMode
   * @returns The equivalent duration in milliseconds
   */
  private _outputValueToMilliseconds(value: unknown): number {
    if (this.valueMode === 'duration_data') {
      return durationDataToMilliseconds(value as TimeDurationData);
    } else if (this.valueMode === 'hours_and_minutes') {
      const hm = value as HoursAndMinutes;
      return hoursAndMinutesToTimeUnit(hm, 'ms');
    } else {
      return timeUnitToMilliseconds(value as number, this.outputUnit);
    }
  }
}
