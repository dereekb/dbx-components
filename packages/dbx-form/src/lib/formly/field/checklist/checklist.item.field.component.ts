import { ChangeDetectionStrategy, Component, OnInit, Type, inject, signal } from '@angular/core';
import { DbxInjectionComponentConfig, DbxInjectionComponent, cleanSubscription } from '@dereekb/dbx-core';
import { switchMapFilterMaybe } from '@dereekb/rxjs';
import { shareReplay, distinctUntilChanged, map, Observable } from 'rxjs';
import { ValidationErrors, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyFieldProps } from '@ngx-formly/core';
import { ChecklistItemFieldDisplayComponent, ChecklistItemDisplayContent } from './checklist.item';
import { DbxDefaultChecklistItemFieldDisplayComponent } from './checklist.item.field.content.default.component';
import { type Maybe } from '@dereekb/util';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { DbxAnchorComponent } from '@dereekb/dbx-web';

@Component({
  selector: 'dbx-checklist-item-content-component',
  template: `
    <dbx-injection [config]="config"></dbx-injection>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DbxInjectionComponent]
})
export class DbxChecklistItemContentComponent<T = unknown> {
  readonly checklistItemFieldComponent = inject(DbxChecklistItemFieldComponent<T>);

  readonly config: DbxInjectionComponentConfig<ChecklistItemFieldDisplayComponent<T>> = {
    componentClass: this.checklistItemFieldComponent.componentClass,
    init: (instance) => {
      cleanSubscription(
        this.checklistItemFieldComponent.displayContent$.subscribe((content: ChecklistItemDisplayContent<T>) => {
          instance.setDisplayContent(content);
        })
      );
    }
  };
}

export interface DbxChecklistItemFieldProps<T = unknown> extends FormlyFieldProps {
  /**
   * Observable used to retrieve content to display for the item.
   */
  readonly displayContent: Observable<ChecklistItemDisplayContent<T>>;
  /**
   * Custom component class to use by default.
   */
  readonly componentClass?: Type<ChecklistItemFieldDisplayComponent<T>>;
}

@Component({
  templateUrl: 'checklist.item.field.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ReactiveFormsModule, MatCheckboxModule, DbxAnchorComponent, MatRippleModule, MatIconModule, DbxChecklistItemContentComponent]
})
export class DbxChecklistItemFieldComponent<T = unknown> extends FieldType<FieldTypeConfig<DbxChecklistItemFieldProps<T>>> implements OnInit {
  private readonly _displayContentObs = signal<Maybe<Observable<ChecklistItemDisplayContent<T>>>>(undefined);

  readonly displayContent$: Observable<ChecklistItemDisplayContent<T>> = toObservable(this._displayContentObs).pipe(switchMapFilterMaybe(), distinctUntilChanged(), shareReplay(1));

  readonly anchor$ = this.displayContent$.pipe(
    map((x: ChecklistItemDisplayContent<T>) => x.anchor),
    shareReplay(1)
  );

  readonly rippleDisabled$ = this.displayContent$.pipe(
    map((x: ChecklistItemDisplayContent<T>) => x.ripple === false || (x.ripple !== true && !x.anchor)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly anchorSignal = toSignal(this.anchor$);
  readonly rippleDisabledSignal = toSignal(this.rippleDisabled$, { initialValue: false });

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
    // field prop is finally available here
    this._displayContentObs.set(this.checklistField.displayContent);
  }
}
