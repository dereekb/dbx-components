import { ChangeDetectionStrategy, Component, computed, OnDestroy, OnInit } from '@angular/core';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { AbstractDbxSearchableValueFieldDirective, SearchableValueFieldsFieldProps } from './searchable.field.directive';
import { map, shareReplay } from 'rxjs';
import { PrimativeKey } from '@dereekb/util';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { DbxLoadingModule } from '@dereekb/dbx-web';
import { DbxSearchableFieldAutocompleteItemComponent } from './searchable.field.autocomplete.item.component';
import { NgClass } from '@angular/common';
import { MatInput } from '@angular/material/input';
import { MatOptionModule } from '@angular/material/core';
import { SearchableValueFieldDisplayValue } from './searchable';

export interface SearchableTextValueFieldsFieldProps<T, M = unknown, H extends PrimativeKey = PrimativeKey> extends SearchableValueFieldsFieldProps<T, M, H> {
  readonly showSelectedValue?: boolean;
}

/**
 * Display component for selecting a single item/value.
 */
@Component({
  templateUrl: 'searchable.text.field.component.html',
  imports: [FormsModule, MatInput, NgClass, ReactiveFormsModule, DbxLoadingModule, MatOptionModule, MatAutocompleteModule, MatChipsModule, MatIconModule, DbxSearchableFieldAutocompleteItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxSearchableTextFieldComponent<T, M = unknown, H extends PrimativeKey = PrimativeKey> extends AbstractDbxSearchableValueFieldDirective<T, M, H, SearchableTextValueFieldsFieldProps<T, M, H>> implements OnInit, OnDestroy {
  override allowSyncValueToInput = true;

  readonly selectedDisplayValue$ = this.displayValues$.pipe(
    map((x) => x[0]),
    shareReplay(1)
  );

  readonly selectedDisplayValueSignal = toSignal(this.selectedDisplayValue$);
  readonly hasValueSignal = computed(() => Boolean(this.selectedDisplayValueSignal()));
  readonly showSelectedDisplayValueSignal = computed(() => this.showSelectedValue && this.hasValueSignal());

  override get searchableField(): SearchableTextValueFieldsFieldProps<T, M, H> {
    return this.props;
  }

  get showSelectedValue() {
    return this.searchableField.showSelectedValue ?? !this.allowStringValues; // Show the selected value only if string values are allowed.
  }

  get multiSelect() {
    return false;
  }

  /*
  private _clearInputSub = new SubscriptionObject();

  override ngOnInit(): void {
    super.ngOnInit();

    this._clearInputSub.subscription = this.inputValue$.pipe(skipWhile((x) => !x)).subscribe((x) => {
      if (!x) {
        // this.clearValues();
      }
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._clearInputSub.destroy();
  }
  */

  selected(event: MatAutocompleteSelectedEvent): void {
    const value = event.option.value as SearchableValueFieldDisplayValue<T> | { _ignore?: true } | { _clear?: true };

    console.log('selected', value);

    if ((value as any)._clear) {
      this.clearValues();
    } else if (!(value as any)._ignore) {
      this.addWithDisplayValue(value as SearchableValueFieldDisplayValue<T>);
    }
  }
}
