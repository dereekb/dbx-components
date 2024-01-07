import { SubscriptionObject } from '@dereekb/rxjs';
import { Subject } from 'rxjs';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatChipInputEvent } from '@angular/material/chips';
import { AbstractDbxSearchableValueFieldDirective, SearchableValueFieldsFieldProps } from './searchable.field.directive';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { skipUntilTimeElapsedAfterLastEmission } from '@dereekb/date';
import { PrimativeKey } from '@dereekb/util';
import { SearchableValueFieldDisplayValue } from './searchable';

export interface SearchableChipValueFieldsFieldProps<T, M = unknown, H extends PrimativeKey = PrimativeKey> extends SearchableValueFieldsFieldProps<T, M, H> {
  /**
   * Whether or not to allow multiple items to be selected.
   */
  readonly multiSelect?: boolean;
}

@Component({
  templateUrl: 'searchable.chip.field.component.html'
})
export class DbxSearchableChipFieldComponent<T, M = unknown, H extends PrimativeKey = PrimativeKey> extends AbstractDbxSearchableValueFieldDirective<T, M, H, SearchableChipValueFieldsFieldProps<T, M, H>> implements OnInit, OnDestroy {
  private _blur = new Subject<void>();
  private _blurSub = new SubscriptionObject();

  readonly separatorKeysCodes: number[] = [ENTER, COMMA];

  selected(event: MatAutocompleteSelectedEvent): void {
    this.addWithDisplayValue(event.option.value);
  }

  tabPressedOnInput(event: KeyboardEvent): boolean {
    if (event?.key?.toLowerCase() === 'tab') {
      if (this._tryAddCurrentInputValue()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return false;
      }
    }

    return true;
  }

  addChip(event: MatChipInputEvent): void {
    const text = event.value ?? this.inputCtrl.value;
    return this._addWithTextValue(text);
  }

  override get multiSelect(): boolean {
    return this.props.multiSelect ?? true;
  }

  protected override _syncSingleValue(value: SearchableValueFieldDisplayValue<T>): void {
    // Do nothing
  }

  override ngOnInit(): void {
    super.ngOnInit();

    // Only try and add the text item as a value if a value wasn't just added (for example, clicking a value).
    this._blurSub.subscription = this._blur.pipe(skipUntilTimeElapsedAfterLastEmission(this.values$, 100)).subscribe(() => {
      this._tryAddCurrentInputValue();
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._blur.complete();
    this._blurSub.destroy();
  }

  onBlur(): void {
    this._blur.next();
  }
}
