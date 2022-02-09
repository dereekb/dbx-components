import { hasValueOrNotEmpty, Maybe } from '@dereekb/util';
import { FieldWrapper, FormlyTemplateOptions } from '@ngx-formly/core';
import { map, mergeMap, shareReplay, startWith, switchMap, BehaviorSubject, of } from 'rxjs';
import { Component, Directive, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { filterMaybe } from '@dereekb/rxjs';
import { FormlyFieldConfig } from '@ngx-formly/material/form-field';


export interface FormExpandableSectionConfig<T = any> {
  expandLabel?: string;
  /**
   * Optional function to use for checking value existence.
   */
  hasValueFn?: (value: T) => boolean;
}

export interface FormExpandableSectionWrapperTemplateOptions<T = any> extends FormlyTemplateOptions {
  expandableSection?: FormExpandableSectionConfig<T>;
}

export interface FormExpandableSectionFormlyConfig<T = any> extends FormlyFieldConfig {
  templateOptions?: FormExpandableSectionWrapperTemplateOptions<T>;
}

export const DEFAULT_HAS_VALUE_FN = hasValueOrNotEmpty;

@Directive()
export class AbstractFormExpandableSectionWrapperDirective<T, F extends FormExpandableSectionFormlyConfig<T> = FormExpandableSectionFormlyConfig<T>>
  extends FieldWrapper<F> implements OnInit, OnDestroy {

  protected _formControlObs = new BehaviorSubject<Maybe<AbstractControl>>(undefined);
  readonly formControl$ = this._formControlObs.pipe(filterMaybe());

  protected _toggleOpen = new BehaviorSubject<Maybe<boolean>>(undefined);

  readonly show$ = this._toggleOpen.pipe(
    mergeMap((toggleOpen: Maybe<boolean>) => {
      if (toggleOpen != null) {
        return of(toggleOpen);
      } else {
        return this.hasValue$;
      }
    }),
    shareReplay(1)
  );

  readonly hasValue$ = this.formControl$.pipe(
    switchMap((x) => x.valueChanges.pipe(startWith(x.value),
      map((value) => {
        return this.hasValueFn(value);
      }),
      shareReplay(1),
    ))
  );

  get expandableSection(): Maybe<FormExpandableSectionConfig<T>> {
    return this.to.expandableSection;
  }

  get hasValueFn(): (value: T) => any {
    return this.expandableSection?.hasValueFn ?? DEFAULT_HAS_VALUE_FN;
  }

  get expandLabel(): string {
    return this.expandableSection?.expandLabel ?? this.field?.templateOptions?.label ?? String(this.field?.key);
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

/**
 * Section that is expandable by a button until a value is set, or the button is pressed.
 */
@Component({
  template: `
  <ng-container [ngSwitch]="show$ | async">
    <ng-container *ngSwitchCase="true">
      <ng-container #fieldComponent></ng-container>
    </ng-container>
    <ng-container *ngSwitchCase="false">
      <span class="form-expandable-section-button" (click)="open()">{{ expandLabel }}</span>
    </ng-container>
  </ng-container>
  `
})
export class FormExpandableSectionWrapperComponent<T = any, F extends FormExpandableSectionFormlyConfig<T> = FormExpandableSectionFormlyConfig<T>>
  extends AbstractFormExpandableSectionWrapperDirective<T, F> {

}
