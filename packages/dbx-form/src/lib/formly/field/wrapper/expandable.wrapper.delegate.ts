import { Maybe, objectIsEmpty } from '@dereekb/util';
import { FieldWrapper, FormlyFieldProps, FormlyFieldConfig } from '@ngx-formly/core';
import { map, shareReplay, startWith, switchMap, BehaviorSubject, of, distinctUntilChanged } from 'rxjs';
import { Directive, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { filterMaybe, tapLog } from '@dereekb/rxjs';

export interface AbstractFormExpandableSectionConfig<T extends object = object> extends Pick<FormlyFieldProps, 'label'> {
  expandLabel?: string;
  /**
   * Optional function to use for checking value existence.
   */
  hasValueFn?: (value: T) => boolean;
}

export const DEFAULT_HAS_VALUE_FN = (x: object) => !objectIsEmpty(x);

@Directive()
export class AbstractFormExpandableSectionWrapperDirective<T extends object = object, S extends AbstractFormExpandableSectionConfig<T> = AbstractFormExpandableSectionConfig<T>> extends FieldWrapper<FormlyFieldConfig<S>> implements OnInit, OnDestroy {
  protected _formControlObs = new BehaviorSubject<Maybe<AbstractControl>>(undefined);
  readonly formControl$ = this._formControlObs.pipe(filterMaybe());

  protected _toggleOpen = new BehaviorSubject<Maybe<boolean>>(undefined);

  readonly show$ = this._toggleOpen.pipe(
    switchMap((toggleOpen: Maybe<boolean>) => {
      if (toggleOpen != null) {
        return of(toggleOpen);
      } else {
        return this.hasValue$;
      }
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

  get expandableSection(): S {
    return this.props;
  }

  get hasValueFn(): (value: T) => boolean {
    return this.expandableSection.hasValueFn ?? (DEFAULT_HAS_VALUE_FN as (value: T) => boolean);
  }

  get expandLabel(): Maybe<string> {
    let label: Maybe<string> = this.expandableSection.expandLabel ?? this.field.props?.label;

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
