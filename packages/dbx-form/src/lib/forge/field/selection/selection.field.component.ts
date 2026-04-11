import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, type OnDestroy, untracked } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatHint } from '@angular/material/input';
import { DynamicTextPipe, type DynamicText, type FieldMeta, type ValidationMessages, type ValueType, type BaseValueField } from '@ng-forge/dynamic-forms';
import { createResolvedErrorsSignal, setupMetaTracking, shouldShowErrors } from '@ng-forge/dynamic-forms/integration';
import { MATERIAL_CONFIG, type MatSelectProps } from '@ng-forge/dynamic-forms-material';
import { AsyncPipe } from '@angular/common';
import { asObservable, maybeValueFromObservableOrValue, type ObservableOrValue, SubscriptionObject, switchMapMaybe } from '@dereekb/rxjs';
import { BehaviorSubject, combineLatest, distinct, distinctUntilChanged, map, Subscription } from 'rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import type { ValueSelectionOption, ValueSelectionOptionClear } from '../../../field/field.selection';
import { Maybe } from '@dereekb/util';
import { cleanSubscription, completeOnDestroy } from '@dereekb/dbx-core';

// MARK: Resolved Option
/**
 * A fully resolved selection option with label and value, ready for rendering in a `<mat-option>`.
 *
 * Produced by resolving {@link ValueSelectionOption} items: value options pass through,
 * while clear options are mapped to `{ label, value: null }`.
 */
export interface DbxForgeResolvedSelectionOption<T> {
  readonly label: string;
  readonly value: T | null;
  readonly disabled?: boolean;
}

// MARK: Props
/**
 * Props interface for the forge value selection field component.
 *
 * Passed via the `props` property on the forge field definition.
 */
export interface DbxForgeValueSelectionFieldProps<T = unknown> extends MatSelectProps {
  /**
   * Options to select from.
   *
   * Accepts a static array or an Observable that emits option arrays.
   * Options may include {@link ValueSelectionOptionClear} entries with `clear: true`.
   */
  readonly options: ObservableOrValue<ValueSelectionOption<T>[]>;
  /**
   * When true or a string, adds a clear/reset option at the top of the options list.
   * If a string is provided, it is used as the clear option label.
   *
   * If the options already contain a clear option, no additional one is added.
   */
  readonly addClearOption?: boolean | string;
}

/**
 * The custom forge field type name for the value selection field.
 */
export const FORGE_VALUE_SELECTION_FIELD_TYPE = 'dbx-value-selection' as const;

/**
 * Forge field definition interface for the value selection field.
 */
export interface DbxForgeValueSelectionFieldDef<T = unknown> extends BaseValueField<DbxForgeValueSelectionFieldProps<T>, T> {
  readonly type: typeof FORGE_VALUE_SELECTION_FIELD_TYPE;
}

// MARK: Resolve Options
/**
 * Resolves {@link ValueSelectionOption} items into flat {@link DbxForgeResolvedSelectionOption} items
 * suitable for rendering in `<mat-option>`.
 *
 * Maps `ValueSelectionOptionClear` (`{ clear: true }`) to `{ label, value: null }`.
 * Optionally prepends a clear option if `addClearOption` is configured and no clear option exists.
 *
 * @param options - Source selection options
 * @param addClearOption - Whether to prepend a clear option
 * @returns Resolved options ready for rendering
 */
export function resolveForgeSelectionOptions<T>(options: ValueSelectionOption<T>[], addClearOption: boolean | string): DbxForgeResolvedSelectionOption<T>[] {
  const hasClear = options.some((x) => (x as ValueSelectionOptionClear).clear);

  let resolvedOptions: DbxForgeResolvedSelectionOption<T>[] = options.map((option) => {
    if ((option as ValueSelectionOptionClear).clear) {
      return {
        label: (option as ValueSelectionOptionClear).label ?? '',
        value: null
      };
    }

    return option as DbxForgeResolvedSelectionOption<T>;
  });

  if (addClearOption && !hasClear) {
    const clearLabel = typeof addClearOption === 'string' ? addClearOption : '-- Clear --';
    resolvedOptions = [{ label: clearLabel, value: null }, ...resolvedOptions];
  }

  return resolvedOptions;
}

