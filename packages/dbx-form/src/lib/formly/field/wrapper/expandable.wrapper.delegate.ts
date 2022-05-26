import { FormlyFieldConfig } from '@ngx-formly/material/form-field';
import { Maybe, objectIsEmpty } from '@dereekb/util';
import { FieldWrapper, FormlyTemplateOptions, FieldTypeConfig } from '@ngx-formly/core';
import { map, shareReplay, startWith, switchMap, BehaviorSubject, of } from 'rxjs';
import { Directive, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { filterMaybe } from '@dereekb/rxjs';

export interface AbstractFormExpandableSectionConfig<T extends object = object> {
  expandLabel?: string;
  /**
   * Optional function to use for checking value existence.
   */
  hasValueFn?: (value: T) => boolean;
}

export interface FormExpandableSectionWrapperTemplateOptions<T extends object = object, S extends AbstractFormExpandableSectionConfig<T> = AbstractFormExpandableSectionConfig<T>> extends FormlyTemplateOptions {
  expandWrapper?: S;
}

export interface FormExpandableSectionFormlyConfig<T extends object = object, S extends AbstractFormExpandableSectionConfig<T> = AbstractFormExpandableSectionConfig<T>> extends FormlyFieldConfig {
  templateOptions?: FormExpandableSectionWrapperTemplateOptions<T, S> & FormlyTemplateOptions;
}

export const DEFAULT_HAS_VALUE_FN = (x: object) => !objectIsEmpty(x);

@Directive()
export class AbstractFormExpandableSectionWrapperDirective<T extends object = object, S extends AbstractFormExpandableSectionConfig<T> = AbstractFormExpandableSectionConfig<T>> extends FieldWrapper<FormExpandableSectionFormlyConfig<T, S> & FieldTypeConfig> implements OnInit, OnDestroy {
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

  get expandableSection(): Maybe<S> {
    return this.to.expandWrapper;
  }

  get hasValueFn(): (value: T) => boolean {
    return this.expandableSection?.hasValueFn ?? (DEFAULT_HAS_VALUE_FN as (value: T) => boolean);
  }

  get expandLabel(): Maybe<string> {
    let label: Maybe<string> = this.expandableSection?.expandLabel ?? this.field?.templateOptions?.label;

    if (label == null) {
      const firstFieldGroup = this.field.fieldGroup?.[0];

      if (firstFieldGroup) {
        label = firstFieldGroup.templateOptions?.label ?? (firstFieldGroup.key as string);
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
