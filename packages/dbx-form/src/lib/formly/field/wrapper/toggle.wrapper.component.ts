import { Component } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { first, shareReplay, switchMap, Observable, of } from 'rxjs';
import { AbstractFormExpandSectionConfig, AbstractFormExpandSectionWrapperDirective } from './expand.wrapper.delegate';

export interface DbxFormToggleWrapperConfig<T extends object = object> extends AbstractFormExpandSectionConfig<T> {
  toggleLabelObs?: (open: Maybe<boolean>) => Observable<string>;
}

/**
 * Section that can be expanded by a button until a value is set, or the button is pressed.
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
export class DbxFormToggleWrapperComponent<T extends object = object> extends AbstractFormExpandSectionWrapperDirective<T, DbxFormToggleWrapperConfig> {
  readonly slideLabel$ = this._toggleOpen.pipe(
    switchMap((x) => {
      if (this.expandSection?.toggleLabelObs) {
        return this.expandSection?.toggleLabelObs(x);
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
