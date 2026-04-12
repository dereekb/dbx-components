import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule, type MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatChipsModule, type MatChipInputEvent } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatOptionModule } from '@angular/material/core';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { type Maybe, type PrimativeKey, filterUniqueValues, lastValue, convertMaybeToArray, type ArrayOrValue } from '@dereekb/util';
import { SubscriptionObject, skipUntilTimeElapsedAfterLastEmission } from '@dereekb/rxjs';
import { DbxLoadingModule } from '@dereekb/dbx-web';
import { BehaviorSubject, map, shareReplay, Subject, switchMap, type Observable } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { type FieldTree } from '@angular/forms/signals';
import { type SearchableValueFieldDisplayValue, type ConfiguredSearchableValueFieldDisplayValue } from '../../../../formly/field/selection/searchable/searchable';
import { DbxSearchableFieldAutocompleteItemComponent } from '../../../../formly/field/selection/searchable/searchable.field.autocomplete.item.component';
import { AbstractForgeSearchableFieldDirective, type DbxForgeSearchableChipFieldProps } from './searchable.field.directive';
import { createResolvedErrorsSignal, setupMetaTracking, shouldShowErrors } from '@ng-forge/dynamic-forms/integration';
import { forgeFieldDisabled } from '../../field.util';
import { toggleDisableFormControl } from '../../../../form/form';

/**
 * Forge ValueFieldComponent for searchable chip selection (multi-value).
 *
 * Wraps the existing searchable chip pattern from formly as a standalone
 * ng-forge dynamic forms component. Supports adding/removing chips with autocomplete search.
 */
