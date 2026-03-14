import { ChangeDetectionStrategy, Component, type OnInit, type Type, inject, signal } from '@angular/core';
import { type DbxInjectionComponentConfig, DbxInjectionComponent, cleanSubscription } from '@dereekb/dbx-core';
import { switchMapFilterMaybe } from '@dereekb/rxjs';
import { shareReplay, distinctUntilChanged, map, type Observable } from 'rxjs';
import { type ValidationErrors, type FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FieldType, type FieldTypeConfig, type FormlyFieldProps } from '@ngx-formly/core';
import { type ChecklistItemFieldDisplayComponent, type ChecklistItemDisplayContent } from './checklist.item';
import { DbxDefaultChecklistItemFieldDisplayComponent } from './checklist.item.field.content.default.component';
import { type Maybe } from '@dereekb/util';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { DbxAnchorComponent } from '@dereekb/dbx-web';

/**
 * Wrapper component that injects dynamic display content into a checklist item
 * via {@link DbxInjectionComponent}. Subscribes to the parent field's display content observable.
 */
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

/**
 * Formly field properties for a checklist item, providing the display content observable
 * and an optional custom display component class.
 */
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

/**
 * Formly field component that renders a single checklist item with a checkbox,
 * optional anchor link, and dynamic display content.
 *
 * The display content is provided as an observable and rendered via a configurable
 * component class (defaults to {@link DbxDefaultChecklistItemFieldDisplayComponent}).
 */
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
