import { Component } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { first, shareReplay, switchMap, Observable, of } from 'rxjs';
import { AbstractFormExpandableSectionConfig, AbstractFormExpandableSectionWrapperDirective } from './expandable.wrapper.delegate';

export interface DbxFormToggleWrapperConfig<T extends object = object> extends AbstractFormExpandableSectionConfig<T> {
  toggleLabelObs?: (open: Maybe<boolean>) => Observable<string>;
}

/**
 * Section that is expandable by a button until a value is set, or the button is pressed.
 */
@Component({
  template: `
  <div class="dbx-form-toggle-wrapper" [ngSwitch]="show$ | async">
    <div class="dbx-form-toggle-wrapper-toggle">
      <mat-slide-toggle [checked]="show$ | async" (toggleChange)="onToggleChange()">{{ slideLabel$ | async }}</mat-slide-toggle>
    </div>
    <ng-container *ngSwitchCase="true">
      <ng-container #fieldComponent></ng-container>
    </ng-container>
  </div>
  `
})
export class DbxFormToggleWrapperComponent<T extends object = object> extends AbstractFormExpandableSectionWrapperDirective<T, DbxFormToggleWrapperConfig> {

  readonly slideLabel$ = this._toggleOpen.pipe(
    switchMap(x => {
      if (this.expandableSection?.toggleLabelObs) {
        return this.expandableSection?.toggleLabelObs(x);
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
