import { Component, computed, effect, ElementRef, inject, input, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule, type MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatChipsModule, type MatChipInputEvent, type MatChipSelectionChange } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatOptionModule } from '@angular/material/core';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { type Maybe, type PrimativeKey, filterUniqueValues, lastValue, convertMaybeToArray, type ArrayOrValue } from '@dereekb/util';
import { skipUntilTimeElapsedAfterLastEmission } from '@dereekb/rxjs';
import { DbxLoadingModule } from '@dereekb/dbx-web';
import { BehaviorSubject, map, shareReplay, Subject, switchMap, type Observable } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { type FieldTree } from '@angular/forms/signals';
import { type SearchableValueFieldDisplayValue, type ConfiguredSearchableValueFieldDisplayValue } from '../../../../field/selection/searchable/searchable';
import { DbxSearchableFieldAutocompleteItemComponent } from '../../../../field/selection/searchable/searchable.field.autocomplete.item.component';
import { AbstractForgeSearchableFieldDirective } from './searchable.field.directive';
import { createResolvedErrorsSignal, setupMetaTracking, shouldShowErrors } from '@ng-forge/dynamic-forms/integration';
import { dbxForgeFieldDisabled } from '../../field.util';
import { toggleDisableFormControl } from '../../../../form/form';
import { DEFAULT_DBX_FORGE_SEARCHABLE_CHIP_FIELD_INPUT_PREVIEW, DEFAULT_DBX_FORGE_SEARCHABLE_CHIP_FIELD_SUGGESTIONS_LABEL, type DbxForgeSearchableChipFieldProps, type DbxForgeSearchableChipFieldSuggestion } from './searchable-chip.field';
import { completeOnDestroy, cleanSubscription } from '@dereekb/dbx-core';

/**
 * Forge ValueFieldComponent for searchable chip selection (multi-value).
 *
 * Wraps the existing searchable chip pattern from formly as a standalone
 * ng-forge dynamic forms component. Supports adding/removing chips with autocomplete search.
 */
@Component({
  selector: 'dbx-forge-searchable-chip-field',
  templateUrl: './searchable-chip.field.component.html',
  imports: [FormsModule, ReactiveFormsModule, MatAutocompleteModule, MatChipsModule, MatOptionModule, MatIconModule, DbxLoadingModule, DbxSearchableFieldAutocompleteItemComponent]
})
export class DbxForgeSearchableChipFieldComponent<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends AbstractForgeSearchableFieldDirective<T, M, H, DbxForgeSearchableChipFieldProps<T, M, H>> {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly field = input.required<FieldTree<T | T[]>>();
  readonly separatorKeysCodes: number[] = [ENTER, COMMA];

  // Disabled state
  readonly isDisabled = dbxForgeFieldDisabled();

  // Error handling
  readonly resolvedErrors = createResolvedErrorsSignal(this.field as any, this.validationMessages, this.defaultValidationMessages);
  readonly showErrors = shouldShowErrors(this.field as any);
  readonly errorsToDisplaySignal = computed(() => (this.showErrors() ? this.resolvedErrors() : []));

  // ARIA
  protected readonly ariaInvalidSignal = computed(() => (this.showErrors() ? 'true' : null));
  protected readonly ariaDescribedBySignal = computed(() => {
    if (this.errorsToDisplaySignal().length > 0) return this.errorIdSignal();
    if (this.props()?.hint) return this.hintIdSignal();
    return null;
  });

  private readonly _blur = completeOnDestroy(new Subject<void>());
  private readonly _blurSub = cleanSubscription();
  private readonly _valuesSubject = completeOnDestroy(new BehaviorSubject<T[]>([]));

  readonly values$ = this._valuesSubject.asObservable().pipe(shareReplay(1));

  readonly displayValues$: Observable<ConfiguredSearchableValueFieldDisplayValue<T, M>[]> = this._valuesSubject.pipe(
    switchMap((values: T[]) => this._loadDisplayValuesForValues(values)),
    map((x) => x?.value ?? []),
    shareReplay(1)
  );

  readonly displayValuesSignal = toSignal(this.displayValues$, { initialValue: [] as ConfiguredSearchableValueFieldDisplayValue<T, M>[] });

  // Input
  private readonly _inputFocusedSignal = signal(false);

  readonly inputOnNewLineSignal = computed(() => this.props()?.inputOnNewLine ?? false);

  readonly inputPreviewSignal = computed(() => {
    const inputOnNewLine = this.inputOnNewLineSignal();
    return this.props()?.inputPreview ?? (inputOnNewLine ? DEFAULT_DBX_FORGE_SEARCHABLE_CHIP_FIELD_INPUT_PREVIEW : undefined);
  });

