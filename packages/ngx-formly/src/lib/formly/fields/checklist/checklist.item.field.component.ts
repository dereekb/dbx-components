import { shareReplay, distinctUntilChanged, switchMap, filter, map } from 'rxjs/operators';
import { Observable, BehaviorSubject } from 'rxjs';
import {
  Component, ComponentFactoryResolver, ElementRef, NgZone, OnDestroy, OnInit, Type, ViewChild, ViewContainerRef
} from '@angular/core';
import { AbstractControl, FormControl, ValidationErrors, Validators } from '@angular/forms';
import { FieldType, FormlyFieldConfig } from '@ngx-formly/core';
import { ChecklistItemDisplayContent, ChecklistItemFieldDisplayComponent, ChecklistItemFieldDisplayContentObs } from './checklist.item';
import { DbNgxDefaultChecklistItemFieldDisplayComponent } from './checklist.item.field.content.default.component';
import { AbstractSubscriptionDirective } from '@dereekb/ngx-core';

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
  styleUrls: ['./checklist.item.scss']
})
export class DbNgxChecklistItemFieldComponent<T = any> extends FieldType<ChecklistItemFormlyFieldConfig<T>> implements OnInit, OnDestroy {

  private _displayContent = new BehaviorSubject<ChecklistItemFieldDisplayContentObs<T>>(undefined);

  readonly displayContent$ = this._displayContent.pipe(
    filter(x => Boolean(x)),
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

  get label(): string {
    return this.field.templateOptions.label;
  }

  get description(): string {
    return this.field.templateOptions.description;
  }

  get required(): boolean {
    return this.field.templateOptions.required;
  }

  get errors(): ValidationErrors {
    return this.field.formControl.errors;
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
  contentRef: ViewContainerRef;

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

    const factory = this.resolver.resolveComponentFactory(componentClass);
    const componentRef = this.contentRef.createComponent(factory);

    this.sub = this.checklistItemFieldComponent.displayContent$.subscribe((x) => {
      this.ngZone.run(() => componentRef.instance.displayContent = x);
    });
  }

}
