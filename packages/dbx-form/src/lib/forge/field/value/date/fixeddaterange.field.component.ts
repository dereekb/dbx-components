import { Component, ChangeDetectionStrategy, input, computed, effect, type Signal, type InputSignal, DestroyRef, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule, MatDateRangePicker } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AsyncPipe } from '@angular/common';
import { DynamicTextPipe, type DynamicText, type ValidationMessages, DEFAULT_PROPS, DEFAULT_VALIDATION_MESSAGES } from '@ng-forge/dynamic-forms';
import { resolveValueFieldContext, buildValueFieldInputs, createResolvedErrorsSignal, shouldShowErrors } from '@ng-forge/dynamic-forms/integration';
import { MATERIAL_CONFIG } from '@ng-forge/dynamic-forms-material';
import type { FieldTree } from '@angular/forms/signals';
import type { Maybe } from '@dereekb/util';
import { type DateRange, safeToJsDate } from '@dereekb/date';

/**
 * Value shape for the fixed date range field.
 *
 * Uses the same `DateRange` shape as `@dereekb/date` — an object with `start` and `end` dates.
 */
export interface ForgeFixedDateRangeValue {
  readonly start?: Maybe<Date>;
  readonly end?: Maybe<Date>;
}

/**
 * Custom props for the forge fixed date range field.
 */
export interface ForgeFixedDateRangeFieldComponentProps {
  /**
   * Custom label for the start date.
   */
  readonly startLabel?: string;
  /**
   * Custom label for the end date.
   */
  readonly endLabel?: string;
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
 * Custom ng-forge field component for fixed date range selection using
 * Angular Material's mat-date-range-input.
 *
 * Bridges the Material date range picker with ng-forge Signal Forms.
 * The value is stored as a `{ start, end }` object with Date values.
 *
 * Registered as ng-forge type 'fixeddaterange'.
 */
@Component({
  selector: 'dbx-forge-fixeddaterange-field',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatDatepickerModule, MatButtonModule, MatIconModule, ReactiveFormsModule, DynamicTextPipe, AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-form-field [appearance]="effectiveAppearance()" subscriptSizing="dynamic" class="dbx-forge-fixeddaterange-field">
      @if (label()) {
        <mat-label>{{ label() | dynamicText | async }}</mat-label>
      }
      <mat-date-range-input [rangePicker]="rangePicker" [min]="minDateSignal()" [max]="maxDateSignal()">
        <input matStartDate [formControl]="startCtrl" [placeholder]="startLabelSignal()" />
        <input matEndDate [formControl]="endCtrl" [placeholder]="endLabelSignal()" />
      </mat-date-range-input>
      <mat-datepicker-toggle matIconSuffix [for]="rangePicker"></mat-datepicker-toggle>
      <mat-date-range-picker #rangePicker></mat-date-range-picker>
      @if (errorsToDisplay()[0]; as error) {
        <mat-error>{{ error.message }}</mat-error>
      } @else if (props()?.hint; as hint) {
        <mat-hint>{{ hint | dynamicText | async }}</mat-hint>
      }
    </mat-form-field>
  `
})
export class ForgeFixedDateRangeFieldComponent {
  private readonly materialConfig = inject(MATERIAL_CONFIG, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  // Standard ng-forge value field inputs
  readonly field: InputSignal<FieldTree<unknown>> = input.required<FieldTree<unknown>>();
  readonly key: InputSignal<string> = input.required<string>();
  readonly label: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly placeholder: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly className: InputSignal<string> = input('');
  readonly tabIndex: InputSignal<number | undefined> = input<number | undefined>();
  readonly props: InputSignal<ForgeFixedDateRangeFieldComponentProps | undefined> = input<ForgeFixedDateRangeFieldComponentProps | undefined>();
  readonly meta: InputSignal<Record<string, unknown> | undefined> = input<Record<string, unknown> | undefined>();
  readonly validationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();

  /**
   * Internal FormControls for start and end dates.
   */
  readonly startCtrl = new FormControl<Maybe<Date>>(null);
  readonly endCtrl = new FormControl<Maybe<Date>>(null);

  // Computed props
  readonly startLabelSignal: Signal<string> = computed(() => this.props()?.startLabel ?? 'Start date');
  readonly endLabelSignal: Signal<string> = computed(() => this.props()?.endLabel ?? 'End date');
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
      const signalValue = fieldState.value() as Maybe<ForgeFixedDateRangeValue>;

      if (!this._syncing) {
        this._syncing = true;
        const startDate = signalValue?.start ? safeToJsDate(signalValue.start) : null;
        const endDate = signalValue?.end ? safeToJsDate(signalValue.end) : null;

        const currentStart = this.startCtrl.value;
        const currentEnd = this.endCtrl.value;

        if (!currentStart || !startDate || (currentStart && startDate && currentStart.getTime() !== startDate.getTime())) {
          this.startCtrl.setValue(startDate ?? null, { emitEvent: false });
        }

        if (!currentEnd || !endDate || (currentEnd && endDate && currentEnd.getTime() !== endDate.getTime())) {
          this.endCtrl.setValue(endDate ?? null, { emitEvent: false });
        }

        this._syncing = false;
      }
    });

    // Sync FormControls -> Signal Forms field (outbound)
    const startSub = this.startCtrl.valueChanges.subscribe(() => this._syncOutbound());
    const endSub = this.endCtrl.valueChanges.subscribe(() => this._syncOutbound());

    this.destroyRef.onDestroy(() => {
      startSub.unsubscribe();
      endSub.unsubscribe();
    });
  }

  /**
   * Writes the start/end date values to the Signal Forms field tree.
   */
  private _syncOutbound(): void {
    if (this._syncing) {
      return;
    }

    this._syncing = true;

    const fieldTree = this.field();
    const fieldState = fieldTree();
    const startDate = this.startCtrl.value;
    const endDate = this.endCtrl.value;

    const newValue: ForgeFixedDateRangeValue = {
      start: startDate ?? undefined,
      end: endDate ?? undefined
    };

    fieldState.value.set(newValue);
    fieldState.markAsTouched();
    fieldState.markAsDirty();
    this._syncing = false;
  }
}

// MARK: Mapper
/**
 * Custom mapper for the fixeddaterange field type.
 *
 * Uses the standard valueFieldMapper pattern from ng-forge/integration to resolve
 * the field tree and build the standard inputs for the component.
 *
 * @param fieldDef - The fixed date range field definition
 * @returns Signal containing Record of input names to values for ngComponentOutlet
 */
export function fixedDateRangeFieldMapper(fieldDef: { key: string }): Signal<Record<string, unknown>> {
  const ctx = resolveValueFieldContext();
  const defaultProps = inject(DEFAULT_PROPS);
  const defaultValidationMessages = inject(DEFAULT_VALIDATION_MESSAGES);

  return computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return buildValueFieldInputs(fieldDef as any, ctx, defaultProps?.(), defaultValidationMessages?.());
  });
}
