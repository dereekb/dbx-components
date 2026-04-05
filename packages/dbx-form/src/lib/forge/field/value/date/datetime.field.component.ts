import { Component, ChangeDetectionStrategy, input, computed, effect, type Signal, type InputSignal, DestroyRef, inject, signal } from '@angular/core';
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
 * Custom props for the forge date-time field.
 */
export interface ForgeDateTimeFieldComponentProps {
  /**
   * Whether to show only the time picker (hide the date input).
   */
  readonly timeOnly?: boolean;
  /**
   * Whether to include a time input alongside the date picker.
   *
   * Defaults to true.
   */
  readonly showTime?: boolean;
  /**
   * Custom label for the date input.
   */
  readonly dateLabel?: string;
  /**
   * Custom label for the time input.
   */
  readonly timeLabel?: string;
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
 * Custom ng-forge field component for date-time selection.
 *
 * This component bridges Angular Material's datepicker and a time text input
 * with ng-forge Signal Forms. The value is stored as a Date object.
 *
 * Registered as ng-forge type 'datetime'.
 */
@Component({
  selector: 'dbx-forge-datetime-field',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatDatepickerModule, MatButtonModule, MatIconModule, ReactiveFormsModule, DynamicTextPipe, AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dbx-forge-datetime-field">
      @if (!timeOnlySignal()) {
        <mat-form-field [appearance]="effectiveAppearance()" subscriptSizing="dynamic" class="dbx-forge-datetime-date-field">
          <mat-label>{{ dateLabelSignal() }}</mat-label>
          <input matInput [matDatepicker]="picker" [formControl]="dateCtrl" [min]="minDateSignal()" [max]="maxDateSignal()" />
          <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
          <mat-datepicker #picker></mat-datepicker>
        </mat-form-field>
      }
      @if (showTimeSignal()) {
        <mat-form-field [appearance]="effectiveAppearance()" subscriptSizing="dynamic" class="dbx-forge-datetime-time-field">
          <mat-label>{{ timeLabelSignal() }}</mat-label>
          <input matInput type="time" [formControl]="timeCtrl" />
          <mat-icon matSuffix>schedule</mat-icon>
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
    .dbx-forge-datetime-field {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: flex-start;
    }
    .dbx-forge-datetime-date-field,
    .dbx-forge-datetime-time-field {
      flex: 1 1 auto;
      min-width: 140px;
    }
  `
})
export class ForgeDateTimeFieldComponent {
  private readonly materialConfig = inject(MATERIAL_CONFIG, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  // Standard ng-forge value field inputs
  readonly field: InputSignal<FieldTree<unknown>> = input.required<FieldTree<unknown>>();
  readonly key: InputSignal<string> = input.required<string>();
  readonly label: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly placeholder: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly className: InputSignal<string> = input('');
  readonly tabIndex: InputSignal<number | undefined> = input<number | undefined>();
  readonly props: InputSignal<ForgeDateTimeFieldComponentProps | undefined> = input<ForgeDateTimeFieldComponentProps | undefined>();
  readonly meta: InputSignal<Record<string, unknown> | undefined> = input<Record<string, unknown> | undefined>();
  readonly validationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();

  /**
   * Internal FormControl for the date portion.
   */
  readonly dateCtrl = new FormControl<Maybe<Date>>(null);

  /**
   * Internal FormControl for the time portion (HH:mm string).
   */
  readonly timeCtrl = new FormControl<string>('');

  // Computed props from field config
  readonly timeOnlySignal: Signal<boolean> = computed(() => this.props()?.timeOnly ?? false);
  readonly showTimeSignal: Signal<boolean> = computed(() => this.props()?.showTime ?? true);
  readonly dateLabelSignal: Signal<string> = computed(() => this.props()?.dateLabel ?? 'Date');
  readonly timeLabelSignal: Signal<string> = computed(() => this.props()?.timeLabel ?? 'Time');
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
      const signalValue: unknown = fieldState.value();

      if (!this._syncing) {
        this._syncing = true;
        const dateValue = safeToJsDate(signalValue as Maybe<Date | string>);

        if (dateValue) {
          const currentDateCtrlValue = this.dateCtrl.value;

          if (!currentDateCtrlValue || currentDateCtrlValue.getTime() !== dateValue.getTime()) {
            this.dateCtrl.setValue(dateValue, { emitEvent: false });
          }

          const hours = String(dateValue.getHours()).padStart(2, '0');
          const minutes = String(dateValue.getMinutes()).padStart(2, '0');
          const timeStr = `${hours}:${minutes}`;

          if (timeStr !== this.timeCtrl.value) {
            this.timeCtrl.setValue(timeStr, { emitEvent: false });
          }
        } else {
          this.dateCtrl.setValue(null, { emitEvent: false });
          this.timeCtrl.setValue('', { emitEvent: false });
        }

        this._syncing = false;
      }
    });

    // Sync FormControls -> Signal Forms field (outbound)
    const dateSub = this.dateCtrl.valueChanges.subscribe(() => this._syncOutbound());
    const timeSub = this.timeCtrl.valueChanges.subscribe(() => this._syncOutbound());

    this.destroyRef.onDestroy(() => {
      dateSub.unsubscribe();
      timeSub.unsubscribe();
    });
  }

  /**
   * Combines the date and time form controls into a single Date value
   * and writes it to the Signal Forms field tree.
   */
  private _syncOutbound(): void {
    if (this._syncing) {
      return;
    }

    this._syncing = true;

    const fieldTree = this.field();
    const fieldState = fieldTree();
    const dateValue = this.dateCtrl.value;
    const timeValue = this.timeCtrl.value;

    let combinedDate: Maybe<Date>;

    if (dateValue) {
      combinedDate = new Date(dateValue);

      if (timeValue) {
        const [hoursStr, minutesStr] = timeValue.split(':');
        const hours = parseInt(hoursStr, 10);
        const minutes = parseInt(minutesStr, 10);

        if (!isNaN(hours) && !isNaN(minutes)) {
          combinedDate.setHours(hours, minutes, 0, 0);
        }
      }
    } else if (this.timeOnlySignal() && timeValue) {
      // In time-only mode, use today's date as the base
      combinedDate = new Date();

      const [hoursStr, minutesStr] = timeValue.split(':');
      const hours = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr, 10);

      if (!isNaN(hours) && !isNaN(minutes)) {
        combinedDate.setHours(hours, minutes, 0, 0);
      }
    }

    const currentSignalValue = fieldState.value();
    const currentDate = safeToJsDate(currentSignalValue as Maybe<Date | string>);
    const isSame = combinedDate && currentDate ? combinedDate.getTime() === currentDate.getTime() : combinedDate === currentDate;

    if (!isSame) {
      fieldState.value.set(combinedDate ?? undefined);
      fieldState.markAsTouched();
      fieldState.markAsDirty();
    }

    this._syncing = false;
  }
}

// MARK: Mapper
/**
 * Custom mapper for the datetime field type.
 *
 * Uses the standard valueFieldMapper pattern from ng-forge/integration to resolve
 * the field tree and build the standard inputs for the component.
 *
 * @param fieldDef - The datetime field definition
 * @returns Signal containing Record of input names to values for ngComponentOutlet
 */
export function dateTimeFieldMapper(fieldDef: { key: string }): Signal<Record<string, unknown>> {
  const ctx = resolveValueFieldContext();
  const defaultProps = inject(DEFAULT_PROPS);
  const defaultValidationMessages = inject(DEFAULT_VALIDATION_MESSAGES);

  return computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return buildValueFieldInputs(fieldDef as any, ctx, defaultProps?.(), defaultValidationMessages?.());
  });
}
