import { NgTemplateOutlet } from '@angular/common';
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
    @switch (buttonDisplayTypeSignal()) {
      @case ('text_button') {
        <button mat-button [disabled]="disabledSignal()" (click)="clickButton()">
          @if (icon()) {
            <mat-icon class="dbx-icon-spacer">{{ icon() }}</mat-icon>
          }
          <span>{{ text() }}</span>
          <ng-container *ngTemplateOutlet="content"></ng-container>
        </button>
      }
      @case ('icon_button') {
        <button mat-icon-button [disabled]="disabledSignal()" (click)="clickButton()">
          <mat-icon>{{ icon() }}</mat-icon>
          <ng-container *ngTemplateOutlet="content"></ng-container>
        </button>
      }
    }
    <ng-template #content>
      <ng-content></ng-content>
    </ng-template>
  `,
  providers: provideDbxButton(DbxIconButtonComponent),
  host: {
    class: 'dbx-icon-button'
  },
  imports: [MatButton, MatIcon, MatIconButton, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxIconButtonComponent extends AbstractDbxButtonDirective {}
