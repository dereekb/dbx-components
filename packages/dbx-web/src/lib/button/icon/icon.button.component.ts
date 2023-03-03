import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractDbxButtonDirective, provideDbxButton } from '@dereekb/dbx-core';

/**
 * Simple dbx-button that displays a button with an icon.
 */
@Component({
  selector: 'dbx-icon-button',
  template: `
    <ng-container [ngSwitch]="buttonDisplayType">
      <button *ngSwitchCase="'text_button'" mat-button [disabled]="disabled" (click)="clickButton()">
        <mat-icon class="dbx-icon-spacer" *ngIf="icon">{{ icon }}</mat-icon>
        <span>{{ text }}</span>
      </button>
      <button *ngSwitchCase="'icon_button'" mat-icon-button [disabled]="disabled" (click)="clickButton()">
        <mat-icon>{{ icon }}</mat-icon>
      </button>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: provideDbxButton(DbxIconButtonComponent)
})
export class DbxIconButtonComponent extends AbstractDbxButtonDirective {}
