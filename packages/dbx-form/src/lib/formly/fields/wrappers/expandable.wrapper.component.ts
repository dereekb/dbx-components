import { hasValueOrNotEmpty } from '@/app/common/utility/value';
import { Component, Directive, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { FieldWrapper, FormlyConfig, FormlyFieldConfig, FormlyTemplateOptions } from '@ngx-formly/core';
import { BehaviorSubject, combineLatest, of, merge } from 'rxjs';
import { filter, first, map, mergeMap, publishReplay, shareReplay, startWith, switchMap, tap } from 'rxjs/operators';


export interface FormExpandableSectionConfig<T = any> {
  expandLabel?: string;
  /**
   * Optional function to use for checking value existence.
   */
  hasValueFn?: (value: T) => boolean;
}

export const DEFAULT_HAS_VALUE_FN = hasValueOrNotEmpty;

@Directive()
export class AbstractFormExpandableSectionWrapperDirective<T>
  extends FieldWrapper implements OnInit, OnDestroy {

  protected _formControlObs = new BehaviorSubject<AbstractControl>(undefined);
  readonly formControl$ = this._formControlObs.pipe(filterMaybe());

  protected _toggleOpen = new BehaviorSubject<boolean | null>(null);

  readonly hasValue$ = this.formControl$.pipe(
    switchMap((x) => x.valueChanges.pipe(startWith(x.value),
      map((value) => {
        return this.hasValueFn(value);
      }),
      shareReplay(1),
    ))
  );

  get sectionConfig(): FormExpandableSectionConfig<T> {
    return this.to.expandableSection;
  }

  get hasValueFn(): (value: T) => any {
    return this.sectionConfig.hasValueFn ?? DEFAULT_HAS_VALUE_FN;
  }

  get expandLabel(): string {
    return this.sectionConfig.expandLabel ?? this.field?.templateOptions.label ?? String(this.field?.key);
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

export interface FormExpandableSectionWrapperTemplateOptions<T = any> extends FormlyTemplateOptions {
  expandableSection?: FormExpandableSectionConfig<T>;
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
  `,
  // TODO: styleUrls: ['./wrapper.scss']
})
export class FormExpandableSectionWrapperComponent<T = any> extends AbstractFormExpandableSectionWrapperDirective<T> {

  readonly to: FormExpandableSectionWrapperTemplateOptions<T>;

  readonly show$ = this._toggleOpen.pipe(
    mergeMap((toggleOpen: boolean) => {
      if (toggleOpen) {
        return of(true);
      } else {
        return this.hasValue$;
      }
    }),
    shareReplay(1)
  );

  get sectionConfig(): FormExpandableSectionConfig<T> {
    return this.to.expandableSection;
  }

}