// MARK: Component
/**
 * Forge ValueFieldComponent for value-selection (dropdown) fields.
 *
 * Mirrors ng-forge's built-in `MatSelectFieldComponent` but adds support for
 * {@link ValueSelectionOption} (including clear options), Observable option sources,
 * and `addClearOption` configuration.
 *
 * Uses `[formField]` for native ng-forge value binding, `<mat-form-field>` for proper
 * Material rendering, and `[attr.hidden]` for built-in logic (hidden/disabled) support.
 */
@Component({
  selector: 'dbx-forge-value-selection-field',
  templateUrl: './selection.field.component.html',
  imports: [MatFormField, MatLabel, MatSelect, MatOption, MatHint, FormField, MatError, DynamicTextPipe, AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {
    '[id]': '`${key()}`',
    '[attr.data-testid]': 'key()',
    '[class]': 'className()',
    '[attr.hidden]': 'field()().hidden() || null'
  }
})
export class DbxForgeValueSelectionFieldComponent<T = unknown> {
  private readonly materialConfig = inject(MATERIAL_CONFIG, { optional: true });
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  // ng-forge ValueFieldComponent inputs
  readonly field = input.required<FieldTree<ValueType>>();
  readonly key = input.required<string>();
  readonly label = input<DynamicText | undefined>();
  readonly placeholder = input<DynamicText | undefined>();
  readonly className = input<string>('');
  readonly tabIndex = input<number | undefined>();
  readonly props = input<DbxForgeValueSelectionFieldProps<T> | undefined>();
  readonly meta = input<FieldMeta | undefined>();
  readonly validationMessages = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages = input<ValidationMessages | undefined>();

  // Derived signals
  readonly addClearOptionSignal = computed(() => this.props()?.addClearOption);
  readonly addClearOption$ = toObservable(this.addClearOptionSignal).pipe(distinctUntilChanged());

  readonly inputOptionsSignal = computed(() => this.props()?.options);
  readonly inputOptions$ = toObservable(this.inputOptionsSignal).pipe(maybeValueFromObservableOrValue());

  readonly resolvedOptions$ = combineLatest([this.inputOptions$, this.addClearOption$]).pipe(map(([options, addClearOption]) => resolveForgeSelectionOptions(options ?? [], addClearOption ?? false)));
  readonly resolvedOptionsSignal = toSignal(this.resolvedOptions$);

  readonly multipleSignal = computed(() => this.props()?.multiple ?? false);
  readonly effectiveAppearance = computed(() => this.props()?.appearance ?? this.materialConfig?.appearance ?? 'outline');
  readonly effectiveSubscriptSizing = computed(() => this.props()?.subscriptSizing ?? this.materialConfig?.subscriptSizing ?? 'dynamic');
  readonly compareWithSignal = computed(() => this.props()?.compareWith ?? Object.is);

  // Error display
  readonly resolvedErrors = createResolvedErrorsSignal(this.field as any, this.validationMessages, this.defaultValidationMessages);
  readonly showErrors = shouldShowErrors(this.field as any);
  readonly errorsToDisplay = computed(() => (this.showErrors() ? this.resolvedErrors() : []));

  /** Unique ID for the hint element */
  protected readonly hintId = computed(() => `${this.key()}-hint`);

  /** Base ID for error elements */
  protected readonly errorId = computed(() => `${this.key()}-error`);

  // Accessibility
  protected readonly ariaInvalid = computed(() => (this.showErrors() ? 'true' : null));
  protected readonly ariaRequired = computed(() => (this.field()().required() ? 'true' : null));
  protected readonly ariaDescribedBy = computed(() => {
    if (this.errorsToDisplay().length > 0) return this.errorId();
    if (this.props()?.hint) return this.hintId();
    return null;
  });

  constructor() {
    setupMetaTracking(this.elementRef, this.meta as any, { selector: 'mat-select' });
  }
}
