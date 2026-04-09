import { ChangeDetectionStrategy, Component, computed, effect, input } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule, type MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatIconModule } from '@angular/material/icon';
import { MatOptionModule } from '@angular/material/core';
import { MatDivider } from '@angular/material/divider';
import { type Maybe, type PrimativeKey } from '@dereekb/util';
import { DbxInjectionComponent } from '@dereekb/dbx-core';
import { SubscriptionObject, type LoadingState } from '@dereekb/rxjs';
import { DbxLoadingModule } from '@dereekb/dbx-web';
import { BehaviorSubject, map, shareReplay, switchMap, type Observable } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { type FieldTree } from '@angular/forms/signals';
import { type SearchableValueFieldDisplayValue, type ConfiguredSearchableValueFieldDisplayValue } from '../../../../formly/field/selection/searchable/searchable';
import { DbxSearchableFieldAutocompleteItemComponent } from '../../../../formly/field/selection/searchable/searchable.field.autocomplete.item.component';
import { AbstractForgeSearchableFieldDirective, type ForgeSearchableTextFieldProps } from './searchable.field.directive';

/**
 * Forge ValueFieldComponent for searchable text selection (single value).
 *
 * Wraps the existing searchable text autocomplete pattern from formly as a standalone
 * ng-forge dynamic forms component. Receives field config via signal inputs from the mapper.
 */
@Component({
  selector: 'dbx-forge-searchable-text-field',
  templateUrl: './searchable-text.field.component.html',
  imports: [FormsModule, ReactiveFormsModule, MatAutocompleteModule, MatOptionModule, MatIconModule, MatDivider, DbxLoadingModule, DbxSearchableFieldAutocompleteItemComponent, DbxInjectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgeSearchableTextFieldComponent<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends AbstractForgeSearchableFieldDirective<T, M, H, ForgeSearchableTextFieldProps<T, M, H>> {
  readonly field = input.required<FieldTree<T>>();

  private readonly _singleValueSyncSub = new SubscriptionObject();
  private readonly _valuesSubject = new BehaviorSubject<T[]>([]);

  readonly showClearValueSignal = computed(() => this.props()?.showClearValue ?? true);

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

  private readonly _syncFieldValueEffect = effect(() => {
    const fieldValue = this.fieldValueSignal();
    const values = fieldValue != null && fieldValue !== '' ? [fieldValue] : [];
    this._valuesSubject.next(values);
  });

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

  selected(event: MatAutocompleteSelectedEvent): void {
    const value = event.option.value as SearchableValueFieldDisplayValue<T> | { _ignore?: true } | { _clear?: true };

    if ((value as any)._clear) {
      this._setFieldValue(undefined);
    } else if (!(value as any)._ignore) {
      this._setFieldValue((value as SearchableValueFieldDisplayValue<T>).value);
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
