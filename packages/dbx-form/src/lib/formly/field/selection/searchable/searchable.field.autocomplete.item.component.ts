import { Component, Input, OnInit, ViewChild, ViewContainerRef } from '@angular/core';
import { SearchableFieldDisplayComponent, SearchableValueFieldDisplayValue } from './searchable';

@Component({
  selector: 'dbx-searchable-field-autocomplete-item',
  template: `
    <ng-template #content></ng-template>
  `
})
export class DbxSearchableFieldAutocompleteItemComponent<T> implements OnInit {

  @ViewChild('content', { static: true, read: ViewContainerRef })
  content!: ViewContainerRef;

  @Input()
  displayValue?: SearchableValueFieldDisplayValue<T>;

  ngOnInit(): void {
    this.content.clear();
    const componentClass = this.displayValue?.componentClass;

    if (componentClass) {
      const componentRef = this.content.createComponent(componentClass);
      componentRef.instance.displayValue = this.displayValue;
    }
  }

  // TODO: May need to handle the component being reused/input changing.

}

// MARK: Default
@Component({
  selector: 'dbx-default-searchable-field-display',
  template: `
    <span class="s-chip-label">{{ displayValue.label }}</span>
    <span class="s-chip-sublabel" *ngIf="displayValue.sublabel">({{ displayValue.sublabel }})</span>
  `
})
export class DbxDefaultSearchableFieldDisplayComponent<T> implements SearchableFieldDisplayComponent<T> {

  @Input()
  displayValue!: SearchableValueFieldDisplayValue<T>;

}

@Component({
  template: `
    <dbx-anchor [block]="true" [anchor]="displayValue?.anchor">
      <dbx-default-searchable-field-display [displayValue]="displayValue"></dbx-default-searchable-field-display>
    </dbx-anchor>
  `
})
export class DbxDefaultSearchableAnchorFieldDisplayComponent<T> implements SearchableFieldDisplayComponent<T> {

  @Input()
  displayValue!: SearchableValueFieldDisplayValue<T>;

}
