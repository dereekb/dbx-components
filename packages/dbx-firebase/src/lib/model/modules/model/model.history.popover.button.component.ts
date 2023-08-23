import { ChangeDetectionStrategy, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { AbstractPopoverRefDirective, DbxPopoverService } from '@dereekb/dbx-web';
import { NgPopoverRef } from 'ng-overlay-container';
import { DbxFirebaseModelHistoryPopoverComponent, DbxFirebaseModelHistoryPopoverParams } from './model.history.popover.component';

export type DbxFirebaseModelHistoryPopoverButtonConfig = DbxFirebaseModelHistoryPopoverParams;

@Component({
  selector: 'dbx-firebase-model-history-popover-button',
  template: `
    <dbx-icon-button #button (buttonClick)="showHistoryPopover()" icon="history"></dbx-icon-button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseModelHistoryPopoverButtonComponent extends AbstractPopoverRefDirective<unknown, unknown> {
  @ViewChild('button', { read: ElementRef, static: false })
  buttonElement!: ElementRef;

  @Input()
  config?: DbxFirebaseModelHistoryPopoverButtonConfig;

  constructor(private readonly dbxPopoverService: DbxPopoverService) {
    super();
  }

  protected override _makePopoverRef(origin?: ElementRef): NgPopoverRef<unknown, unknown> {
    const config = this.config;

    if (!origin) {
      throw new Error('Missing origin.');
    }

    return DbxFirebaseModelHistoryPopoverComponent.openPopover(this.dbxPopoverService, {
      origin,
      ...config
    });
  }

  showHistoryPopover(): void {
    const origin = this.buttonElement.nativeElement;
    this.showPopover(origin);
  }
}
