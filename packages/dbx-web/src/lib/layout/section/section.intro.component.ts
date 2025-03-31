import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { DbxSectionComponent } from './section.component';
import { Maybe } from '@dereekb/util';
import { MatButton } from '@angular/material/button';
import { NgSwitch, NgSwitchCase } from '@angular/common';

/**
 * Component used to format content that displays an intro until a button is pressed.
 */
@Component({
  selector: 'dbx-intro-action-section',
  template: `
    <div class="dbx-intro-action-section">
      @switch (showIntro()) {
        @case (true) {
          <div class="dbx-intro-action-section-intro">
            <p>{{ hint() }}</p>
            <div>
              <ng-content select="[info]"></ng-content>
            </div>
            <div>
              <button mat-raised-button color="accent" (click)="actionClicked()">{{ action() }}</button>
            </div>
          </div>
        }
        @case (false) {
          <ng-content></ng-content>
        }
      }
    </div>
  `,
  standalone: true,
  imports: [MatButton],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxIntroActionSectionComponent {
  readonly hint = input<Maybe<string>>();
  readonly showIntro = input<Maybe<boolean>>(true);
  readonly action = input<Maybe<string>>();

  readonly showAction = output<void>();

  actionClicked() {
    this.showAction.emit();
  }
}
