import { ChangeDetectionStrategy, Component, computed, Directive, inject, InjectionToken, input } from '@angular/core';
import { ConfiguredSearchableValueFieldDisplayValue } from './searchable';
import { mergeArraysIntoArray } from '@dereekb/util';
import { DbxInjectionComponent, DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxAnchorComponent } from '@dereekb/dbx-web';
import { MatIcon } from '@angular/material/icon';

export const DBX_SEARCHABLE_FIELD_COMPONENT_DATA_TOKEN = new InjectionToken('DbxSearchableField');

@Component({
  selector: 'dbx-searchable-field-autocomplete-item',
  template: `
    <dbx-anchor [block]="true" [anchor]="anchorSignal()">
      <dbx-injection [config]="configSignal()"></dbx-injection>
    </dbx-anchor>
  `,
  imports: [DbxAnchorComponent, DbxInjectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxSearchableFieldAutocompleteItemComponent<T> {
  readonly displayValue = input.required<ConfiguredSearchableValueFieldDisplayValue<T>>();

  readonly configSignal = computed(() => {
    const displayValue = this.displayValue();
    const config: DbxInjectionComponentConfig = {
      ...displayValue.display,
      providers: mergeArraysIntoArray(
        [
          {
            provide: DBX_SEARCHABLE_FIELD_COMPONENT_DATA_TOKEN,
            useValue: displayValue
          }
        ],
        displayValue.display.providers
      )
    };

    return config;
  });

  readonly anchorSignal = computed(() => this.displayValue().anchor);
}

// MARK: Default
@Directive()
export abstract class AbstractDbxSearchableFieldDisplayDirective<T> {
  readonly displayValue = inject<ConfiguredSearchableValueFieldDisplayValue<T>>(DBX_SEARCHABLE_FIELD_COMPONENT_DATA_TOKEN);
}

@Component({
  selector: 'dbx-default-searchable-field-display',
  template: `
    <div class="dbx-default-searchable-field-display dbx-flex-bar">
      @if (icon) {
        <mat-icon class="dbx-icon-spacer">{{ icon }}</mat-icon>
      }
      <span class="dbx-chip-label">{{ displayValue.label }}</span>
      @if (displayValue.sublabel) {
        <span class="dbx-chip-sublabel">({{ displayValue.sublabel }})</span>
      }
    </div>
  `,
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxDefaultSearchableFieldDisplayComponent<T> extends AbstractDbxSearchableFieldDisplayDirective<T> {
  readonly icon = this.displayValue.icon;
}
