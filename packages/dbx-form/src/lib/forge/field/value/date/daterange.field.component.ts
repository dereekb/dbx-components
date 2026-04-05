import { Component, ChangeDetectionStrategy, input, computed, effect, type Signal, type InputSignal, DestroyRef, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AsyncPipe } from '@angular/common';
import { DynamicTextPipe, type DynamicText, type ValidationMessages, DEFAULT_PROPS, DEFAULT_VALIDATION_MESSAGES } from '@ng-forge/dynamic-forms';
import { resolveValueFieldContext, buildValueFieldInputs, createResolvedErrorsSignal, shouldShowErrors } from '@ng-forge/dynamic-forms/integration';
import { MATERIAL_CONFIG } from '@ng-forge/dynamic-forms-material';
import type { FieldTree } from '@angular/forms/signals';
import type { Maybe } from '@dereekb/util';
import { safeToJsDate } from '@dereekb/date';

/**
 * Value shape for the date range field.
 */
export interface ForgeDateRangeValue {
  readonly start?: Maybe<Date>;
  readonly end?: Maybe<Date>;
}

/**
 * Custom props for the forge date range field.
 */
export interface ForgeDateRangeFieldComponentProps {
  /**
   * Custom label for the start date input.
   */
  readonly startLabel?: string;
  /**
   * Custom label for the end date input.
   */
  readonly endLabel?: string;
  /**
   * Whether to include time inputs alongside the date pickers.
   *
   * Defaults to false.
   */
  readonly showTime?: boolean;
  /**
   * Material form field appearance.
   */
  readonly appearance?: 'fill' | 'outline';
  /**
   * Hint text displayed below the field.
   */
  readonly hint?: DynamicText;
  /**
   * Minimum selectable date.
   */
  readonly minDate?: Date | string;
  /**
   * Maximum selectable date.
   */
  readonly maxDate?: Date | string;
}

/**
 * Custom ng-forge field component for date range selection.
 *
 * This component provides two date pickers (start and end) and bridges their
 * values with ng-forge Signal Forms. The value is stored as a `{ start, end }` object.
 *
 * Registered as ng-forge type 'daterange'.
 */
