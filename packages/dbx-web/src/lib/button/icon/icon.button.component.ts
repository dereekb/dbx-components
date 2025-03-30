import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { AbstractDbxButtonDirective, provideDbxButton } from '@dereekb/dbx-core';

/**
 * Simple dbx-button that displays a button with an icon.
 */
@Component({
  selector: 'dbx-icon-button',
  template: `
    @switch (buttonDisplayType) {
      @case ('text_button') {
        <button mat-button [disabled]="disabled" (click)="clickButton()">
          @if (icon) {
            <mat-icon class="dbx-icon-spacer">{{ icon }}</mat-icon>
          }
          <span>{{ text }}</span>
          <ng-container *ngTemplateOutlet="content"></ng-container>
        </button>
      }
      @case ('icon_button') {
        <button mat-icon-button [disabled]="disabled" (click)="clickButton()">
          <mat-icon>{{ icon }}</mat-icon>
          <ng-container *ngTemplateOutlet="content"></ng-container>
        </button>
      }
    }
    <ng-template #content>
      <ng-content></ng-content>
    </ng-template>
  `,
  imports: [MatButton, MatIcon, MatIconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: provideDbxButton(DbxIconButtonComponent),
  standalone: true,
  host: {
    class: 'dbx-icon-button'
  }
})
export class DbxIconButtonComponent extends AbstractDbxButtonDirective {}
