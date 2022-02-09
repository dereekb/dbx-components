import { Component } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { first, shareReplay, switchMap, Observable, of } from 'rxjs';
import { AbstractFormExpandableSectionWrapperDirective, FormExpandableSectionWrapperTemplateOptions } from './expandable.wrapper.delegate';

export interface FormToggleSectionConfig {
  toggleLabelObs?: (open: Maybe<boolean>) => Observable<string>;
}

export interface FormToggleSectionWrapperTemplateOptions<T = any> extends FormExpandableSectionWrapperTemplateOptions<T> {
  toggleSection?: FormToggleSectionConfig;
}

export interface FormToggleSectionFormlyConfig<T = any> extends FormlyFieldConfig {
  templateOptions?: FormToggleSectionWrapperTemplateOptions<T>;
}

/**
 * Section that is expandable by a button until a value is set, or the button is pressed.
 */
@Component({
  template: `
  <div class="form-toggle-wrapper" [ngSwitch]="show$ | async">
    <div class="form-toggle-wrapper-toggle">
      <mat-slide-toggle [checked]="show$ | async" (toggleChange)="onToggleChange()">{{ $slideLabel | async }}</mat-slide-toggle>
    </div>
    <ng-container *ngSwitchCase="true">
      <ng-container #fieldComponent></ng-container>
    </ng-container>
  </div>
  `
})
export class FormToggleSectionWrapperComponent<T = any> extends AbstractFormExpandableSectionWrapperDirective<T, FormToggleSectionFormlyConfig<T>> {

  get toggleSection(): Maybe<FormToggleSectionConfig> {
    return this.to.toggleSection;
  }

  readonly $slideLabel = this._toggleOpen.pipe(
    switchMap(x => {
      if (this.toggleSection?.toggleLabelObs) {
        return this.toggleSection?.toggleLabelObs(x);
      } else {
        return of(this.expandLabel);
      }
    }),
    shareReplay(1)
  );

  onToggleChange(): void {
    this.show$.pipe(first()).subscribe((show) => {
      this._toggleOpen.next(!show);
    });
  }

}
