import { ChangeDetectorRef, Component, OnDestroy, OnInit, Type, inject } from '@angular/core';
import { DbxInjectionComponentConfig, AbstractSubscriptionDirective, safeDetectChanges } from '@dereekb/dbx-core';
import { switchMapMaybeObs } from '@dereekb/rxjs';
import { shareReplay, distinctUntilChanged, map, BehaviorSubject } from 'rxjs';
import { ValidationErrors, FormGroup } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyFieldProps } from '@ngx-formly/core';
import { ChecklistItemFieldDisplayComponent, ChecklistItemFieldDisplayContentObs } from './checklist.item';
import { DbxDefaultChecklistItemFieldDisplayComponent } from './checklist.item.field.content.default.component';
import { type Maybe } from '@dereekb/util';

export interface DbxChecklistItemFieldProps<T = unknown> extends FormlyFieldProps {
  /**
   * Observable used to retrieve content to display for the item.
   */
  displayContentObs: ChecklistItemFieldDisplayContentObs<T>;
  /**
   * Custom component class to use by default.
   */
  componentClass?: Type<ChecklistItemFieldDisplayComponent<T>>;
}

@Component({
  templateUrl: 'checklist.item.field.component.html'
})
export class DbxChecklistItemFieldComponent<T = unknown> extends FieldType<FieldTypeConfig<DbxChecklistItemFieldProps<T>>> implements OnInit, OnDestroy {
  private readonly _displayContent = new BehaviorSubject<Maybe<ChecklistItemFieldDisplayContentObs<T>>>(undefined);
  readonly displayContent$ = this._displayContent.pipe(switchMapMaybeObs(), distinctUntilChanged(), shareReplay(1));

  readonly anchor$ = this.displayContent$.pipe(
    map((x) => x.anchor),
    shareReplay(1)
  );

  readonly rippleDisabled$ = this.displayContent$.pipe(
    map((x) => x.ripple === false || (x.ripple !== true && !x.anchor)),
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
    return this.props.label;
  }

  get description(): Maybe<string> {
    return this.props.description;
  }

  get required(): Maybe<boolean> {
    return this.props.required;
  }

  get checklistField(): DbxChecklistItemFieldProps<T> {
    return this.props;
  }

  get errors(): Maybe<ValidationErrors> {
    return this.field.formControl?.errors;
  }

  get componentClass(): Type<ChecklistItemFieldDisplayComponent<T>> {
    return this.checklistField.componentClass ?? DbxDefaultChecklistItemFieldDisplayComponent;
  }

  ngOnInit() {
    this._displayContent.next(this.checklistField.displayContentObs);
  }

  ngOnDestroy() {
    this._displayContent.complete();
  }
}

@Component({
  selector: 'dbx-checklist-item-content-component',
  template: `
    <dbx-injection [config]="config"></dbx-injection>
  `
})
export class DbxChecklistItemContentComponent<T = unknown> extends AbstractSubscriptionDirective {
  readonly cdRef = inject(ChangeDetectorRef);
  readonly checklistItemFieldComponent = inject(DbxChecklistItemFieldComponent<T>);

  readonly config: DbxInjectionComponentConfig<ChecklistItemFieldDisplayComponent<T>> = {
    componentClass: this.checklistItemFieldComponent.componentClass,
    init: (instance) => {
      this.sub = this.checklistItemFieldComponent.displayContent$.subscribe((x) => {
        instance.displayContent = x;
        safeDetectChanges(this.cdRef);
      });
    }
  };
}
