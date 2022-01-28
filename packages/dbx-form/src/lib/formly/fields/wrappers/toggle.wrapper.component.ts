import { Component, OnDestroy, OnInit } from '@angular/core';
import { FieldWrapper, FormlyConfig, FormlyFieldConfig, FormlyTemplateOptions } from '@ngx-formly/core';
import { Observable } from 'rxjs';
import { of } from 'rxjs';
import { first, map, mergeMap, shareReplay, switchMap } from 'rxjs/operators';
import { AbstractFormExpandableSectionWrapperDirective, FormExpandableSectionConfig, FormExpandableSectionWrapperComponent } from './expandable.wrapper.component';

export interface FormToggleSectionConfig<T = any> extends FormExpandableSectionConfig<T> {
  toggleLabelObs?: (open: boolean) => Observable<string>;
}

export interface FormToggleSectionWrapperTemplateOptions<T = any> extends FormlyTemplateOptions {
  toggleSection?: FormToggleSectionConfig<T>;
}

/**
 * Section that is expandable by a button until a value is set, or the button is pressed.
 */
@Component({
  template: `
  <div class="form-toggle-wrapper" [ngSwitch]="show$ | async">
    <div class="form-toggle-wrapper-toggle">
      <mat-slide-toggle [checked]="show$ | async" (toggleChange)="toggled()">{{ $slideLabel | async }}</mat-slide-toggle>
    </div>
    <ng-container *ngSwitchCase="true">
      <ng-container #fieldComponent></ng-container>
    </ng-container>
  </div>
  `,
  // TODO: styleUrls: ['./wrapper.scss']
})
export class FormToggleSectionWrapperComponent<T = any> extends AbstractFormExpandableSectionWrapperDirective<T> {

  readonly to: FormToggleSectionWrapperTemplateOptions<T>;

  readonly show$ = this._toggleOpen.pipe(
    switchMap((toggleOpen: boolean) => {
      if (toggleOpen != null) {
        return of(toggleOpen);
      } else {
        return this.hasValue$;
      }
    }),
    shareReplay(1)
  );

  get sectionConfig(): FormToggleSectionConfig<T> {
    return this.to.toggleSection;
  }

  readonly $slideLabel = this._toggleOpen.pipe(
    switchMap(x => {
      if (this.sectionConfig.toggleLabelObs) {
        return this.sectionConfig.toggleLabelObs(x);
      } else {
        return of(this.expandLabel);
      }
    }),
    shareReplay(1)
  );

  toggled(): void {
    this.show$.pipe(first()).subscribe((show) => {
      this._toggleOpen.next(!show);
    });
  }

}
