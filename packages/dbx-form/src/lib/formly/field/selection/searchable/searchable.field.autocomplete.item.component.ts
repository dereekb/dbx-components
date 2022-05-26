import { filterMaybe } from '@dereekb/rxjs';
import { BehaviorSubject, map, Observable, shareReplay } from 'rxjs';
import { Component, Directive, Inject, InjectionToken, Input, OnDestroy } from '@angular/core';
import { ConfiguredSearchableValueFieldDisplayValue } from './searchable';
import { Maybe, mergeIntoArray } from '@dereekb/util';
import { DbxInjectionComponentConfig } from '@dereekb/dbx-core';

export const DBX_SEARCHABLE_FIELD_COMPONENT_DATA_TOKEN = new InjectionToken('DbxSearchableField');

@Component({
  selector: 'dbx-searchable-field-autocomplete-item',
  template: `
    <dbx-anchor [block]="true" [anchor]="anchor$ | async">
      <dbx-injection [config]="config$ | async"></dbx-injection>
    </dbx-anchor>
  `
})
export class DbxSearchableFieldAutocompleteItemComponent<T> implements OnDestroy {
  private _displayValue = new BehaviorSubject<Maybe<ConfiguredSearchableValueFieldDisplayValue<T>>>(undefined);
  readonly displayValue$ = this._displayValue.pipe(filterMaybe(), shareReplay(1));

  readonly config$: Observable<DbxInjectionComponentConfig> = this.displayValue$.pipe(
    map((x) => {
      const config: DbxInjectionComponentConfig = {
        ...x.display,
        providers: mergeIntoArray(
          [
            {
              provide: DBX_SEARCHABLE_FIELD_COMPONENT_DATA_TOKEN,
              useValue: x
            }
          ],
          x.display.providers
        )
      };

      return config;
    })
  );

  readonly anchor$ = this.displayValue$.pipe(map((x) => x.anchor));

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
  constructor(@Inject(DBX_SEARCHABLE_FIELD_COMPONENT_DATA_TOKEN) readonly displayValue: ConfiguredSearchableValueFieldDisplayValue<T>) {}
}

@Component({
  selector: 'dbx-default-searchable-field-display',
  template: `
    <div class="dbx-default-searchable-field-display">
      <span class="dbx-chip-label">{{ displayValue.label }}</span>
      <span class="dbx-chip-sublabel" *ngIf="displayValue.sublabel">({{ displayValue.sublabel }})</span>
    </div>
  `
})
export class DbxDefaultSearchableFieldDisplayComponent<T> extends AbstractDbxSearchableFieldDisplayDirective<T> {}
