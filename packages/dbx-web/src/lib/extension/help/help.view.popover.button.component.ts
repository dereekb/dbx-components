import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, viewChild } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { AbstractPopoverRefDirective } from '../../interaction/popover/abstract.popover.ref.directive';
import { DbxPopoverService } from '../../interaction/popover/popover.service';
import { NgPopoverRef } from 'ng-overlay-container';
import { DbxHelpViewPopoverComponent, DbxHelpViewPopoverConfigWithoutOrigin } from './help.view.popover.component';
import { DbxButtonDisplay } from '@dereekb/dbx-core';
import { DbxButtonComponent, DbxButtonStyle } from '../../button';

export interface DbxHelpViewPopoverButtonConfig extends DbxHelpViewPopoverConfigWithoutOrigin {
  /**
   * The display configuration for the button.
   */
  readonly buttonDisplay?: Maybe<DbxButtonDisplay>;
  /**
   * The style configuration for the button.
   */
  readonly buttonStyle?: Maybe<DbxButtonStyle>;
}

/**
 * Button component that opens a help popover showing active help contexts.
 */
@Component({
  selector: 'dbx-help-view-popover-button',
  template: `
    <dbx-button #button (buttonClick)="showHelpPopover()" [buttonStyle]="buttonStyleSignal()" [buttonDisplay]="buttonDisplaySignal()"></dbx-button>
  `,
  standalone: true,
  imports: [DbxButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxHelpViewPopoverButtonComponent extends AbstractPopoverRefDirective<unknown, unknown> {
  private readonly _dbxPopoverService = inject(DbxPopoverService);

  readonly buttonElement = viewChild.required<string, ElementRef>('button', { read: ElementRef });

  readonly config = input<Maybe<DbxHelpViewPopoverButtonConfig>>();

  readonly buttonDisplaySignal = computed(() => {
    const config = this.config();
    return config?.buttonDisplay ?? { icon: config?.icon ?? 'help_center' };
  });

  readonly buttonStyleSignal = computed(() => this.config()?.buttonStyle);

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
