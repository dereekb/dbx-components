import { filterMaybe } from '@dereekb/rxjs';
import { BehaviorSubject, map, Observable, shareReplay } from 'rxjs';
import { Component, Directive, Inject, InjectionToken, Input, OnDestroy } from '@angular/core';
import { ConfiguredSearchableValueFieldDisplayValue } from './searchable';
import { Maybe, mergeIntoArray } from '@dereekb/util';
import { DbxInjectedComponentConfig } from '@dereekb/dbx-core';

export const DBX_SEARCHABLE_FIELD_COMPONENT_DATA = new InjectionToken('DbxSearchableField');

@Component({
  selector: 'dbx-searchable-field-autocomplete-item',
  template: `
    <dbx-anchor [block]="true" [anchor]="anchor$ | async">
      <dbx-injected-content [config]="config$ | async"></dbx-injected-content>
    </dbx-anchor>
  `
})
export class DbxSearchableFieldAutocompleteItemComponent<T> implements OnDestroy {

  private _displayValue = new BehaviorSubject<Maybe<ConfiguredSearchableValueFieldDisplayValue<T>>>(undefined);
  readonly displayValue$ = this._displayValue.pipe(filterMaybe(), shareReplay(1));

  readonly config$: Observable<DbxInjectedComponentConfig> = this.displayValue$.pipe(map(x => {
    const config: DbxInjectedComponentConfig = {
      ...x.display,
      providers: mergeIntoArray([{
        provide: DBX_SEARCHABLE_FIELD_COMPONENT_DATA,
        useValue: x
      }], x.display.providers)
    };

    return config;
  }));

  readonly anchor$ = this.displayValue$.pipe(map(x => x.anchor));

  @Input()
  set displayValue(displayValue: ConfiguredSearchableValueFieldDisplayValue<T>) {
    this._displayValue.next(displayValue);
  }

  ngOnDestroy(): void {
    this._displayValue.complete();
  }

}

// MARK: Default
@Directive()
export abstract class AbstractDbxSearchableFieldDisplayDirective<T> {

  constructor(@Inject(DBX_SEARCHABLE_FIELD_COMPONENT_DATA) readonly displayValue: ConfiguredSearchableValueFieldDisplayValue<T>) { }

}

@Component({
  selector: 'dbx-default-searchable-field-display',
  template: `
  <div class="dbx-default-searchable-field-display">
    <span class="s-chip-label">{{ displayValue.label }}</span>
    <span class="s-chip-sublabel" *ngIf="displayValue.sublabel">({{ displayValue.sublabel }})</span>
  </div>
  `
})
export class DbxDefaultSearchableFieldDisplayComponent<T> extends AbstractDbxSearchableFieldDisplayDirective<T>{ }
