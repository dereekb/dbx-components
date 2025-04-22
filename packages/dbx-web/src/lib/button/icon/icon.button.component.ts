import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule, MatIconButton } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AbstractDbxButtonDirective, provideDbxButton } from '@dereekb/dbx-core';

/**
 * Simple dbx-button that displays a button with an icon.
 */
@Component({
  selector: 'dbx-icon-button',
  template: `
    @switch (buttonDisplayTypeSignal()) {
      @case ('text_button') {
        <button mat-button class="mat-unthemed" [disabled]="disabledSignal()" (click)="clickButton()">
          @if (iconSignal()) {
            <mat-icon class="dbx-icon-spacer">{{ iconSignal() }}</mat-icon>
          }
          <span>{{ textSignal() }}</span>
          <ng-container *ngTemplateOutlet="content"></ng-container>
        </button>
      }
      @case ('icon_button') {
        <button mat-icon-button [disabled]="disabledSignal()" (click)="clickButton()">
          <mat-icon>{{ iconSignal() }}</mat-icon>
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
  imports: [MatButtonModule, MatIconModule, MatIconButton, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxIconButtonComponent extends AbstractDbxButtonDirective {}