@Component({
  selector: 'dbx-forge-daterange-field',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatDatepickerModule, MatButtonModule, MatIconModule, ReactiveFormsModule, DynamicTextPipe, AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dbx-forge-daterange-field">
      <mat-form-field [appearance]="effectiveAppearance()" subscriptSizing="dynamic" class="dbx-forge-daterange-start">
        <mat-label>{{ startLabelSignal() }}</mat-label>
        <input matInput [matDatepicker]="startPicker" [formControl]="startDateCtrl" [min]="minDateSignal()" [max]="maxDateSignal()" />
        <mat-datepicker-toggle matIconSuffix [for]="startPicker"></mat-datepicker-toggle>
        <mat-datepicker #startPicker></mat-datepicker>
      </mat-form-field>
      @if (showTimeSignal()) {
        <mat-form-field [appearance]="effectiveAppearance()" subscriptSizing="dynamic" class="dbx-forge-daterange-start-time">
          <mat-label>Start Time</mat-label>
          <input matInput type="time" [formControl]="startTimeCtrl" />
        </mat-form-field>
      }
      <mat-form-field [appearance]="effectiveAppearance()" subscriptSizing="dynamic" class="dbx-forge-daterange-end">
        <mat-label>{{ endLabelSignal() }}</mat-label>
        <input matInput [matDatepicker]="endPicker" [formControl]="endDateCtrl" [min]="minDateSignal()" [max]="maxDateSignal()" />
        <mat-datepicker-toggle matIconSuffix [for]="endPicker"></mat-datepicker-toggle>
        <mat-datepicker #endPicker></mat-datepicker>
      </mat-form-field>
      @if (showTimeSignal()) {
        <mat-form-field [appearance]="effectiveAppearance()" subscriptSizing="dynamic" class="dbx-forge-daterange-end-time">
          <mat-label>End Time</mat-label>
          <input matInput type="time" [formControl]="endTimeCtrl" />
        </mat-form-field>
      }
      @if (errorsToDisplay()[0]; as error) {
        <mat-error>{{ error.message }}</mat-error>
      } @else if (props()?.hint; as hint) {
        <mat-hint>{{ hint | dynamicText | async }}</mat-hint>
      }
    </div>
  `,
  styles: `
    .dbx-forge-daterange-field {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: flex-start;
    }
    .dbx-forge-daterange-start,
    .dbx-forge-daterange-end {
      flex: 1 1 auto;
      min-width: 140px;
    }
    .dbx-forge-daterange-start-time,
    .dbx-forge-daterange-end-time {
      flex: 0 1 auto;
      min-width: 100px;
    }
  `
})
export class ForgeDateRangeFieldComponent {
  private readonly materialConfig = inject(MATERIAL_CONFIG, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  // Standard ng-forge value field inputs
  readonly field: InputSignal<FieldTree<unknown>> = input.required<FieldTree<unknown>>();
  readonly key: InputSignal<string> = input.required<string>();
  readonly label: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly placeholder: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly className: InputSignal<string> = input('');
  readonly tabIndex: InputSignal<number | undefined> = input<number | undefined>();
  readonly props: InputSignal<ForgeDateRangeFieldComponentProps | undefined> = input<ForgeDateRangeFieldComponentProps | undefined>();
  readonly meta: InputSignal<Record<string, unknown> | undefined> = input<Record<string, unknown> | undefined>();
  readonly validationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();

  /**
   * Internal FormControls for start and end dates and times.
   */
  readonly startDateCtrl = new FormControl<Maybe<Date>>(null);
  readonly startTimeCtrl = new FormControl<string>('');
  readonly endDateCtrl = new FormControl<Maybe<Date>>(null);
  readonly endTimeCtrl = new FormControl<string>('');

  // Computed props
  readonly startLabelSignal: Signal<string> = computed(() => this.props()?.startLabel ?? 'Start');
  readonly endLabelSignal: Signal<string> = computed(() => this.props()?.endLabel ?? 'End');
  readonly showTimeSignal: Signal<boolean> = computed(() => this.props()?.showTime ?? false);
  readonly effectiveAppearance = computed(() => this.props()?.appearance ?? this.materialConfig?.appearance ?? 'outline');
  readonly minDateSignal = computed(() => {
    const minDate = this.props()?.minDate;
    return minDate ? safeToJsDate(minDate) : null;
  });
  readonly maxDateSignal = computed(() => {
    const maxDate = this.props()?.maxDate;
    return maxDate ? safeToJsDate(maxDate) : null;
  });

  // Error handling
  readonly resolvedErrors = createResolvedErrorsSignal(this.field as Signal<FieldTree<unknown>>, this.validationMessages, this.defaultValidationMessages);
  readonly showErrors = shouldShowErrors(this.field as Signal<FieldTree<unknown>>);
  readonly errorsToDisplay = computed(() => (this.showErrors() ? this.resolvedErrors() : []));

  /**
   * Flag to prevent feedback loops during sync.
   */
  private _syncing = false;

  constructor() {
    // Sync Signal Forms field -> FormControls (inbound)
    effect(() => {
      const fieldTree = this.field();
      const fieldState = fieldTree();
      const signalValue = fieldState.value() as Maybe<ForgeDateRangeValue>;

      if (!this._syncing) {
        this._syncing = true;
        this._setDateCtrlFromValue(this.startDateCtrl, this.startTimeCtrl, signalValue?.start);
        this._setDateCtrlFromValue(this.endDateCtrl, this.endTimeCtrl, signalValue?.end);
        this._syncing = false;
      }
    });

    // Sync FormControls -> Signal Forms field (outbound)
    const startDateSub = this.startDateCtrl.valueChanges.subscribe(() => this._syncOutbound());
    const startTimeSub = this.startTimeCtrl.valueChanges.subscribe(() => this._syncOutbound());
    const endDateSub = this.endDateCtrl.valueChanges.subscribe(() => this._syncOutbound());
    const endTimeSub = this.endTimeCtrl.valueChanges.subscribe(() => this._syncOutbound());

    this.destroyRef.onDestroy(() => {
      startDateSub.unsubscribe();
      startTimeSub.unsubscribe();
      endDateSub.unsubscribe();
      endTimeSub.unsubscribe();
    });
  }

  /**
   * Sets the date and time FormControls from a source Date value without emitting events.
   */
  private _setDateCtrlFromValue(dateCtrl: FormControl<Maybe<Date>>, timeCtrl: FormControl<Maybe<string>>, value: Maybe<Date>): void {
    const dateValue = value ? safeToJsDate(value) : undefined;

    if (dateValue) {
      const currentCtrlValue = dateCtrl.value;

      if (!currentCtrlValue || currentCtrlValue.getTime() !== dateValue.getTime()) {
        dateCtrl.setValue(dateValue, { emitEvent: false });
      }

      const hours = String(dateValue.getHours()).padStart(2, '0');
      const minutes = String(dateValue.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;

      if (timeStr !== timeCtrl.value) {
        timeCtrl.setValue(timeStr, { emitEvent: false });
      }
    } else {
      dateCtrl.setValue(null, { emitEvent: false });
      timeCtrl.setValue('', { emitEvent: false });
    }
  }

  /**
   * Combines the date and time controls into a date range value
   * and writes it to the Signal Forms field tree.
   */
  private _syncOutbound(): void {
    if (this._syncing) {
      return;
    }

    this._syncing = true;

    const fieldTree = this.field();
    const fieldState = fieldTree();
    const showTime = this.showTimeSignal();
    const startDate = this._combineDateAndTime(this.startDateCtrl.value, showTime ? this.startTimeCtrl.value : null);
    const endDate = this._combineDateAndTime(this.endDateCtrl.value, showTime ? this.endTimeCtrl.value : null);

    const newValue: ForgeDateRangeValue = {
      start: startDate,
      end: endDate
    };

    fieldState.value.set(newValue);
    fieldState.markAsTouched();
    fieldState.markAsDirty();
    this._syncing = false;
  }

  /**
   * Combines a date and optional time string into a single Date.
   */
  private _combineDateAndTime(dateValue: Maybe<Date>, timeValue: Maybe<string>): Maybe<Date> {
    let result: Maybe<Date>;

    if (dateValue) {
      result = new Date(dateValue);

      if (timeValue) {
        const [hoursStr, minutesStr] = timeValue.split(':');
        const hours = parseInt(hoursStr, 10);
        const minutes = parseInt(minutesStr, 10);

        if (!isNaN(hours) && !isNaN(minutes)) {
          result.setHours(hours, minutes, 0, 0);
        }
      }
    }

    return result;
  }
}

// MARK: Mapper
/**
 * Custom mapper for the daterange field type.
 *
 * Uses the standard valueFieldMapper pattern from ng-forge/integration to resolve
 * the field tree and build the standard inputs for the component.
 *
 * @param fieldDef - The date range field definition
 * @returns Signal containing Record of input names to values for ngComponentOutlet
 */
export function dateRangeFieldMapper(fieldDef: { key: string }): Signal<Record<string, unknown>> {
  const ctx = resolveValueFieldContext();
  const defaultProps = inject(DEFAULT_PROPS);
  const defaultValidationMessages = inject(DEFAULT_VALIDATION_MESSAGES);

  return computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return buildValueFieldInputs(fieldDef as any, ctx, defaultProps?.(), defaultValidationMessages?.());
  });
}
