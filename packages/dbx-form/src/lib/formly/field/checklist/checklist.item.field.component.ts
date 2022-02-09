import { filterMaybe, switchMapMaybeObs } from '@dereekb/rxjs';
import { shareReplay, distinctUntilChanged, switchMap, map } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs';
import {
  Component, ComponentFactoryResolver, NgZone, OnDestroy, OnInit, Type, ViewChild, ViewContainerRef
} from '@angular/core';
import { ValidationErrors, FormGroup } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyFieldConfig } from '@ngx-formly/core';
import { ChecklistItemFieldDisplayComponent, ChecklistItemFieldDisplayContentObs } from './checklist.item';
import { DbxDefaultChecklistItemFieldDisplayComponent } from './checklist.item.field.content.default.component';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';

export interface DbxChecklistItemFieldConfig<T = any> {
  /**
   * Observable used to retrieve content to display for the item.
   */
  displayContentObs: ChecklistItemFieldDisplayContentObs<T>;
  /**
   * Custom component class to use by default.
   */
  componentClass?: Type<ChecklistItemFieldDisplayComponent<T>>;
}

export interface ChecklistItemFormlyFieldConfig<T = any> extends DbxChecklistItemFieldConfig<T>, FormlyFieldConfig { }

@Component({
  templateUrl: 'checklist.item.field.component.html'
})
export class DbxChecklistItemFieldComponent<T = any> extends FieldType<ChecklistItemFormlyFieldConfig<T> & FieldTypeConfig> implements OnInit, OnDestroy {

  private _displayContent = new BehaviorSubject<Maybe<ChecklistItemFieldDisplayContentObs<T>>>(undefined);

  readonly displayContent$ = this._displayContent.pipe(
    switchMapMaybeObs(),
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

  get formGroup(): FormGroup {
    return this.form as FormGroup;
  }

  get checkboxFieldKey(): string {
    return this.key as string;
  }

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
    return this.field.componentClass ?? DbxDefaultChecklistItemFieldDisplayComponent;
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
export class DbxChecklistItemContentComponent<T = any> extends AbstractSubscriptionDirective implements OnInit {

  readonly displayContent$ = this.checklistItemFieldComponent.displayContent$;
  readonly isLoading$ = this.checklistItemFieldComponent.displayContent$

  @ViewChild('content', { static: true, read: ViewContainerRef })
  contentRef!: ViewContainerRef;

  constructor(
    readonly checklistItemFieldComponent: DbxChecklistItemFieldComponent<T>,
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
