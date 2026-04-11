import { type Maybe, objectIsEmpty } from '@dereekb/util';
import { FieldWrapper, type FormlyFieldProps, type FormlyFieldConfig } from '@ngx-formly/core';
import { map, shareReplay, startWith, switchMap, BehaviorSubject, of, distinctUntilChanged } from 'rxjs';
import { Directive, type OnDestroy, type OnInit } from '@angular/core';
import { type AbstractControl } from '@angular/forms';
import { filterMaybe } from '@dereekb/rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

/**
 * Base configuration for expandable form section wrappers.
 *
 * Controls the label displayed on the expand trigger and an optional custom
 * function to determine whether the field's value is "populated" (which auto-expands the section).
 */
export interface AbstractFormExpandSectionConfig<T extends object = object> extends Pick<FormlyFieldProps, 'label'> {
  /**
   * Label shown on the expand trigger. Falls back to the field label or first child field label.
   */
  expandLabel?: string;
  /**
   * Optional function to use for checking value existence.
   */
  hasValueFn?: (value: T) => boolean;
}

/**
 * Default value existence check that returns `true` if the object is non-empty.
 *
 * @param x - The object to check for non-emptiness
 * @returns True if the object has at least one own property
 *
 * @param x - The object to check for non-emptiness
 */
export const DEFAULT_HAS_VALUE_FN = (x: object) => !objectIsEmpty(x);

/**
 * Abstract base directive for expandable form section wrappers.
 *
 * Manages the show/hide state based on whether the field has a value or
 * whether the user manually opened the section. Subclasses provide the
 * specific UI (expand button, toggle, etc.).
 */
@Directive()
export class AbstractFormExpandSectionWrapperDirective<T extends object = object, S extends AbstractFormExpandSectionConfig<T> = AbstractFormExpandSectionConfig<T>> extends FieldWrapper<FormlyFieldConfig<S>> implements OnInit, OnDestroy {
  private static _nextId = 0;
  readonly expandContentId = `dbx-form-expand-${AbstractFormExpandSectionWrapperDirective._nextId++}`;

  protected readonly _formControlObs = new BehaviorSubject<Maybe<AbstractControl>>(undefined);
  protected readonly _toggleOpen = new BehaviorSubject<Maybe<boolean>>(undefined);

  readonly formControl$ = this._formControlObs.pipe(filterMaybe());

  readonly show$ = this._toggleOpen.pipe(
    switchMap((toggleOpen: Maybe<boolean>) => {
      if (toggleOpen != null) {
        return of(toggleOpen);
      }

      return this.hasValue$;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly hasValue$ = this.formControl$.pipe(
    switchMap((x) =>
      x.valueChanges.pipe(
        startWith(x.value),
        map((value) => {
          return this.hasValueFn(value);
        }),
        shareReplay(1)
      )
    )
  );

  readonly showSignal = toSignal(this.show$, { initialValue: false });
  readonly hasValueSignal = toSignal(this.hasValue$, { initialValue: false });

  get expandSection(): S {
    return this.props;
  }

  get hasValueFn(): (value: T) => boolean {
    return this.expandSection.hasValueFn ?? (DEFAULT_HAS_VALUE_FN as (value: T) => boolean);
  }

  get expandLabel(): Maybe<string> {
    let label: Maybe<string> = this.expandSection.expandLabel ?? this.field.props?.label;

    if (label == null) {
      const firstFieldGroup = this.field.fieldGroup?.[0];

      if (firstFieldGroup) {
        label = firstFieldGroup.props?.label ?? (firstFieldGroup.key as string);
      }
    }

    return label;
  }

  open(): void {
    this._toggleOpen.next(true);
  }

  ngOnInit(): void {
    this._formControlObs.next(this.formControl);
  }

  ngOnDestroy(): void {
    this._toggleOpen.complete();
    this._formControlObs.complete();
  }
}
