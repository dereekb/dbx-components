import { ChangeDetectionStrategy, Component, ElementRef, inject, input, viewChild } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { AbstractPopoverRefDirective } from '../../interaction/popover/abstract.popover.ref.directive';
import { DbxPopoverService } from '../../interaction/popover/popover.service';
import { DbxIconButtonComponent } from '../../button';
import { NgPopoverRef } from 'ng-overlay-container';
import { DbxHelpViewPopoverComponent, DbxHelpViewPopoverConfigWithoutOrigin } from './help.view.popover.component';

export type DbxHelpViewPopoverButtonConfig = DbxHelpViewPopoverConfigWithoutOrigin;

/**
 * Button component that opens a help popover showing active help contexts.
 */
@Component({
  selector: 'dbx-help-view-popover-button',
  template: `
    <dbx-icon-button #button (buttonClick)="showHelpPopover()" icon="help_center"></dbx-icon-button>
  `,
  standalone: true,
  imports: [DbxIconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxHelpViewPopoverButtonComponent extends AbstractPopoverRefDirective<unknown, unknown> {
  private readonly _dbxPopoverService = inject(DbxPopoverService);

  readonly buttonElement = viewChild.required<string, ElementRef>('button', { read: ElementRef });
  readonly config = input<Maybe<DbxHelpViewPopoverButtonConfig>>();

  protected override _makePopoverRef(origin?: Maybe<ElementRef>): NgPopoverRef<unknown, unknown> {
    if (!origin) {
      throw new Error('Missing origin.');
    }

    const config = this.config();

    return DbxHelpViewPopoverComponent.openPopover(this._dbxPopoverService, {
      origin,
      ...config
    });
  }

  showHelpPopover(): void {
    const origin = this.buttonElement();
    this.showPopover(origin);
  }
}
