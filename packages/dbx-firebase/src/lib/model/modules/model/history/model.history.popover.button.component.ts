import { ChangeDetectionStrategy, Component, ElementRef, inject, input, viewChild } from '@angular/core';
import { AbstractPopoverRefDirective, DbxButtonComponent, DbxPopoverService } from '@dereekb/dbx-web';
import { type NgPopoverRef } from 'ng-overlay-container';
import { DbxFirebaseModelHistoryPopoverComponent, type DbxFirebaseModelHistoryPopoverConfigWithoutOrigin } from './model.history.popover.component';
import { type Maybe } from '@dereekb/util';

export type DbxFirebaseModelHistoryPopoverButtonConfig = DbxFirebaseModelHistoryPopoverConfigWithoutOrigin;

@Component({
  selector: 'dbx-firebase-model-history-popover-button',
  template: `
    <dbx-button #button (buttonClick)="showHistoryPopover()" icon="history" iconOnly></dbx-button>
  `,
  standalone: true,
  imports: [DbxButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseModelHistoryPopoverButtonComponent extends AbstractPopoverRefDirective<unknown, unknown> {
  private readonly _dbxPopoverService = inject(DbxPopoverService);

  readonly buttonElement = viewChild.required<string, ElementRef>('button', { read: ElementRef });
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
