import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

export interface DbxErrorViewButtonEvent {
  readonly origin: ElementRef;
}

/**
 * The basic error view. Shows an info button and an error message.
 */
@Component({
  selector: 'dbx-error-view',
  template: `
    <button class="dbx-error-button" [disabled]="buttonDisabled" #buttonPopoverOrigin mat-icon-button (click)="clickError()">
      <mat-icon>{{ icon }}</mat-icon>
    </button>
    <span class="dbx-error-message" *ngIf="message">{{ message }}</span>
  `,
  host: {
    class: 'dbx-error dbx-warn dbx-b'
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule]
})
export class DbxErrorViewComponent {
  @Input()
  icon: string = 'error';

  @Input()
  message?: Maybe<string>;

  /**
   * Whether or not the error button is disabled.
   */
  @Input()
  buttonDisabled?: Maybe<boolean>;

  @Output()
  readonly buttonClick = new EventEmitter<DbxErrorViewButtonEvent>();

  @ViewChild('buttonPopoverOrigin', { read: ElementRef })
  buttonOrigin!: ElementRef;

  clickError() {
    if (!this.buttonDisabled) {
      this.buttonClick.emit({
        origin: this.buttonOrigin
      });
    }
  }

  ngOnDestroy(): void {
    this.buttonClick.complete();
  }
}