@Component({
  selector: 'dbx-forge-searchable-chip-field',
  templateUrl: './searchable-chip.field.component.html',
  imports: [FormsModule, ReactiveFormsModule, MatAutocompleteModule, MatChipsModule, MatOptionModule, MatIconModule, DbxLoadingModule, DbxSearchableFieldAutocompleteItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgeSearchableChipFieldComponent<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends AbstractForgeSearchableFieldDirective<T, M, H, DbxForgeSearchableChipFieldProps<T, M, H>> {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly field = input.required<FieldTree<T | T[]>>();
  readonly separatorKeysCodes: number[] = [ENTER, COMMA];

  // Disabled state
  readonly isDisabled = forgeFieldDisabled();

  // Error handling
  readonly resolvedErrors = createResolvedErrorsSignal(this.field as any, this.validationMessages, this.defaultValidationMessages);
  readonly showErrors = shouldShowErrors(this.field as any);
  readonly errorsToDisplay = computed(() => (this.showErrors() ? this.resolvedErrors() : []));

  // ARIA
  protected readonly ariaInvalid = computed(() => (this.showErrors() ? 'true' : null));
  protected readonly ariaDescribedBy = computed(() => {
    if (this.errorsToDisplay().length > 0) return this.errorId();
    if (this.props()?.hint) return this.hintId();
    return null;
  });

  private readonly _blur = new Subject<void>();
  private readonly _blurSub = new SubscriptionObject();
  private readonly _valuesSubject = new BehaviorSubject<T[]>([]);

  readonly values$ = this._valuesSubject.asObservable().pipe(shareReplay(1));

  readonly displayValues$: Observable<ConfiguredSearchableValueFieldDisplayValue<T, M>[]> = this._valuesSubject.pipe(
    switchMap((values: T[]) => this._loadDisplayValuesForValues(values)),
    map((x) => x?.value ?? []),
    shareReplay(1)
  );

  readonly displayValuesSignal = toSignal(this.displayValues$, { initialValue: [] as ConfiguredSearchableValueFieldDisplayValue<T, M>[] });

  // Disabled state propagation
  private readonly _disabledEffect = effect(() => {
    toggleDisableFormControl(this.inputCtrl, this.isDisabled());
  });

  private readonly _syncFieldValueEffect = effect(() => {
    const fieldGetter = this.field();
    const fieldState = typeof fieldGetter === 'function' ? (fieldGetter as any)() : undefined;
    const fieldValue = fieldState?.value?.() as Maybe<T | T[]>;
    const values = fieldValue != null ? convertMaybeToArray(fieldValue as ArrayOrValue<T>).filter((v) => v != null && v !== '') : [];
    this._valuesSubject.next(values);
  });

  constructor() {
    super();
    setupMetaTracking(this.elementRef, this.meta as any, { selector: 'input' });
  }

  get inputErrorMessage(): Maybe<string> {
    const errors = this.inputCtrl.errors;
    let result: Maybe<string>;

    if (errors) {
      for (const key of Object.keys(errors)) {
        const error = errors[key];

        if (typeof error === 'string') {
          result = error;
          break;
        } else if (error?.message) {
          result = error.message;
          break;
        }
      }

      if (result == null) {
        result = 'Invalid input';
      }
    }

    return result;
  }

  protected _onInit(): void {
    const p = this.props();

    if (p?.textInputValidator) {
      this.inputCtrl.setValidators(p.textInputValidator);
    }

    this._blurSub.subscription = this._blur.pipe(skipUntilTimeElapsedAfterLastEmission(this.values$, 100)).subscribe(() => {
      this._tryAddCurrentInputValue();
    });
  }

  protected _onDestroy(): void {
    this._valuesSubject.complete();
    this._blur.complete();
    this._blurSub.destroy();
  }

  selectedChip(event: MatAutocompleteSelectedEvent): void {
    this._addValue((event.option.value as SearchableValueFieldDisplayValue<T>).value);
  }

  removeWithDisplayValue(displayValue: SearchableValueFieldDisplayValue<T>): void {
    this._removeValue(displayValue.value);
  }

  addChip(event: MatChipInputEvent): void {
    const text = event.value ?? this.inputCtrl.value;
    this._addWithTextValue(text ?? '');
  }

  tabPressedOnInput(event: KeyboardEvent): boolean {
    if (event?.key?.toLowerCase() === 'tab' && this._tryAddCurrentInputValue()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return false;
    }

    return true;
  }

  onBlur(): void {
    this._blur.next();
  }

  // MARK: Internal
  private get _multiSelect(): boolean {
    return this.props()?.multiSelect ?? true;
  }

  private get _asArrayValue(): boolean {
    return this.props()?.asArrayValue ?? true;
  }

  private get _pickOnlyOne(): boolean {
    return this._asArrayValue === false || this._multiSelect === false;
  }

  private get _allowStringValues(): boolean {
    return this.props()?.allowStringValues ?? Boolean(this.props()?.convertStringValue);
  }

  private _tryAddCurrentInputValue(): boolean {
    if (this._allowStringValues) {
      const value = (this.inputCtrl.value || '').trim();

      if (value) {
        this._addWithTextValue(value);
        return true;
      }
    }

    return false;
  }

  private _addWithTextValue(text: string): void {
    if (!this._allowStringValues) {
      return;
    }

    text = (text || '').trim();

    if (text) {
      this.inputCtrl.setValue(text);
    }

    if (!this.inputCtrl.valid) {
      this.inputCtrl.markAsTouched();
      return;
    }

    if (text) {
      const convertFn = this.props()?.convertStringValue;
      const value = convertFn ? convertFn(text) : (text as unknown as T);
      this._addValue(value);
    }
  }

  private _addValue(value: T): void {
    this.inputCtrl.setValue(null);
    const currentValues = this._valuesSubject.getValue();
    this._setValues([...currentValues, value]);
  }

  private _removeValue(value: T): void {
    const hashForValue = this._hashForValue();
    const hashToFilter = hashForValue(value);
    const values = this._valuesSubject.getValue().filter((x) => hashForValue(x) !== hashToFilter);
    this._setValues(values);
  }

  private _setValues(values: T[]): void {
    const hashForValue = this._hashForValue();
    values = filterUniqueValues(values, hashForValue);

    if (this._pickOnlyOne) {
      values = [lastValue(values)].filter((x) => x != null);
    }

    this._valuesSubject.next(values);
    this._setFieldValue(values);
  }

  private _setFieldValue(values: T[]): void {
    const fieldGetter = this.field();
    if (!fieldGetter || typeof fieldGetter !== 'function') return;

    let newValue: T | T[] = values;

    if (!this._asArrayValue) {
      newValue = values[0] as T;
    }

    const fieldState = (fieldGetter as any)();
    if (fieldState?.value?.set) {
      fieldState.value.set(newValue);
    }
  }
}
