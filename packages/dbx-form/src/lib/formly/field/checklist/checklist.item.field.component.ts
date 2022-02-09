import { ChangeDetectorRef } from '@angular/core';
import { DbxInjectedComponentConfig } from '@dereekb/dbx-core';
import { switchMapMaybeObs } from '@dereekb/rxjs';
import { shareReplay, distinctUntilChanged, map } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs';
import {
  Component, OnDestroy, OnInit, Type
} from '@angular/core';
import { ValidationErrors, FormGroup } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyFieldConfig } from '@ngx-formly/core';
import { ChecklistItemFieldDisplayComponent, ChecklistItemFieldDisplayContentObs } from './checklist.item';
import { DbxDefaultChecklistItemFieldDisplayComponent } from './checklist.item.field.content.default.component';
import { AbstractSubscriptionDirective, safeDetectChanges } from '@dereekb/dbx-core';
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

  get formControlName(): string {
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
  template: `<dbx-injected-content [config]="config"></dbx-injected-content>`
})
export class DbxChecklistItemContentComponent<T = any> extends AbstractSubscriptionDirective {

  config?: DbxInjectedComponentConfig;

  constructor(
    readonly checklistItemFieldComponent: DbxChecklistItemFieldComponent<T>,
    readonly cdRef: ChangeDetectorRef
  ) {
    super();
  }

  ngOnInit(): void {
    this.config = {
      componentClass: this.checklistItemFieldComponent.componentClass,
      init: (instance) => {
        this.checklistItemFieldComponent.displayContent$.subscribe((x) => {
          instance.displayContent = x;
          safeDetectChanges(this.cdRef);
        });
      }
    };
  }

}
