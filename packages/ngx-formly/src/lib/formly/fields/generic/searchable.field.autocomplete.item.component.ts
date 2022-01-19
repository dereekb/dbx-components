import {
  Component, ComponentFactoryResolver, ElementRef, Input, OnDestroy, OnInit, Type, ViewChild, ViewContainerRef
} from '@angular/core';
import { SearchableFieldDisplayComponent, SearchableValueFieldDisplayValue } from './searchable';

@Component({
  selector: 'dbx-searchable-field-autocomplete-item-component',
  template: `
    <ng-template #content></ng-template>
  `
})
export class DbNgxSearchableFieldAutocompleteItemComponent<T> implements OnInit {

  @ViewChild('content', { static: true, read: ViewContainerRef })
  content: ViewContainerRef;

  @Input()
  displayValue: SearchableValueFieldDisplayValue<T>;

  constructor(private resolver: ComponentFactoryResolver) { }

  ngOnInit(): void {
    this.content.clear();
    const componentClass = this.displayValue.componentClass;

    if (componentClass) {
      const factory = this.resolver.resolveComponentFactory(componentClass);
      const componentRef = this.content.createComponent(factory);
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
export class DbNgxDefaultSearchableFieldDisplayComponent<T> implements SearchableFieldDisplayComponent<T> {

  @Input()
  displayValue: SearchableValueFieldDisplayValue<T>;

}

@Component({
  template: `
    <dbx-anchor [block]="true" [anchor]="displayValue.anchor">
      <dbx-default-searchable-field-display [displayValue]="displayValue"></dbx-default-searchable-field-display>
    </dbx-anchor>
  `
})
export class DbNgxDefaultSearchableAnchorFieldDisplayComponent<T> implements SearchableFieldDisplayComponent<T> {

  @Input()
  displayValue: SearchableValueFieldDisplayValue<T>;

}