  /**
   * The input's placeholder: a configured placeholder always wins. Otherwise the input preview is shown while unfocused, and the default search placeholder while focused.
   */
  readonly inputPlaceholderSignal = computed(() => {
    const inputFocused = this._inputFocusedSignal();
    const placeholderValue = this.placeholder();
    const inputPreview = this.inputPreviewSignal();
    const searchInputPlaceholder = this.searchInputPlaceholderSignal();
    const placeholder = typeof placeholderValue === 'string' ? placeholderValue : undefined;
    let result: string;

    if (placeholder) {
      result = placeholder;
    } else if (inputPreview && !inputFocused) {
      result = inputPreview;
    } else {
      result = searchInputPlaceholder;
    }

    return result;
  });

  // Suggestions
  readonly valuesSignal = toSignal(this.values$, { initialValue: [] as T[] });

  readonly suggestionsLabelSignal = computed(() => this.props()?.suggestionsLabel ?? DEFAULT_DBX_FORGE_SEARCHABLE_CHIP_FIELD_SUGGESTIONS_LABEL);

  /**
   * Suggestions that still have at least one value that is not yet selected. Empty while the field is disabled.
   */
  readonly visibleSuggestionsSignal = computed(() => {
    const values = this.valuesSignal();
    const suggestions = this.props()?.suggestions;
    let result: DbxForgeSearchableChipFieldSuggestion<T>[] = [];

    if (suggestions?.length && !this.isDisabled()) {
      const hashForValue = this._hashForValue();
      const selectedHashes = new Set(values.map(hashForValue));
      result = suggestions.filter((suggestion) => convertMaybeToArray(suggestion.value).some((x) => !selectedHashes.has(hashForValue(x))));
    }

    return result;
  });

  // Disabled state propagation
  private readonly _disabledEffect = effect(() => {
    toggleDisableFormControl(this.inputCtrl, this.isDisabled());
  });

  private readonly _syncFieldValueEffect = effect(() => {
    const fieldGetter = this.field();
    const fieldState = typeof fieldGetter === 'function' ? (fieldGetter as any)() : undefined;
    const fieldValue = fieldState?.value?.() as Maybe<T | T[]>;
    const values = fieldValue == null ? [] : convertMaybeToArray(fieldValue as ArrayOrValue<T>).filter((v) => v != null && v !== '');
    this._valuesSubject.next(values);
  });

  /**
   * Capture-phase keydown listener that keeps Backspace from reaching Angular Material's chip input and chip row handlers, unless `backspaceRemovesChips` is enabled.
   *
   * @param event - The keydown event.
   */
  private readonly _backspaceKeydownCaptureListener = (event: KeyboardEvent) => {
    if (event.key === 'Backspace' && !this.props()?.backspaceRemovesChips) {
      const target = event.target as Maybe<HTMLElement>;
      const isEmptyChipInput = target instanceof HTMLInputElement && target.classList.contains('mat-mdc-chip-input') && !target.value;

      if (isEmptyChipInput || target?.closest('mat-chip-row')) {
        event.stopPropagation();
      }
    }
  };

  constructor() {
    super();
    setupMetaTracking(this.elementRef, this.meta, { selector: 'input' });
    this.elementRef.nativeElement.addEventListener('keydown', this._backspaceKeydownCaptureListener, true);
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

      result ??= 'Invalid input';
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
    this.elementRef.nativeElement.removeEventListener('keydown', this._backspaceKeydownCaptureListener, true);
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

  /**
   * Handles a suggestion chip being picked by the user (click, Enter, or Space).
   *
   * The chip is immediately deselected so it never renders as a selected filter chip; the suggestion hides itself once its values are added.
   *
   * @param event - The chip selection change event.
   * @param suggestion - The suggestion that was picked.
   */
  suggestionSelectionChange(event: MatChipSelectionChange, suggestion: DbxForgeSearchableChipFieldSuggestion<T>): void {
    if (event.isUserInput) {
      event.source.deselect();
      this.addSuggestion(suggestion);
    }
  }

  /**
   * Adds every value of the input suggestion to the field.
   *
   * @param suggestion - The suggestion whose values to add.
   */
  addSuggestion(suggestion: DbxForgeSearchableChipFieldSuggestion<T>): void {
    this._setValues([...this._valuesSubject.getValue(), ...convertMaybeToArray(suggestion.value)]);
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

  onFocus(): void {
    this._inputFocusedSignal.set(true);
  }

  onBlur(): void {
    this._inputFocusedSignal.set(false);
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
      newValue = values[0];
    }

    const fieldState = (fieldGetter as any)();
    if (fieldState?.value?.set) {
      // Use null (not undefined) for "no value": single-value mode yields `values[0]` === undefined
      // when empty, and undefined orphans the Signal Forms field (NG01902/NG01901).
      fieldState.value.set(newValue ?? null);
    }
  }
}
