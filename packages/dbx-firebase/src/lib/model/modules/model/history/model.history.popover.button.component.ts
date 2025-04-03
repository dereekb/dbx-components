import { ChangeDetectionStrategy, Component, ElementRef, Input, ViewChild, inject, input, viewChild } from '@angular/core';
import { AbstractPopoverRefDirective, DbxIconButtonComponent, DbxPopoverService } from '@dereekb/dbx-web';
import { NgPopoverRef } from 'ng-overlay-container';
import { DbxFirebaseModelHistoryPopoverComponent, DbxFirebaseModelHistoryPopoverConfig, DbxFirebaseModelHistoryPopoverConfigWithoutOrigin } from './model.history.popover.component';
import { Maybe } from '@dereekb/util';

export type DbxFirebaseModelHistoryPopoverButtonConfig = DbxFirebaseModelHistoryPopoverConfigWithoutOrigin;

@Component({
  selector: 'dbx-firebase-model-history-popover-button',
  template: `
    <dbx-icon-button #button (buttonClick)="showHistoryPopover()" icon="history"></dbx-icon-button>
  `,
  standalone: true,
  imports: [DbxIconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseModelHistoryPopoverButtonComponent extends AbstractPopoverRefDirective<unknown, unknown> {
  private readonly _dbxPopoverService = inject(DbxPopoverService);

  readonly buttonElement = viewChild.required<ElementRef>('button');
  readonly config = input<DbxFirebaseModelHistoryPopoverConfigWithoutOrigin>();

  protected override _makePopoverRef(origin?: Maybe<ElementRef>): NgPopoverRef<unknown, unknown> {
    const config = this.config();

    if (!origin) {
      throw new Error('Missing origin.');
    }

    return DbxFirebaseModelHistoryPopoverComponent.openPopover(this._dbxPopoverService, {
      origin,
      ...config
    });
  }

  showHistoryPopover(): void {
    const origin = this.buttonElement();
    this.showPopover(origin);
  }
}
