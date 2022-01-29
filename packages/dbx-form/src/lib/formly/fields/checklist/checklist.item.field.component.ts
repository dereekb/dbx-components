import { filterMaybe } from '@dereekb/rxjs';
import { shareReplay, distinctUntilChanged, switchMap, map } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs';
import {
  Component, ComponentFactoryResolver, NgZone, OnDestroy, OnInit, Type, ViewChild, ViewContainerRef
} from '@angular/core';
import { ValidationErrors } from '@angular/forms';
import { FieldType, FormlyFieldConfig } from '@ngx-formly/core';
import { ChecklistItemFieldDisplayComponent, ChecklistItemFieldDisplayContentObs } from './checklist.item';
import { DbNgxDefaultChecklistItemFieldDisplayComponent } from './checklist.item.field.content.default.component';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';

export interface DbNgxChecklistItemFieldConfig<T = any> {
  /**
   * Observable used to retrieve content to display for the item.
   */
  displayContentObs: ChecklistItemFieldDisplayContentObs<T>;
  /**
   * Custom component class to use by default.
   */
  componentClass?: Type<ChecklistItemFieldDisplayComponent<T>>;
}

export interface ChecklistItemFormlyFieldConfig<T = any> extends DbNgxChecklistItemFieldConfig<T>, FormlyFieldConfig { }

@Component({
  templateUrl: 'checklist.item.field.component.html',
  // TODO: styleUrls: ['./checklist.item.scss']
})
export class DbNgxChecklistItemFieldComponent<T = any> extends FieldType<ChecklistItemFormlyFieldConfig<T>> implements OnInit, OnDestroy {

  private _displayContent = new BehaviorSubject<Maybe<ChecklistItemFieldDisplayContentObs<T>>>(undefined);

  readonly displayContent$ = this._displayContent.pipe(
    filterMaybe(),
    switchMap(x => x),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly anchor$ = this.displayContent$.pipe(
    map(x => x.anchor),
    shareReplay(1)
  );

  readonly rippleDisabled$ = this.displayContent$.pipe(
    map(x => x.ripple === false || (x.ripple !== true && !x.anchor)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  get label(): Maybe<string> {
    return this.field.templateOptions?.label;
  }

  get description(): Maybe<string> {
    return this.field.templateOptions?.description;
  }

  get required(): Maybe<boolean> {
    return this.field.templateOptions?.required;
  }

  get errors(): Maybe<ValidationErrors> {
    return this.field.formControl?.errors;
  }

  get componentClass(): Type<ChecklistItemFieldDisplayComponent<T>> {
    return this.field.componentClass ?? DbNgxDefaultChecklistItemFieldDisplayComponent;
  }

  ngOnInit() {
    this._displayContent.next(this.field.displayContentObs);
  }

  ngOnDestroy() {
    this._displayContent.complete();
  }

}

@Component({
  selector: 'dbx-checklist-item-content-component',
  template: `
    <ng-template #content></ng-template>
  `
})
export class DbNgxChecklistItemContentComponent<T = any> extends AbstractSubscriptionDirective implements OnInit {

  readonly displayContent$ = this.checklistItemFieldComponent.displayContent$;
  readonly isLoading$ = this.checklistItemFieldComponent.displayContent$

  @ViewChild('content', { static: true, read: ViewContainerRef })
  contentRef!: ViewContainerRef;

  constructor(
    readonly checklistItemFieldComponent: DbNgxChecklistItemFieldComponent<T>,
    readonly resolver: ComponentFactoryResolver,
    readonly ngZone: NgZone
  ) {
    super();
  }

  ngOnInit(): void {
    this.contentRef.clear();
    const componentClass = this.checklistItemFieldComponent.componentClass;
    const componentRef = this.contentRef.createComponent(componentClass);

    this.sub = this.checklistItemFieldComponent.displayContent$.subscribe((x) => {
      this.ngZone.run(() => componentRef.instance.displayContent = x);
    });
  }

}
