import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, viewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule, type MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatIconModule } from '@angular/material/icon';
import { MatOptionModule } from '@angular/material/core';
import { type Maybe, type PrimativeKey } from '@dereekb/util';
import { SubscriptionObject } from '@dereekb/rxjs';
import { BehaviorSubject, map, shareReplay, switchMap, type Observable } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { type FieldTree } from '@angular/forms/signals';
import { type SearchableValueFieldDisplayValue, type ConfiguredSearchableValueFieldDisplayValue } from '../../../../formly/field/selection/searchable/searchable';
import { DbxSearchableFieldAutocompleteItemComponent } from '../../../../formly/field/selection/searchable/searchable.field.autocomplete.item.component';
import { AbstractForgeSearchableFieldDirective, type DbxForgeSearchableTextFieldProps } from './searchable.field.directive';
import { createResolvedErrorsSignal, setupMetaTracking, shouldShowErrors } from '@ng-forge/dynamic-forms/integration';
import { forgeFieldDisabled } from '../../field.disabled';
import { toggleDisableFormControl } from '../../../../form/form';

/**
 * Forge ValueFieldComponent for searchable text selection (single value).
 *
 * Wraps the existing searchable text autocomplete pattern from formly as a standalone
 * ng-forge dynamic forms component. Receives field config via signal inputs from the mapper.
 */
@Component({
  selector: 'dbx-forge-searchable-text-field',
  templateUrl: './searchable-text.field.component.html',
  imports: [FormsModule, ReactiveFormsModule, MatAutocompleteModule, MatOptionModule, MatIconModule, DbxSearchableFieldAutocompleteItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgeSearchableTextFieldComponent<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends AbstractForgeSearchableFieldDirective<T, M, H, DbxForgeSearchableTextFieldProps<T, M, H>> {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly field = input.required<FieldTree<T>>();
  readonly textInputRef = viewChild<ElementRef<HTMLInputElement>>('textInput');

  private readonly _singleValueSyncSub = new SubscriptionObject();
  private readonly _valuesSubject = new BehaviorSubject<T[]>([]);

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

  readonly showClearValueSignal = computed(() => this.props()?.showClearValue ?? true);
  readonly searchLabelSignal = computed(() => this.props()?.searchLabel ?? 'Search');

  readonly fieldValueSignal = computed(() => {
    const fieldGetter = this.field();
    const fieldState = typeof fieldGetter === 'function' ? (fieldGetter as any)() : undefined;
    return fieldState?.value?.() as Maybe<T>;
  });

  readonly displayValues$: Observable<ConfiguredSearchableValueFieldDisplayValue<T, M>[]> = this._valuesSubject.pipe(
    switchMap((values: T[]) => this._loadDisplayValuesForValues(values)),
    map((x) => x?.value ?? []),
    shareReplay(1)
  );

  readonly selectedDisplayValue$ = this.displayValues$.pipe(
    map((x) => x[0]),
    shareReplay(1)
  );

  readonly selectedDisplayValueSignal = toSignal(this.selectedDisplayValue$);
  readonly hasValueSignal = computed(() => Boolean(this.selectedDisplayValueSignal()));
  readonly showSelectedDisplayValueSignal = computed(() => {
    const p = this.props();
    const showSelected = p?.showSelectedValue ?? !(p?.allowStringValues ?? false);
    return showSelected && this.hasValueSignal();
  });

  // Disabled state propagation
  private readonly _disabledEffect = effect(() => {
    toggleDisableFormControl(this.inputCtrl, this.isDisabled());
  });

  private readonly _syncFieldValueEffect = effect(() => {
    const fieldValue = this.fieldValueSignal();
    const values = fieldValue != null && fieldValue !== '' ? [fieldValue] : [];
    this._valuesSubject.next(values);
  });

  constructor() {
    super();
    setupMetaTracking(this.elementRef, this.meta as any, { selector: 'input' });
  }

  protected _onInit(): void {
    this._singleValueSyncSub.subscription = this.displayValues$.subscribe((x) => {
      if (x[0]) {
        this.inputCtrl.setValue(x[0].label, { emitEvent: false });
      }
    });
  }

  protected _onDestroy(): void {
    this._singleValueSyncSub.destroy();
    this._valuesSubject.complete();
  }

  focusInput(): void {
    this.textInputRef()?.nativeElement?.focus();
  }

  selected(event: MatAutocompleteSelectedEvent): void {
    const value = event.option.value as SearchableValueFieldDisplayValue<T> | { _ignore?: true } | { _clear?: true };

    if ((value as any)._clear) {
      this._setFieldValue(undefined);
      this.inputCtrl.setValue('', { emitEvent: false });
    } else if (!(value as any)._ignore) {
      const displayValue = value as SearchableValueFieldDisplayValue<T>;
      this._setFieldValue(displayValue.value);
      // Reset input to the display label immediately. When re-selecting the same
      // value the FieldTree signal does not change, so _singleValueSyncSub never
      // re-fires and the input would otherwise keep whatever mat-autocomplete
      // wrote (the object's toString → "[object Object]").
      this.inputCtrl.setValue(displayValue.label ?? '', { emitEvent: false });
    }
  }

  private _setFieldValue(value: Maybe<T>): void {
    const fieldGetter = this.field();
    if (!fieldGetter || typeof fieldGetter !== 'function') return;

    const fieldState = (fieldGetter as any)();
    if (fieldState?.value?.set) {
      fieldState.value.set(value);
    }
  }
}
