import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { first, shareReplay, switchMap, Observable, of } from 'rxjs';
import { AbstractFormExpandSectionConfig, AbstractFormExpandSectionWrapperDirective } from './expand.wrapper.delegate';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { toSignal } from '@angular/core/rxjs-interop';

export interface DbxFormToggleWrapperConfig<T extends object = object> extends AbstractFormExpandSectionConfig<T> {
  toggleLabelObs?: (open: Maybe<boolean>) => Observable<string>;
}

/**
 * Section that can be expanded by a button until a value is set, or the button is pressed.
 */
@Component({
  template: `
    <div class="dbx-form-toggle-wrapper">
      <div class="dbx-form-toggle-wrapper-toggle">
        <mat-slide-toggle [checked]="showSignal()" (toggleChange)="onToggleChange()">{{ slideLabelSignal() }}</mat-slide-toggle>
      </div>
      @if (showSignal()) {
        <ng-container #fieldComponent></ng-container>
      }
    </div>
  `,
  imports: [MatSlideToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
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

  readonly slideLabelSignal = toSignal(this.slideLabel$, { initialValue: '' });

  onToggleChange(): void {
    this.show$.pipe(first()).subscribe((show) => {
      this._toggleOpen.next(!show);
    });
  }
}
